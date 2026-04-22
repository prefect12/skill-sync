#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SkillRootConfig {
    id: String,
    label: String,
    kind: String,
    provider_hint: String,
    local_path: String,
    remote_path: String,
    enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LocalSkillEntry {
    id: String,
    root_id: String,
    name: String,
    path: String,
    modified_at_ms: u64,
    content_hash: String,
    is_symlink: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LocalRootSnapshot {
    root_id: String,
    path: String,
    exists: bool,
    skills: Vec<LocalSkillEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteSkillEntry {
    id: String,
    root_id: String,
    name: String,
    repo_path: String,
    modified_at_ms: u64,
    content_hash: String,
    last_commit_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteRootSnapshot {
    root_id: String,
    remote_path: String,
    skills: Vec<RemoteSkillEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiscoverRootsPayload {
    roots: Vec<SkillRootConfig>,
    notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteScanPayload {
    roots: Vec<RemoteRootSnapshot>,
    notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncOperation {
    row_id: String,
    root_id: String,
    skill_name: String,
    action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncResult {
    remote_roots: Vec<RemoteRootSnapshot>,
    notes: Vec<String>,
    synced_row_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManifestRoot {
    id: String,
    label: String,
    kind: String,
    provider_hint: String,
    remote_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManifestSkill {
    id: String,
    root_id: String,
    name: String,
    repo_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManifestFile {
    version: u8,
    roots: Vec<ManifestRoot>,
    skills: Vec<ManifestSkill>,
}

fn home_dir() -> Result<PathBuf, String> {
    std::env::var("HOME")
        .map(PathBuf::from)
        .map_err(|_| "HOME is not available in this environment".to_string())
}

fn expand_home(input: &str) -> Result<PathBuf, String> {
    if input == "~" {
        return home_dir();
    }

    if let Some(stripped) = input.strip_prefix("~/") {
        return Ok(home_dir()?.join(stripped));
    }

    Ok(PathBuf::from(input))
}

fn normalize_remote_path(input: &str) -> Result<String, String> {
    let trimmed = input.trim().trim_matches('/');
    if trimmed.contains("..") {
        return Err(format!("Remote path contains invalid traversal: {input}"));
    }

    if trimmed.is_empty() {
        return Err("Remote path must not be empty".to_string());
    }

    Ok(trimmed.replace('\\', "/"))
}

fn system_time_to_ms(value: SystemTime) -> u64 {
    value
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn latest_modified_ms(path: &Path) -> u64 {
    let mut latest = fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .map(system_time_to_ms)
        .unwrap_or_default();

    if path.is_dir() {
        let entries = match fs::read_dir(path) {
            Ok(entries) => entries,
            Err(_) => return latest,
        };

        for entry in entries.flatten() {
            let child = entry.path();
            let child_mtime = latest_modified_ms(&child);
            if child_mtime > latest {
                latest = child_mtime;
            }
        }
    }

    latest
}

fn hash_directory(path: &Path) -> Result<String, String> {
    fn walk(base: &Path, current: &Path, hasher: &mut Sha256) -> Result<(), String> {
        let metadata = fs::metadata(current)
            .map_err(|error| format!("Failed to read metadata for {}: {error}", current.display()))?;

        if metadata.is_dir() {
            let mut entries = fs::read_dir(current)
                .map_err(|error| format!("Failed to read {}: {error}", current.display()))?
                .flatten()
                .collect::<Vec<_>>();
            entries.sort_by_key(|entry| entry.file_name());

            for entry in entries {
                walk(base, &entry.path(), hasher)?;
            }
        } else {
            let relative = current
                .strip_prefix(base)
                .unwrap_or(current)
                .to_string_lossy()
                .replace('\\', "/");
            hasher.update(relative.as_bytes());
            hasher.update([0]);
            let bytes = fs::read(current)
                .map_err(|error| format!("Failed to read {}: {error}", current.display()))?;
            hasher.update(bytes);
        }

        Ok(())
    }

    let mut hasher = Sha256::new();
    walk(path, path, &mut hasher)?;
    Ok(format!("{:x}", hasher.finalize()))
}

fn skill_entry_from_dir(root_id: &str, entry_path: &Path) -> Option<LocalSkillEntry> {
    let metadata = fs::symlink_metadata(entry_path).ok()?;
    let is_symlink = metadata.file_type().is_symlink();
    let target_path = if is_symlink {
        fs::canonicalize(entry_path).ok()?
    } else {
        entry_path.to_path_buf()
    };
    let skill_file = target_path.join("SKILL.md");

    if !skill_file.exists() {
        return None;
    }

    let name = entry_path.file_name()?.to_string_lossy().to_string();
    let modified_at_ms = latest_modified_ms(&target_path);
    let content_hash = hash_directory(&target_path).ok()?;

    Some(LocalSkillEntry {
        id: format!("{root_id}:{name}"),
        root_id: root_id.to_string(),
        name,
        path: entry_path.to_string_lossy().to_string(),
        modified_at_ms,
        content_hash,
        is_symlink,
    })
}

fn scan_root(config: &SkillRootConfig) -> Result<LocalRootSnapshot, String> {
    let root_path = expand_home(&config.local_path)?;
    if !root_path.exists() {
        return Ok(LocalRootSnapshot {
            root_id: config.id.clone(),
            path: root_path.to_string_lossy().to_string(),
            exists: false,
            skills: vec![],
        });
    }

    let mut skills = vec![];
    let entries = fs::read_dir(&root_path)
        .map_err(|error| format!("Failed to read {}: {error}", root_path.display()))?;

    for entry in entries.flatten() {
        let path = entry.path();
        let symlink_metadata = match fs::symlink_metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };

        if !symlink_metadata.is_dir() && !symlink_metadata.file_type().is_symlink() {
            continue;
        }

        if let Some(skill) = skill_entry_from_dir(&config.id, &path) {
            skills.push(skill);
        }
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(LocalRootSnapshot {
        root_id: config.id.clone(),
        path: root_path.to_string_lossy().to_string(),
        exists: true,
        skills,
    })
}

fn skill_sync_workspace(repo_url: &str) -> Result<PathBuf, String> {
    let mut hasher = DefaultHasher::new();
    repo_url.hash(&mut hasher);
    let hash = hasher.finish();
    let path = home_dir()?.join("Library/Application Support/SkillSync/repos").join(format!("{hash}"));
    fs::create_dir_all(&path)
        .map_err(|error| format!("Failed to create workspace {}: {error}", path.display()))?;
    Ok(path)
}

fn run_git(repo_dir: Option<&Path>, args: &[&str]) -> Result<String, String> {
    let mut command = Command::new("git");
    if let Some(repo_dir) = repo_dir {
        command.arg("-C").arg(repo_dir);
    }
    command.args(args);

    let output = command
        .output()
        .map_err(|error| format!("Failed to start git {:?}: {error}", args))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn ensure_repo_clone(repo_url: &str) -> Result<PathBuf, String> {
    let workspace = skill_sync_workspace(repo_url)?;
    let repo_dir = workspace.join("repo");

    if !repo_dir.exists() {
        run_git(
            None,
            &[
                "clone",
                repo_url,
                repo_dir
                    .to_str()
                    .ok_or_else(|| "Invalid clone path".to_string())?,
            ],
        )?;
        return Ok(repo_dir);
    }

    if !repo_dir.join(".git").exists() {
        return Err(format!(
            "Workspace exists but is not a git clone: {}",
            repo_dir.display()
        ));
    }

    let _ = run_git(Some(&repo_dir), &["pull", "--ff-only"]);
    Ok(repo_dir)
}

fn remote_skill_entry(repo_dir: &Path, root_id: &str, remote_path: &str, skill_name: &str, skill_dir: &Path) -> RemoteSkillEntry {
    let repo_relative_path = format!("{remote_path}/{skill_name}");
    let commit_time = run_git(
        Some(repo_dir),
        &["log", "-1", "--format=%ct", "--", &repo_relative_path],
    )
    .ok()
    .and_then(|value| value.parse::<u64>().ok())
    .map(|seconds| seconds * 1000)
    .unwrap_or_else(|| latest_modified_ms(skill_dir));
    let commit_summary = run_git(
        Some(repo_dir),
        &["log", "-1", "--format=%h %s", "--", &repo_relative_path],
    )
    .ok();
    let content_hash = hash_directory(skill_dir).unwrap_or_else(|_| "unavailable".into());

    RemoteSkillEntry {
        id: format!("{root_id}:{skill_name}"),
        root_id: root_id.to_string(),
        name: skill_name.to_string(),
        repo_path: repo_relative_path,
        modified_at_ms: commit_time,
        content_hash,
        last_commit_summary: commit_summary,
    }
}

fn scan_remote_root(repo_dir: &Path, config: &SkillRootConfig) -> Result<RemoteRootSnapshot, String> {
    let remote_path = normalize_remote_path(&config.remote_path)?;
    let root_path = repo_dir.join(&remote_path);
    if !root_path.exists() {
        return Ok(RemoteRootSnapshot {
            root_id: config.id.clone(),
            remote_path,
            skills: vec![],
        });
    }

    let mut skills = vec![];
    let entries = fs::read_dir(&root_path)
        .map_err(|error| format!("Failed to read remote root {}: {error}", root_path.display()))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let skill_file = path.join("SKILL.md");
        if !skill_file.exists() {
            continue;
        }

        let Some(name) = path.file_name().map(|value| value.to_string_lossy().to_string()) else {
            continue;
        };

        skills.push(remote_skill_entry(
            repo_dir,
            &config.id,
            &remote_path,
            &name,
            &path,
        ));
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(RemoteRootSnapshot {
        root_id: config.id.clone(),
        remote_path,
        skills,
    })
}

fn remove_path_if_exists(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Failed to stat {}: {error}", path.display()))?;
    if metadata.file_type().is_symlink() {
        fs::remove_file(path)
            .map_err(|error| format!("Failed to remove symlink {}: {error}", path.display()))?;
    } else if metadata.is_dir() {
        fs::remove_dir_all(path)
            .map_err(|error| format!("Failed to remove {}: {error}", path.display()))?;
    } else {
        fs::remove_file(path)
            .map_err(|error| format!("Failed to remove {}: {error}", path.display()))?;
    }

    Ok(())
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target)
        .map_err(|error| format!("Failed to create {}: {error}", target.display()))?;

    for entry in fs::read_dir(source)
        .map_err(|error| format!("Failed to read {}: {error}", source.display()))?
    {
        let entry = entry.map_err(|error| format!("Failed to access entry: {error}"))?;
        let entry_path = entry.path();
        let target_path = target.join(entry.file_name());
        let metadata = fs::symlink_metadata(&entry_path)
            .map_err(|error| format!("Failed to stat {}: {error}", entry_path.display()))?;

        if metadata.file_type().is_symlink() {
            let real = fs::canonicalize(&entry_path)
                .map_err(|error| format!("Failed to resolve symlink {}: {error}", entry_path.display()))?;
            if real.is_dir() {
                copy_dir_recursive(&real, &target_path)?;
            } else {
                fs::copy(&real, &target_path).map_err(|error| {
                    format!(
                        "Failed to copy symlink target {} -> {}: {error}",
                        real.display(),
                        target_path.display()
                    )
                })?;
            }
        } else if metadata.is_dir() {
            copy_dir_recursive(&entry_path, &target_path)?;
        } else {
            fs::copy(&entry_path, &target_path).map_err(|error| {
                format!(
                    "Failed to copy {} -> {}: {error}",
                    entry_path.display(),
                    target_path.display()
                )
            })?;
        }
    }

    Ok(())
}

fn find_root<'a>(roots: &'a [SkillRootConfig], root_id: &str) -> Result<&'a SkillRootConfig, String> {
    roots.iter()
        .find(|root| root.id == root_id)
        .ok_or_else(|| format!("Unknown root id: {root_id}"))
}

fn skill_source_path(root: &SkillRootConfig, skill_name: &str) -> Result<PathBuf, String> {
    Ok(expand_home(&root.local_path)?.join(skill_name))
}

fn skill_remote_path(repo_dir: &Path, root: &SkillRootConfig, skill_name: &str) -> Result<PathBuf, String> {
    Ok(repo_dir.join(normalize_remote_path(&root.remote_path)?).join(skill_name))
}

fn local_write_path(path: &Path) -> Result<PathBuf, String> {
    if let Ok(metadata) = fs::symlink_metadata(path) {
        if metadata.file_type().is_symlink() {
            return fs::canonicalize(path)
                .map_err(|error| format!("Failed to resolve local symlink {}: {error}", path.display()));
        }
    }

    Ok(path.to_path_buf())
}

fn write_manifest(repo_dir: &Path, roots: &[SkillRootConfig]) -> Result<(), String> {
    let remote_snapshots: Vec<RemoteRootSnapshot> = roots
        .iter()
        .map(|root| scan_remote_root(repo_dir, root))
        .collect::<Result<_, _>>()?;

    let manifest = ManifestFile {
        version: 1,
        roots: roots
            .iter()
            .map(|root| ManifestRoot {
                id: root.id.clone(),
                label: root.label.clone(),
                kind: root.kind.clone(),
                provider_hint: root.provider_hint.clone(),
                remote_path: root.remote_path.clone(),
            })
            .collect(),
        skills: remote_snapshots
            .iter()
            .flat_map(|snapshot| snapshot.skills.iter())
            .map(|skill| ManifestSkill {
                id: skill.id.clone(),
                root_id: skill.root_id.clone(),
                name: skill.name.clone(),
                repo_path: skill.repo_path.clone(),
            })
            .collect(),
    };

    let manifest_path = repo_dir.join("manifest.json");
    let payload = serde_json::to_vec_pretty(&manifest)
        .map_err(|error| format!("Failed to serialize manifest: {error}"))?;
    fs::write(&manifest_path, payload)
        .map_err(|error| format!("Failed to write {}: {error}", manifest_path.display()))?;
    Ok(())
}

#[tauri::command]
fn discover_roots(base_dir: Option<String>) -> Result<DiscoverRootsPayload, String> {
    let home = home_dir()?;
    let mut roots = vec![
        SkillRootConfig {
            id: "codex-home".into(),
            label: "Codex Home".into(),
            kind: "codex-home".into(),
            provider_hint: "codex".into(),
            local_path: format!("{}/.codex/skills", home.display()),
            remote_path: "roots/codex-home".into(),
            enabled: true,
        },
        SkillRootConfig {
            id: "claude-home".into(),
            label: "Claude Home".into(),
            kind: "claude-home".into(),
            provider_hint: "claude".into(),
            local_path: format!("{}/.claude/skills", home.display()),
            remote_path: "roots/claude-home".into(),
            enabled: true,
        },
    ];
    let mut notes = vec![];

    let scan_base = if let Some(base_dir) = base_dir {
        PathBuf::from(base_dir)
    } else {
        home.join("Documents/github")
    };

    if scan_base.exists() {
        let entries = fs::read_dir(&scan_base)
            .map_err(|error| format!("Failed to read {}: {error}", scan_base.display()))?;

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let project_skills = path.join(".claude/skills");
            if !project_skills.exists() {
                continue;
            }

            let Some(name) = path.file_name().map(|value| value.to_string_lossy().to_string()) else {
                continue;
            };

            let root_id = format!("claude-project-{}", name.to_lowercase().replace(|c: char| !c.is_ascii_alphanumeric(), "-"));
            roots.push(SkillRootConfig {
                id: root_id.clone(),
                label: format!("{name} Claude Project"),
                kind: "claude-project".into(),
                provider_hint: "claude".into(),
                local_path: project_skills.to_string_lossy().to_string(),
                remote_path: format!("roots/{root_id}"),
                enabled: true,
            });
        }
    } else {
        notes.push(format!(
            "Project root scan base does not exist yet: {}",
            scan_base.display()
        ));
    }

    Ok(DiscoverRootsPayload { roots, notes })
}

#[tauri::command]
fn scan_local_roots(roots: Vec<SkillRootConfig>) -> Result<Vec<LocalRootSnapshot>, String> {
    roots.iter().map(scan_root).collect()
}

#[tauri::command]
fn load_remote_snapshot(
    repo_url: String,
    roots: Vec<SkillRootConfig>,
) -> Result<RemoteScanPayload, String> {
    if repo_url.trim().is_empty() {
        return Ok(RemoteScanPayload {
            roots: vec![],
            notes: vec!["No GitHub repo URL configured yet.".into()],
        });
    }

    let repo_dir = ensure_repo_clone(&repo_url)?;
    let snapshots = roots
        .iter()
        .map(|root| scan_remote_root(&repo_dir, root))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(RemoteScanPayload {
        roots: snapshots,
        notes: vec![format!("Loaded remote snapshot from {}", repo_dir.display())],
    })
}

#[tauri::command]
fn sync_selected_items(
    repo_url: String,
    roots: Vec<SkillRootConfig>,
    operations: Vec<SyncOperation>,
) -> Result<SyncResult, String> {
    if repo_url.trim().is_empty() {
        return Err("A GitHub repo URL is required before syncing.".into());
    }

    let repo_dir = ensure_repo_clone(&repo_url)?;
    let mut synced = vec![];
    let mut notes = vec![];

    for operation in &operations {
        let root = find_root(&roots, &operation.root_id)?;
        let local_skill_dir = skill_source_path(root, &operation.skill_name)?;
        let remote_skill_dir = skill_remote_path(&repo_dir, root, &operation.skill_name)?;
        if let Some(parent) = remote_skill_dir.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!("Failed to create remote parent {}: {error}", parent.display())
            })?;
        }

        match operation.action.as_str() {
            "push" => {
                if !local_skill_dir.exists() {
                    return Err(format!(
                        "Local skill does not exist for push: {}",
                        local_skill_dir.display()
                    ));
                }
                remove_path_if_exists(&remote_skill_dir)?;
                copy_dir_recursive(&local_skill_dir, &remote_skill_dir)?;
                synced.push(operation.row_id.clone());
            }
            "pull" => {
                if !remote_skill_dir.exists() {
                    return Err(format!(
                        "Remote skill does not exist for pull: {}",
                        remote_skill_dir.display()
                    ));
                }
                let local_target_dir = local_write_path(&local_skill_dir)?;
                if let Some(parent) = local_target_dir.parent() {
                    fs::create_dir_all(parent).map_err(|error| {
                        format!("Failed to create local parent {}: {error}", parent.display())
                    })?;
                }
                remove_path_if_exists(&local_target_dir)?;
                copy_dir_recursive(&remote_skill_dir, &local_target_dir)?;
                synced.push(operation.row_id.clone());
            }
            "delete-remote" => {
                remove_path_if_exists(&remote_skill_dir)?;
                synced.push(operation.row_id.clone());
            }
            "delete-local" => {
                let local_target_dir = local_write_path(&local_skill_dir)?;
                remove_path_if_exists(&local_target_dir)?;
                synced.push(operation.row_id.clone());
            }
            "restore-local" => {
                if !remote_skill_dir.exists() {
                    return Err(format!(
                        "Cannot restore local skill because remote copy is missing: {}",
                        remote_skill_dir.display()
                    ));
                }
                let local_target_dir = local_write_path(&local_skill_dir)?;
                remove_path_if_exists(&local_target_dir)?;
                copy_dir_recursive(&remote_skill_dir, &local_target_dir)?;
                synced.push(operation.row_id.clone());
            }
            other => return Err(format!("Unsupported sync action: {other}")),
        }
    }

    write_manifest(&repo_dir, &roots)?;
    let _ = run_git(Some(&repo_dir), &["add", "."])?;
    let status = run_git(Some(&repo_dir), &["status", "--porcelain"])?;
    if status.trim().is_empty() {
        notes.push("No repository changes were generated by the selected sync actions.".into());
    } else {
        let commit_message = format!("Sync {} skill item(s) from SkillSync Mac", synced.len());
        let _ = run_git(Some(&repo_dir), &["commit", "-m", &commit_message])?;
        let _ = run_git(Some(&repo_dir), &["push"])?;
        notes.push(format!("Committed and pushed {} sync action(s).", synced.len()));
    }

    let remote_roots = roots
        .iter()
        .map(|root| scan_remote_root(&repo_dir, root))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(SyncResult {
        remote_roots,
        notes,
        synced_row_ids: synced,
    })
}

fn main() -> io::Result<()> {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            discover_roots,
            scan_local_roots,
            load_remote_snapshot,
            sync_selected_items
        ])
        .run(tauri::generate_context!())
        .map_err(|error| io::Error::new(io::ErrorKind::Other, error.to_string()))
}
