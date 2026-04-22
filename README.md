# SkillSync Mac

SkillSync Mac is a `Tauri + React` desktop app for managing and syncing skill
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
skill-sync-mac/
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
