# SkillSync

English | [简体中文](./README.zh-CN.md)

SkillSync is a `Tauri + React` desktop app for managing and syncing skill
directories across multiple Macs with GitHub as the shared source of truth.

## What It Does

- Scans local skill roots for Codex and Claude
- Detects common presets like:
  - `~/.codex/skills`
  - `~/.claude/skills`
  - project-level `.claude/skills`
- Lets users add custom skill root directories
- Shows local and remote skill inventories side-by-side
- Displays local file timestamps and remote last-commit timestamps
- Supports skill-level and root-level selection
- Runs selective sync against a user-provided GitHub repository
- Requires explicit review for conflict and delete cases before syncing

## Current Scope

Version `0.1.0` focuses on `skills` only.

Out of scope for this build:

- Claude commands
- agents
- plugins
- session history
- auth tokens and secrets
- rewriting Codex or Claude runtime configuration

## Project Structure

```text
skill-sync/
  src/                 React UI and app state
  src/components/      Panels, lists, and root management UI
  src/lib/             Shared types, status logic, and Tauri bindings
  src-tauri/           Desktop backend, filesystem scan, and git sync logic
```

## Run Locally

Install frontend dependencies:

```bash
npm install
```

Run the desktop app in development:

```bash
npm run tauri dev
```

Build the frontend bundle only:

```bash
npm run build
```

Verify the Tauri backend:

```bash
cd src-tauri
cargo check
```

Check release version alignment before tagging:

```bash
npm run release:check
```

## Sync Model

- The user supplies a GitHub repository URL.
- The app maintains a local clone under:
  `~/Library/Application Support/SkillSync/repos/<hash>/repo`
- Each configured root maps to a remote repo subpath such as:
  `roots/codex-home`
- A skill is any directory containing `SKILL.md`
- Sync actions use the system `git` binary and the user's existing local git
  credentials

## Safety Rules

- One-click sync only acts on selected items
- Conflict and pending-delete rows are routed through a review panel first
- Destructive actions require an explicit user decision
- The app does not sync all of `~/.codex` or `~/.claude`

## Packaging Notes

The Tauri config is set up for macOS DMG bundling. This repository currently
includes a placeholder icon and is suitable for local development and internal
iteration. Before public release, replace the placeholder icon, finalize bundle
metadata, and decide on signing/notarization.

## Release Process

This repository includes GitHub Actions release automation in
`.github/workflows/release.yml`.

Current behavior:

- Trigger on pushed tags that match `v*`
- Support manual reruns from `Actions -> Release`
- Build unsigned macOS DMGs for both Apple Silicon and Intel targets
- Create or update the matching GitHub Release and upload the DMG assets

Release steps:

1. Update the version in `package.json`, `src-tauri/tauri.conf.json`, and
   `src-tauri/Cargo.toml`
2. Run `npm run release:check`
3. Commit the version bump
4. Push a tag such as `v0.1.0`

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow uses the default `GITHUB_TOKEN`, so no extra secrets are required
for unsigned releases. If you later want signed and notarized builds, add the
Apple signing and notarization secrets in GitHub Actions and extend the same
workflow.
