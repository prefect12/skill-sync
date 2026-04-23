#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::menu::{AboutMetadataBuilder, MenuBuilder, SubmenuBuilder};
use tauri::Emitter;

const MENU_OPEN_ROOTS: &str = "open-roots";
const MENU_OPEN_SETTINGS: &str = "open-settings";
const MENU_REFRESH: &str = "refresh";
const MENU_SYNC_SELECTED: &str = "sync-selected";
const MENU_EVENT_NAME: &str = "skillsync://menu-command";

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
struct SkillDiffFilePayload {
    path: String,
    change: String,
    is_binary: bool,
    local_text: Option<String>,
    remote_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SkillDiffPayload {
    files: Vec<SkillDiffFilePayload>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitHubStatusPayload {
    cli_available: bool,
    authenticated: bool,
    username: Option<String>,
    note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitHubOwner {
    login: String,
    kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitHubRepository {
    owner: String,
    name: String,
    full_name: String,
    url: String,
    ssh_url: Option<String>,
    description: Option<String>,
    is_private: bool,
    viewer_permission: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitHubValidationInput {
    full_name: Option<String>,
    repo_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitHubRepositoryValidation {
    full_name: String,
    url: String,
    ssh_url: Option<String>,
    viewer_permission: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitHubRepoListEntry {
    name: String,
    name_with_owner: String,
    url: String,
    ssh_url: Option<String>,
    description: Option<String>,
    is_private: bool,
    viewer_permission: Option<String>,
}

#[derive(Debug)]
struct CommandResponse {
    success: bool,
    stdout: String,
    stderr: String,
}

#[derive(Debug)]
enum CommandError {
    NotFound(String),
    Failed(String),
}

const GITHUB_HOST: &str = "github.com";
const GH_ENV: [(&str, &str); 2] = [
    ("GH_HOST", GITHUB_HOST),
    ("GH_PROMPT_DISABLED", "1"),
];
const GIT_ENV: [(&str, &str); 2] = [
    ("GIT_TERMINAL_PROMPT", "0"),
    ("GCM_INTERACTIVE", "Never"),
];

impl CommandError {
    fn into_message(self) -> String {
        match self {
            CommandError::NotFound(message) | CommandError::Failed(message) => message,
        }
    }
}

fn home_dir() -> Result<PathBuf, String> {
    std::env::var("HOME")
        .map(PathBuf::from)
        .map_err(|_| "HOME is not available in this environment".to_string())
}

fn expand_home_with_home(home: &Path, input: &str) -> Result<PathBuf, String> {
    if input == "~" {
        return Ok(home.to_path_buf());
    }

    if let Some(stripped) = input.strip_prefix("~/") {
        return Ok(home.join(stripped));
    }

    Ok(PathBuf::from(input))
}

fn expand_home(input: &str) -> Result<PathBuf, String> {
    expand_home_with_home(&home_dir()?, input)
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

fn normalize_skill_name(input: &str) -> Result<String, String> {
    if Path::new(input.trim()).is_absolute() {
        return Err(format!("Skill name must be relative: {input}"));
    }

    let trimmed = input.trim().trim_matches('/');
    if trimmed.is_empty() {
        return Err("Skill name must not be empty".to_string());
    }

    let path = Path::new(trimmed);
    let mut parts = vec![];
    for component in path.components() {
        match component {
            std::path::Component::Normal(value) => {
                let part = value.to_string_lossy().trim().to_string();
                if !part.is_empty() {
                    parts.push(part);
                }
            }
            _ => {
                return Err(format!("Skill name contains invalid traversal: {input}"));
            }
        }
    }

    if parts.is_empty() {
        return Err(format!("Skill name must not be empty: {input}"));
    }

    Ok(parts.join("/"))
}

fn workspace_path_for_home(home: &Path, repo_url: &str) -> PathBuf {
    let mut hasher = DefaultHasher::new();
    repo_workspace_key(repo_url).hash(&mut hasher);
    let hash = hasher.finish();
    home.join("Library/Application Support/SkillSync/repos")
        .join(format!("{hash}"))
}

fn repo_workspace_key(repo_url: &str) -> String {
    parse_repo_url(repo_url)
        .map(|validation| validation.full_name)
        .unwrap_or_else(|_| repo_url.trim().to_string())
}

fn normalize_repo_full_name(input: &str) -> Result<String, String> {
    let trimmed = input
        .trim()
        .trim_matches('/')
        .trim_end_matches(".git")
        .trim();
    let parts = trimmed
        .split('/')
        .filter(|part| !part.trim().is_empty())
        .collect::<Vec<_>>();

    if parts.len() != 2 {
        return Err(format!("Invalid GitHub repository identifier: {input}"));
    }

    Ok(format!("{}/{}", parts[0], parts[1]))
}

fn build_repo_validation(full_name: &str) -> GitHubRepositoryValidation {
    GitHubRepositoryValidation {
        full_name: full_name.to_string(),
        url: format!("https://github.com/{full_name}"),
        ssh_url: Some(format!("git@github.com:{full_name}.git")),
        viewer_permission: None,
    }
}

fn parse_repo_url(repo_url: &str) -> Result<GitHubRepositoryValidation, String> {
    let trimmed = repo_url.trim();
    if trimmed.is_empty() {
        return Err("GitHub repository URL must not be empty.".into());
    }

    if let Some(value) = trimmed.strip_prefix("git@github.com:") {
        let full_name = normalize_repo_full_name(value)?;
        return Ok(build_repo_validation(&full_name));
    }

    if let Some(value) = trimmed.strip_prefix("ssh://git@github.com/") {
        let full_name = normalize_repo_full_name(value)?;
        return Ok(build_repo_validation(&full_name));
    }

    if !trimmed.contains(':') {
        if let Ok(full_name) = normalize_repo_full_name(trimmed) {
            return Ok(build_repo_validation(&full_name));
        }
    }

    let with_scheme = if trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
    {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };

    let parsed = url::Url::parse(&with_scheme)
        .map_err(|_| format!("Invalid GitHub repository URL: {repo_url}"))?;
    if parsed.host_str().unwrap_or_default().to_lowercase() != "github.com" {
        return Err(format!("GitHub repository URL must point to github.com: {repo_url}"));
    }

    let full_name = normalize_repo_full_name(parsed.path())?;
    Ok(build_repo_validation(&full_name))
}

fn parse_owner_lines(username: &str, org_output: &str) -> Vec<GitHubOwner> {
    let mut owners = vec![GitHubOwner {
        login: username.trim().to_string(),
        kind: "user".into(),
    }];

    let mut orgs = org_output
        .lines()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|login| GitHubOwner {
            login: login.to_string(),
            kind: "org".into(),
        })
        .collect::<Vec<_>>();
    orgs.sort_by(|a, b| a.login.cmp(&b.login));
    owners.extend(orgs);
    owners
}

fn map_repo_entries(entries: Vec<GitHubRepoListEntry>) -> Vec<GitHubRepository> {
    let mut repositories = entries
        .into_iter()
        .map(|entry| {
            let owner = entry
                .name_with_owner
                .split('/')
                .next()
                .unwrap_or_default()
                .to_string();

            GitHubRepository {
                owner,
                name: entry.name,
                full_name: entry.name_with_owner,
                url: entry.url,
                ssh_url: entry.ssh_url,
                description: entry.description,
                is_private: entry.is_private,
                viewer_permission: entry.viewer_permission,
            }
        })
        .collect::<Vec<_>>();

    repositories.sort_by(|a, b| a.full_name.cmp(&b.full_name));
    repositories
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

fn relative_skill_name(root_path: &Path, skill_path: &Path) -> Option<String> {
    let relative = skill_path
        .strip_prefix(root_path)
        .ok()?
        .to_string_lossy()
        .replace('\\', "/");

    if relative.is_empty() {
        None
    } else {
        Some(relative)
    }
}

fn collect_skill_dirs(root_path: &Path) -> Result<Vec<PathBuf>, String> {
    fn walk(root_path: &Path, current: &Path, skills: &mut Vec<PathBuf>) -> Result<(), String> {
        let entries = fs::read_dir(current)
            .map_err(|error| format!("Failed to read {}: {error}", current.display()))?;

        for entry in entries {
            let entry = match entry {
                Ok(entry) => entry,
                Err(_) => continue,
            };
            let path = entry.path();
            let metadata = match fs::symlink_metadata(&path) {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };

            if !metadata.is_dir() && !metadata.file_type().is_symlink() {
                continue;
            }

            let scan_path = if metadata.file_type().is_symlink() {
                match fs::canonicalize(&path) {
                    Ok(resolved) => resolved,
                    Err(_) => continue,
                }
            } else {
                path.clone()
            };

            if !scan_path.is_dir() {
                continue;
            }

            if scan_path.join("SKILL.md").exists() {
                skills.push(path);
                continue;
            }

            if path != root_path {
                walk(root_path, &path, skills)?;
            }
        }

        Ok(())
    }

    let mut skills = vec![];
    walk(root_path, root_path, &mut skills)?;
    skills.sort();
    Ok(skills)
}

fn skill_entry_from_dir(root_id: &str, root_path: &Path, entry_path: &Path) -> Option<LocalSkillEntry> {
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

    let name = relative_skill_name(root_path, entry_path)?;
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
    for path in collect_skill_dirs(&root_path)? {
        if let Some(skill) = skill_entry_from_dir(&config.id, &root_path, &path) {
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
    let path = workspace_path_for_home(&home_dir()?, repo_url);
    fs::create_dir_all(&path)
        .map_err(|error| format!("Failed to create workspace {}: {error}", path.display()))?;
    Ok(path)
}

fn existing_repo_clone_path_for_home(home: &Path, repo_url: &str) -> Result<Option<PathBuf>, String> {
    if repo_url.trim().is_empty() {
        return Ok(None);
    }

    let repo_dir = workspace_path_for_home(home, repo_url).join("repo");
    if repo_dir.join(".git").exists() {
        return Ok(Some(repo_dir));
    }

    Err(format!(
        "Remote snapshot is not available yet for {}. Refresh the app before opening compare.",
        repo_url.trim()
    ))
}

fn existing_repo_clone_path(repo_url: &str) -> Result<Option<PathBuf>, String> {
    existing_repo_clone_path_for_home(&home_dir()?, repo_url)
}

fn fallback_binary_locations(binary: &str) -> &'static [&'static str] {
    match binary {
        "gh" => &["/opt/homebrew/bin/gh", "/usr/local/bin/gh"],
        "git" => &["/usr/bin/git", "/opt/homebrew/bin/git", "/usr/local/bin/git"],
        _ => &[],
    }
}

fn resolve_command_binary(binary: &str) -> String {
    if binary.contains('/') {
        return binary.to_string();
    }

    if let Some(path) = std::env::var_os("PATH") {
        for candidate in std::env::split_paths(&path) {
            let resolved = candidate.join(binary);
            if resolved.is_file() {
                return resolved.to_string_lossy().to_string();
            }
        }
    }

    for candidate in fallback_binary_locations(binary) {
        let path = Path::new(candidate);
        if path.is_file() {
            return candidate.to_string();
        }
    }

    binary.to_string()
}

fn run_command_with_env(
    binary: &str,
    repo_dir: Option<&Path>,
    args: &[&str],
    envs: &[(&str, &str)],
) -> Result<CommandResponse, CommandError> {
    let resolved_binary = resolve_command_binary(binary);
    let mut command = Command::new(&resolved_binary);
    if let Some(repo_dir) = repo_dir {
        command.arg("-C").arg(repo_dir);
    }
    command.args(args);
    for (key, value) in envs {
        command.env(key, value);
    }

    let output = command
        .output()
        .map_err(|error| match error.kind() {
            ErrorKind::NotFound => {
                CommandError::NotFound(format!("{binary} is not installed or not on PATH."))
            }
            _ => CommandError::Failed(format!(
                "Failed to start {binary} ({resolved_binary}) {:?}: {error}",
                args
            )),
        })?;

    Ok(CommandResponse {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).trim().to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
    })
}

fn run_command_checked_with_env(
    binary: &str,
    repo_dir: Option<&Path>,
    args: &[&str],
    envs: &[(&str, &str)],
) -> Result<String, String> {
    let response = run_command_with_env(binary, repo_dir, args, envs)
        .map_err(CommandError::into_message)?;

    if !response.success {
        return Err(if response.stderr.is_empty() {
            response.stdout
        } else {
            response.stderr
        });
    }

    Ok(response.stdout)
}

fn run_git(repo_dir: Option<&Path>, args: &[&str]) -> Result<String, String> {
    run_command_checked_with_env("git", repo_dir, args, &GIT_ENV)
}

fn run_gh(args: &[&str]) -> Result<String, String> {
    run_command_checked_with_env("gh", None, args, &GH_ENV)
}

fn run_gh_auth_status() -> Result<CommandResponse, CommandError> {
    run_command_with_env(
        "gh",
        None,
        &["auth", "status", "--active", "--hostname", GITHUB_HOST],
        &GH_ENV,
    )
}

fn github_status_from_auth_response(
    auth_response: Result<CommandResponse, CommandError>,
    username: Option<Result<String, String>>,
) -> GitHubStatusPayload {
    match auth_response {
        Ok(response) if response.success => match username {
            Some(Ok(username)) => GitHubStatusPayload {
                cli_available: true,
                authenticated: true,
                username: Some(username.trim().to_string()),
                note: None,
            },
            Some(Err(error)) => GitHubStatusPayload {
                cli_available: true,
                authenticated: false,
                username: None,
                note: Some(error),
            },
            None => GitHubStatusPayload {
                cli_available: true,
                authenticated: false,
                username: None,
                note: Some("GitHub CLI did not return a username.".into()),
            },
        },
        Ok(response) => GitHubStatusPayload {
            cli_available: true,
            authenticated: false,
            username: None,
            note: Some(if response.stderr.is_empty() {
                "GitHub CLI is installed but not authenticated.".into()
            } else {
                response.stderr
            }),
        },
        Err(CommandError::NotFound(message)) => GitHubStatusPayload {
            cli_available: false,
            authenticated: false,
            username: None,
            note: Some(message),
        },
        Err(CommandError::Failed(message)) => GitHubStatusPayload {
            cli_available: true,
            authenticated: false,
            username: None,
            note: Some(message),
        },
    }
}

fn git_candidate_urls(repo_url: &str) -> Vec<String> {
    let mut candidates = vec![repo_url.trim().to_string()];

    if let Ok(validation) = parse_repo_url(repo_url) {
        if let Some(ssh_url) = validation.ssh_url {
            if !candidates.contains(&ssh_url) {
                candidates.push(ssh_url);
            }
        }

        if !candidates.contains(&validation.url) {
            candidates.push(validation.url);
        }
    }

    candidates
}

fn clone_repo_with_fallback(repo_dir: &Path, repo_url: &str) -> Result<(), String> {
    let mut failures = vec![];

    for candidate in git_candidate_urls(repo_url) {
        match run_git(
            None,
            &[
                "clone",
                &candidate,
                repo_dir
                    .to_str()
                    .ok_or_else(|| "Invalid clone path".to_string())?,
            ],
        ) {
            Ok(_) => return Ok(()),
            Err(error) => {
                let _ = remove_path_if_exists(repo_dir);
                failures.push(format!("{candidate}: {error}"));
            }
        }
    }

    Err(format!(
        "Failed to clone GitHub repository. Tried:\n{}",
        failures.join("\n")
    ))
}

fn refresh_repo_with_fallback(repo_dir: &Path, repo_url: &str) -> Result<(), String> {
    let existing_origin = run_git(Some(repo_dir), &["remote", "get-url", "origin"]).ok();
    let mut candidates = vec![];

    if let Some(origin) = existing_origin {
        candidates.push(origin);
    }

    for candidate in git_candidate_urls(repo_url) {
        if !candidates.contains(&candidate) {
            candidates.push(candidate);
        }
    }

    let mut failures = vec![];

    for candidate in candidates {
        run_git(Some(repo_dir), &["remote", "set-url", "origin", &candidate])?;

        match run_git(Some(repo_dir), &["pull", "--ff-only"]) {
            Ok(_) => return Ok(()),
            Err(error) => failures.push(format!("{candidate}: {error}")),
        }
    }

    Err(format!(
        "Failed to update GitHub repository. Tried:\n{}",
        failures.join("\n")
    ))
}

fn ensure_repo_clone(repo_url: &str) -> Result<PathBuf, String> {
    let workspace = skill_sync_workspace(repo_url)?;
    let repo_dir = workspace.join("repo");

    if !repo_dir.exists() {
        clone_repo_with_fallback(&repo_dir, repo_url)?;
        return Ok(repo_dir);
    }

    if !repo_dir.join(".git").exists() {
        return Err(format!(
            "Workspace exists but is not a git clone: {}",
            repo_dir.display()
        ));
    }

    refresh_repo_with_fallback(&repo_dir, repo_url)?;
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
    for path in collect_skill_dirs(&root_path)? {
        let Some(name) = relative_skill_name(&root_path, &path) else {
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
    Ok(expand_home(&root.local_path)?.join(normalize_skill_name(skill_name)?))
}

fn skill_remote_path(repo_dir: &Path, root: &SkillRootConfig, skill_name: &str) -> Result<PathBuf, String> {
    Ok(repo_dir
        .join(normalize_remote_path(&root.remote_path)?)
        .join(normalize_skill_name(skill_name)?))
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

fn collect_file_entries(base: &Path) -> Result<BTreeMap<String, PathBuf>, String> {
    fn walk(
        base_virtual: &Path,
        virtual_current: &Path,
        actual_current: &Path,
        files: &mut BTreeMap<String, PathBuf>,
        active_dirs: &mut HashSet<PathBuf>,
    ) -> Result<(), String> {
        let canonical_current = fs::canonicalize(actual_current)
            .unwrap_or_else(|_| actual_current.to_path_buf());
        if !active_dirs.insert(canonical_current.clone()) {
            return Ok(());
        }

        let mut entries = fs::read_dir(actual_current)
            .map_err(|error| format!("Failed to read {}: {error}", actual_current.display()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Failed to access {}: {error}", actual_current.display()))?;
        entries.sort_by_key(|entry| entry.file_name());

        for entry in entries {
            let virtual_path = virtual_current.join(entry.file_name());
            let entry_path = entry.path();
            let metadata = fs::symlink_metadata(&entry_path)
                .map_err(|error| format!("Failed to stat {}: {error}", entry_path.display()))?;
            let resolved_path = if metadata.file_type().is_symlink() {
                fs::canonicalize(&entry_path).map_err(|error| {
                    format!("Failed to resolve symlink {}: {error}", entry_path.display())
                })?
            } else {
                entry_path.clone()
            };
            let resolved_metadata = fs::metadata(&resolved_path)
                .map_err(|error| format!("Failed to read {}: {error}", resolved_path.display()))?;

            if resolved_metadata.is_dir() {
                walk(
                    base_virtual,
                    &virtual_path,
                    &resolved_path,
                    files,
                    active_dirs,
                )?;
                continue;
            }

            if !resolved_metadata.is_file() {
                continue;
            }

            let relative = virtual_path
                .strip_prefix(base_virtual)
                .unwrap_or(&virtual_path)
                .to_string_lossy()
                .replace('\\', "/");
            files.insert(relative, resolved_path);
        }

        active_dirs.remove(&canonical_current);
        Ok(())
    }

    let mut files = BTreeMap::new();
    let mut active_dirs = HashSet::new();
    walk(base, base, base, &mut files, &mut active_dirs)?;
    Ok(files)
}

fn decode_text(bytes: &[u8]) -> Option<String> {
    if bytes.contains(&0) {
        return None;
    }

    String::from_utf8(bytes.to_vec()).ok()
}

fn load_skill_diff_payload(
    local_dir: Option<&Path>,
    remote_dir: Option<&Path>,
) -> Result<SkillDiffPayload, String> {
    let local_files = match local_dir {
        Some(path) if path.exists() => collect_file_entries(path)?,
        _ => BTreeMap::new(),
    };
    let remote_files = match remote_dir {
        Some(path) if path.exists() => collect_file_entries(path)?,
        _ => BTreeMap::new(),
    };

    let mut all_paths = BTreeSet::new();
    all_paths.extend(local_files.keys().cloned());
    all_paths.extend(remote_files.keys().cloned());

    let mut files = vec![];
    for path in all_paths {
        let local_bytes = local_files
            .get(&path)
            .map(|file_path| {
                fs::read(file_path)
                    .map_err(|error| format!("Failed to read {}: {error}", file_path.display()))
            })
            .transpose()?;
        let remote_bytes = remote_files
            .get(&path)
            .map(|file_path| {
                fs::read(file_path)
                    .map_err(|error| format!("Failed to read {}: {error}", file_path.display()))
            })
            .transpose()?;

        if let (Some(local), Some(remote)) = (&local_bytes, &remote_bytes) {
            if local == remote {
                continue;
            }
        }

        let local_text = local_bytes.as_deref().and_then(decode_text);
        let remote_text = remote_bytes.as_deref().and_then(decode_text);
        let is_binary =
            (local_bytes.is_some() && local_text.is_none()) || (remote_bytes.is_some() && remote_text.is_none());
        let change = match (local_bytes.is_some(), remote_bytes.is_some()) {
            (true, true) => "modified",
            (true, false) => "added",
            (false, true) => "removed",
            (false, false) => continue,
        };

        files.push(SkillDiffFilePayload {
            path,
            change: change.to_string(),
            is_binary,
            local_text: if is_binary { None } else { local_text },
            remote_text: if is_binary { None } else { remote_text },
        });
    }

    Ok(SkillDiffPayload { files })
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
fn github_status() -> Result<GitHubStatusPayload, String> {
    let auth_response = run_gh_auth_status();
    let username = match &auth_response {
        Ok(response) if response.success => {
            Some(run_gh(&["api", "--hostname", GITHUB_HOST, "user", "-q", ".login"]))
        }
        _ => None,
    };

    Ok(github_status_from_auth_response(auth_response, username))
}

#[tauri::command]
fn github_list_owners() -> Result<Vec<GitHubOwner>, String> {
    let status = github_status()?;
    if !status.authenticated {
        return Err(status
            .note
            .unwrap_or_else(|| "GitHub CLI is not authenticated.".into()));
    }

    let username = status
        .username
        .ok_or_else(|| "GitHub CLI did not return a username.".to_string())?;
    let org_output = run_gh(&["api", "--hostname", GITHUB_HOST, "user/orgs", "-q", ".[].login"])
        .unwrap_or_default();
    Ok(parse_owner_lines(&username, &org_output))
}

#[tauri::command]
fn github_list_repositories(owner: String, limit: Option<u32>) -> Result<Vec<GitHubRepository>, String> {
    let trimmed_owner = owner.trim();
    if trimmed_owner.is_empty() {
        return Err("GitHub owner must not be empty.".into());
    }

    let limit_value = limit.unwrap_or(200).max(1).to_string();
    let output = run_gh(&[
        "repo",
        "list",
        trimmed_owner,
        "--limit",
        limit_value.as_str(),
        "--json",
        "name,nameWithOwner,url,sshUrl,description,isPrivate,viewerPermission",
    ])?;
    let entries = serde_json::from_str::<Vec<GitHubRepoListEntry>>(&output)
        .map_err(|error| format!("Failed to parse GitHub repository list: {error}"))?;

    Ok(map_repo_entries(entries))
}

#[tauri::command]
fn github_validate_repository(input: GitHubValidationInput) -> Result<GitHubRepositoryValidation, String> {
    let parsed = if let Some(full_name) = input.full_name.as_deref() {
        build_repo_validation(&normalize_repo_full_name(full_name)?)
    } else if let Some(repo_url) = input.repo_url.as_deref() {
        parse_repo_url(repo_url)?
    } else {
        return Err("Provide either a GitHub repository full name or URL.".into());
    };

    match github_status()? {
        GitHubStatusPayload { authenticated: true, .. } => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct GitHubRepoViewEntry {
                name_with_owner: String,
                url: String,
                ssh_url: Option<String>,
                viewer_permission: Option<String>,
            }

            let output = run_gh(&[
                "repo",
                "view",
                parsed.full_name.as_str(),
                "--json",
                "nameWithOwner,url,sshUrl,viewerPermission",
            ])?;
            let entry = serde_json::from_str::<GitHubRepoViewEntry>(&output)
                .map_err(|error| format!("Failed to parse GitHub repository details: {error}"))?;

            Ok(GitHubRepositoryValidation {
                full_name: entry.name_with_owner,
                url: entry.url,
                ssh_url: entry.ssh_url,
                viewer_permission: entry.viewer_permission,
            })
        }
        _ => Ok(parsed),
    }
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
fn load_skill_diff(
    repo_url: String,
    roots: Vec<SkillRootConfig>,
    root_id: String,
    skill_name: String,
) -> Result<SkillDiffPayload, String> {
    let root = find_root(&roots, &root_id)?;
    let local_skill_dir = skill_source_path(root, &skill_name)?;
    let local_dir = if local_skill_dir.exists() {
        Some(local_write_path(&local_skill_dir)?)
    } else {
        None
    };

    let remote_dir = existing_repo_clone_path(&repo_url)?
        .map(|repo_dir| skill_remote_path(&repo_dir, root, &skill_name))
        .transpose()?;
    let remote_dir = match remote_dir {
        Some(path) if path.exists() => Some(path),
        _ => None,
    };

    load_skill_diff_payload(local_dir.as_deref(), remote_dir.as_deref())
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
        let commit_message = format!("Sync {} skill item(s) from SkillSync", synced.len());
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
        .setup(|app| {
            let app_name = app.package_info().name.clone();
            let about = AboutMetadataBuilder::new()
                .name(Some(app_name.clone()))
                .version(Some(app.package_info().version.to_string()))
                .build();

            let menu = MenuBuilder::new(app)
                .item(
                    &SubmenuBuilder::new(app, &app_name)
                        .about(Some(about))
                        .separator()
                        .text(MENU_OPEN_ROOTS, "Skill Locations")
                        .text(MENU_OPEN_SETTINGS, "Settings")
                        .separator()
                        .services()
                        .separator()
                        .hide()
                        .hide_others()
                        .show_all()
                        .separator()
                        .quit()
                        .build()?,
                )
                .item(
                    &SubmenuBuilder::new(app, "File")
                        .text(MENU_REFRESH, "Refresh")
                        .text(MENU_SYNC_SELECTED, "Sync Selected")
                        .separator()
                        .text(MENU_OPEN_ROOTS, "Skill Locations")
                        .text(MENU_OPEN_SETTINGS, "Settings")
                        .separator()
                        .close_window()
                        .build()?,
                )
                .item(
                    &SubmenuBuilder::new(app, "Edit")
                        .undo()
                        .redo()
                        .separator()
                        .cut()
                        .copy()
                        .paste()
                        .select_all()
                        .build()?,
                )
                .item(
                    &SubmenuBuilder::new(app, "View")
                        .text(MENU_REFRESH, "Refresh")
                        .separator()
                        .fullscreen()
                        .build()?,
                )
                .item(
                    &SubmenuBuilder::new(app, "Window")
                        .minimize()
                        .maximize()
                        .separator()
                        .text(MENU_OPEN_ROOTS, "Skill Locations")
                        .text(MENU_OPEN_SETTINGS, "Settings")
                        .separator()
                        .close_window()
                        .build()?,
                )
                .build()?;

            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let command = match event.id().0.as_str() {
                MENU_OPEN_ROOTS => Some(MENU_OPEN_ROOTS),
                MENU_OPEN_SETTINGS => Some(MENU_OPEN_SETTINGS),
                MENU_REFRESH => Some(MENU_REFRESH),
                MENU_SYNC_SELECTED => Some(MENU_SYNC_SELECTED),
                _ => None,
            };

            if let Some(command) = command {
                let _ = app.emit(MENU_EVENT_NAME, command);
            }
        })
        .invoke_handler(tauri::generate_handler![
            github_status,
            github_list_owners,
            github_list_repositories,
            github_validate_repository,
            discover_roots,
            scan_local_roots,
            load_remote_snapshot,
            load_skill_diff,
            sync_selected_items
        ])
        .run(tauri::generate_context!())
        .map_err(|error| io::Error::new(io::ErrorKind::Other, error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::symlink;
    use std::sync::atomic::{AtomicU64, Ordering};

    fn create_test_dir(prefix: &str) -> PathBuf {
        static COUNTER: AtomicU64 = AtomicU64::new(0);

        let suffix = COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "skillsync-{prefix}-{}-{suffix}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn normalize_remote_path_rejects_traversal() {
        assert!(normalize_remote_path("../roots/demo").is_err());
    }

    #[test]
    fn expand_home_with_home_expands_tilde_paths() {
        let home = PathBuf::from("/tmp/skillsync-home");
        assert_eq!(
            expand_home_with_home(&home, "~/skills").unwrap(),
            home.join("skills")
        );
    }

    #[test]
    fn workspace_path_is_stable_for_same_repo() {
        let home = PathBuf::from("/tmp/skillsync-home");
        let first = workspace_path_for_home(&home, "https://github.com/acme/skills");
        let second = workspace_path_for_home(&home, "https://github.com/acme/skills");
        assert_eq!(first, second);
    }

    #[test]
    fn workspace_path_is_shared_across_https_and_ssh_urls() {
        let home = PathBuf::from("/tmp/skillsync-home");
        let https = workspace_path_for_home(&home, "https://github.com/acme/skills");
        let ssh = workspace_path_for_home(&home, "git@github.com:acme/skills.git");
        assert_eq!(https, ssh);
    }

    #[test]
    fn parse_repo_url_accepts_https_and_ssh_forms() {
        let https = parse_repo_url("https://github.com/acme/skills.git").unwrap();
        let ssh = parse_repo_url("git@github.com:acme/skills.git").unwrap();

        assert_eq!(https.full_name, "acme/skills");
        assert_eq!(ssh.full_name, "acme/skills");
    }

    #[test]
    fn parse_repo_url_rejects_non_github_hosts() {
        assert!(parse_repo_url("https://gitlab.com/acme/skills").is_err());
    }

    #[test]
    fn git_candidate_urls_include_ssh_fallback_for_https_input() {
        let candidates = git_candidate_urls("https://github.com/acme/skills");
        assert_eq!(candidates[0], "https://github.com/acme/skills");
        assert!(candidates.contains(&"git@github.com:acme/skills.git".to_string()));
    }

    #[test]
    fn fallback_binary_locations_include_homebrew_gh() {
        assert!(fallback_binary_locations("gh").contains(&"/opt/homebrew/bin/gh"));
    }

    #[test]
    fn parse_owner_lines_maps_user_and_orgs() {
        let owners = parse_owner_lines("prefect12", "AhaAITeam\nEnglish4Developers\n");
        assert_eq!(owners[0].login, "prefect12");
        assert_eq!(owners[0].kind, "user");
        assert_eq!(owners[1].kind, "org");
        assert_eq!(owners[2].login, "English4Developers");
    }

    #[test]
    fn map_repo_entries_preserves_permission_fields() {
        let repositories = map_repo_entries(vec![GitHubRepoListEntry {
            name: "skill-sync".into(),
            name_with_owner: "prefect12/skill-sync".into(),
            url: "https://github.com/prefect12/skill-sync".into(),
            ssh_url: Some("git@github.com:prefect12/skill-sync.git".into()),
            description: Some("sync".into()),
            is_private: true,
            viewer_permission: Some("ADMIN".into()),
        }]);

        assert_eq!(repositories[0].owner, "prefect12");
        assert_eq!(repositories[0].viewer_permission.as_deref(), Some("ADMIN"));
    }

    #[test]
    fn github_status_uses_scoped_auth_success() {
        let status = github_status_from_auth_response(
            Ok(CommandResponse {
                success: true,
                stdout: String::new(),
                stderr: "Logged in to github.com account prefect12".into(),
            }),
            Some(Ok("prefect12".into())),
        );

        assert!(status.cli_available);
        assert!(status.authenticated);
        assert_eq!(status.username.as_deref(), Some("prefect12"));
        assert!(status.note.is_none());
    }

    #[test]
    fn github_status_preserves_failed_auth_message() {
        let status = github_status_from_auth_response(
            Ok(CommandResponse {
                success: false,
                stdout: String::new(),
                stderr: "token for github.com is expired".into(),
            }),
            None,
        );

        assert!(status.cli_available);
        assert!(!status.authenticated);
        assert_eq!(status.note.as_deref(), Some("token for github.com is expired"));
    }

    #[test]
    fn github_status_marks_missing_cli_as_unavailable() {
        let status = github_status_from_auth_response(
            Err(CommandError::NotFound("gh is not installed".into())),
            None,
        );

        assert!(!status.cli_available);
        assert!(!status.authenticated);
        assert_eq!(status.note.as_deref(), Some("gh is not installed"));
    }

    #[test]
    fn collect_skill_dirs_finds_nested_skills() {
        let root = create_test_dir("nested-scan");
        let nested = root.join(".system/openai-docs");
        let direct = root.join("equity-investment-dossier");

        fs::create_dir_all(&nested).unwrap();
        fs::create_dir_all(&direct).unwrap();
        fs::write(nested.join("SKILL.md"), "# nested").unwrap();
        fs::write(direct.join("SKILL.md"), "# direct").unwrap();

        let skills = collect_skill_dirs(&root).unwrap();
        let names = skills
            .iter()
            .filter_map(|path| relative_skill_name(&root, path))
            .collect::<Vec<_>>();

        assert_eq!(names, vec![".system/openai-docs", "equity-investment-dossier"]);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn scan_root_uses_relative_paths_for_nested_skills() {
        let root = create_test_dir("scan-root");
        let nested = root.join("codex-primary-runtime/spreadsheets");

        fs::create_dir_all(&nested).unwrap();
        fs::write(nested.join("SKILL.md"), "# sheets").unwrap();

        let snapshot = scan_root(&SkillRootConfig {
            id: "codex-home".into(),
            label: "Codex Home".into(),
            kind: "codex-home".into(),
            provider_hint: "codex".into(),
            local_path: root.to_string_lossy().to_string(),
            remote_path: "roots/codex-home".into(),
            enabled: true,
        })
        .unwrap();

        assert_eq!(snapshot.skills.len(), 1);
        assert_eq!(snapshot.skills[0].name, "codex-primary-runtime/spreadsheets");

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn normalize_skill_name_rejects_traversal() {
        assert!(normalize_skill_name("../escape").is_err());
        assert!(normalize_skill_name("/absolute").is_err());
        assert_eq!(
            normalize_skill_name("nested/skill").unwrap(),
            "nested/skill"
        );
    }

    #[test]
    fn load_skill_diff_payload_marks_modified_text_files() {
        let local = create_test_dir("diff-local");
        let remote = create_test_dir("diff-remote");

        fs::write(local.join("SKILL.md"), "# local\n").unwrap();
        fs::write(remote.join("SKILL.md"), "# remote\n").unwrap();

        let payload = load_skill_diff_payload(Some(&local), Some(&remote)).unwrap();

        assert_eq!(payload.files.len(), 1);
        assert_eq!(payload.files[0].path, "SKILL.md");
        assert_eq!(payload.files[0].change, "modified");
        assert_eq!(payload.files[0].local_text.as_deref(), Some("# local\n"));
        assert_eq!(payload.files[0].remote_text.as_deref(), Some("# remote\n"));

        let _ = fs::remove_dir_all(&local);
        let _ = fs::remove_dir_all(&remote);
    }

    #[test]
    fn load_skill_diff_payload_marks_added_and_removed_files() {
        let local = create_test_dir("diff-added");
        let remote = create_test_dir("diff-removed");

        fs::write(local.join("SKILL.md"), "# local\n").unwrap();
        fs::write(remote.join("README.md"), "# remote only\n").unwrap();

        let payload = load_skill_diff_payload(Some(&local), Some(&remote)).unwrap();
        let changes = payload
            .files
            .iter()
            .map(|file| (file.path.clone(), file.change.clone()))
            .collect::<Vec<_>>();

        assert_eq!(
            changes,
            vec![
                ("README.md".to_string(), "removed".to_string()),
                ("SKILL.md".to_string(), "added".to_string())
            ]
        );

        let _ = fs::remove_dir_all(&local);
        let _ = fs::remove_dir_all(&remote);
    }

    #[test]
    fn load_skill_diff_payload_collects_nested_files_in_sorted_order() {
        let local = create_test_dir("diff-nested-local");
        let remote = create_test_dir("diff-nested-remote");

        fs::create_dir_all(local.join("docs")).unwrap();
        fs::create_dir_all(remote.join("assets")).unwrap();
        fs::write(local.join("docs/guide.md"), "local guide").unwrap();
        fs::write(remote.join("assets/data.md"), "remote data").unwrap();

        let payload = load_skill_diff_payload(Some(&local), Some(&remote)).unwrap();
        let paths = payload
            .files
            .iter()
            .map(|file| file.path.clone())
            .collect::<Vec<_>>();

        assert_eq!(paths, vec!["assets/data.md", "docs/guide.md"]);

        let _ = fs::remove_dir_all(&local);
        let _ = fs::remove_dir_all(&remote);
    }

    #[test]
    fn load_skill_diff_payload_marks_binary_files() {
        let local = create_test_dir("diff-binary-local");
        let remote = create_test_dir("diff-binary-remote");

        fs::write(local.join("blob.bin"), vec![0, 1, 2, 3]).unwrap();
        fs::write(remote.join("blob.bin"), vec![0, 9, 2, 3]).unwrap();

        let payload = load_skill_diff_payload(Some(&local), Some(&remote)).unwrap();

        assert_eq!(payload.files[0].path, "blob.bin");
        assert!(payload.files[0].is_binary);
        assert!(payload.files[0].local_text.is_none());
        assert!(payload.files[0].remote_text.is_none());

        let _ = fs::remove_dir_all(&local);
        let _ = fs::remove_dir_all(&remote);
    }

    #[test]
    fn load_skill_diff_payload_marks_non_utf8_files_as_binary() {
        let local = create_test_dir("diff-non-utf8-local");
        let remote = create_test_dir("diff-non-utf8-remote");

        fs::write(local.join("blob.txt"), vec![0xF0, 0x28, 0x8C, 0x28]).unwrap();
        fs::write(remote.join("blob.txt"), b"plain text").unwrap();

        let payload = load_skill_diff_payload(Some(&local), Some(&remote)).unwrap();

        assert!(payload.files[0].is_binary);

        let _ = fs::remove_dir_all(&local);
        let _ = fs::remove_dir_all(&remote);
    }

    #[test]
    fn load_skill_diff_payload_reads_resolved_symlink_directories() {
        let real_local = create_test_dir("diff-real-local");
        let link_parent = create_test_dir("diff-link-parent");
        let linked_local = link_parent.join("alpha");
        let remote = create_test_dir("diff-symlink-remote");

        fs::write(real_local.join("SKILL.md"), "# local via symlink\n").unwrap();
        fs::write(remote.join("SKILL.md"), "# remote\n").unwrap();
        symlink(&real_local, &linked_local).unwrap();

        let resolved_local = local_write_path(&linked_local).unwrap();
        let payload = load_skill_diff_payload(Some(&resolved_local), Some(&remote)).unwrap();

        assert_eq!(payload.files.len(), 1);
        assert_eq!(payload.files[0].path, "SKILL.md");
        assert_eq!(
            payload.files[0].local_text.as_deref(),
            Some("# local via symlink\n")
        );

        let _ = fs::remove_dir_all(&real_local);
        let _ = fs::remove_dir_all(&link_parent);
        let _ = fs::remove_dir_all(&remote);
    }

    #[test]
    fn existing_repo_clone_path_for_home_requires_existing_repo() {
        let home = create_test_dir("missing-managed-clone");
        let result = existing_repo_clone_path_for_home(&home, "https://github.com/acme/skills");

        assert!(result.is_err());
        assert!(result
            .err()
            .unwrap()
            .contains("Remote snapshot is not available yet"));

        let _ = fs::remove_dir_all(&home);
    }
}
