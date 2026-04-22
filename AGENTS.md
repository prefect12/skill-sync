# Project Background

SkillSync Mac is a desktop app for managing and synchronizing skill roots across
multiple machines with GitHub as the shared source of truth.

# Product Goal

Give users a visual way to inspect local and remote skills, choose what to
synchronize, and manage skill root directories without editing dotfiles by
hand.

# Target Users

- Individual power users who use Codex and Claude across multiple Macs.
- Small teams that keep reusable skills in shared GitHub repositories.

# Scope And Non-Goals

Scope:

- A macOS GUI for browsing local and remote skill roots and skills.
- Git-backed synchronization between local skill roots and a managed clone of a
  GitHub repository.
- Support for built-in root presets and user-defined custom skill roots.

Non-goals:

- Managing all files under `~/.codex` or `~/.claude`.
- Syncing commands, agents, plugins, sessions, or secrets in v1.
- Rewriting Codex or Claude runtime configuration to change their official
  default skill discovery behavior.

# Data And Source Of Truth

- The bound GitHub repository is the remote source of truth for synchronized
  skills.
- The app-managed root configuration is the local source of truth for which
  directories are scanned and written.
- A skill is a directory containing `SKILL.md`.

# Important Implementation Constraints

- Do not store tokens, auth state, or other secrets in app-managed repo files.
- Keep provider semantics lightweight: model configured skill roots instead of
  hardcoding all behavior around Codex and Claude only.
- Prefer additive, reversible file operations; destructive actions require
  explicit confirmation in the UI.
- Keep the UI usable even when no GitHub repo is configured yet.

# Current Functional Direction

The current implementation direction is a Tauri + React macOS app with:

- a native-leaning macOS UI instead of a web dashboard look
- one main sync window that uses a unified skill list plus a right-side inspector
- separate `Skill Locations` and `Settings` windows instead of inline panels
- built-in presets for `~/.codex/skills` and `~/.claude/skills`
- configurable local root paths and remote repo subpaths
- checkbox-based selective sync, per-item review decisions, and persisted language and appearance preferences
