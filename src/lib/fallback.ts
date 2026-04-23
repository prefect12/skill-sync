import type {
  DiscoverRootsPayload,
  LocalRootSnapshot,
  RemoteScanPayload,
  SkillDiffPayload,
  SkillRow,
  SkillRootConfig,
  SyncOperation,
  SyncResult
} from "./types";

const now = Date.now();

export function fallbackRoots(): DiscoverRootsPayload {
  return {
    roots: [
      {
        id: "codex-home",
        label: "Codex Home",
        kind: "codex-home",
        providerHint: "codex",
        localPath: "~/.codex/skills",
        remotePath: "roots/codex-home",
        enabled: true
      },
      {
        id: "claude-home",
        label: "Claude Home",
        kind: "claude-home",
        providerHint: "claude",
        localPath: "~/.claude/skills",
        remotePath: "roots/claude-home",
        enabled: true
      }
    ],
    notes: ["Running in browser fallback mode. Backend scan commands are unavailable."]
  };
}

export function fallbackLocalSnapshots(
  roots: SkillRootConfig[]
): LocalRootSnapshot[] {
  return roots.map((root, index) => ({
    rootId: root.id,
    path: root.localPath,
    exists: true,
    skills: [
      {
        id: `${root.id}:sample-alpha`,
        rootId: root.id,
        name: `${root.providerHint}-sample-alpha`,
        path: `${root.localPath}/${root.providerHint}-sample-alpha`,
        modifiedAtMs: now - index * 86_400_000,
        contentHash: `shared-${root.id}-alpha`,
        isSymlink: false
      },
      {
        id: `${root.id}:sample-beta`,
        rootId: root.id,
        name: `${root.providerHint}-sample-beta`,
        path: `${root.localPath}/${root.providerHint}-sample-beta`,
        modifiedAtMs: now - index * 43_200_000,
        contentHash: `local-${root.id}-beta`,
        isSymlink: root.providerHint === "claude"
      }
    ]
  }));
}

export function fallbackRemoteSnapshot(
  roots: SkillRootConfig[]
): RemoteScanPayload {
  return {
    roots: roots.map((root, index) => ({
      rootId: root.id,
      remotePath: root.remotePath,
      skills: [
        {
          id: `${root.id}:sample-alpha`,
          rootId: root.id,
          name: `${root.providerHint}-sample-alpha`,
          repoPath: `${root.remotePath}/${root.providerHint}-sample-alpha`,
          modifiedAtMs: now - index * 80_000_000,
          contentHash: `shared-${root.id}-alpha`,
          lastCommitSummary: "Demo remote commit"
        }
      ]
    })),
    notes: ["Remote data is mocked in fallback mode."]
  };
}

export function fallbackSyncResult(operations: SyncOperation[]): SyncResult {
  return {
    remoteRoots: [],
    notes: [
      `Fallback sync simulated ${operations.length} selected item(s). No filesystem changes were made.`
    ],
    syncedRowIds: operations.map((operation) => operation.rowId)
  };
}

export function fallbackSkillDiff(row: SkillRow): SkillDiffPayload {
  const modified = {
    path: "SKILL.md",
    change: "modified" as const,
    isBinary: false,
    remoteText: `# ${row.name}\n\n## Purpose\nRemote version summary.\n\n## Usage\n- Run the remote workflow first.\n`,
    localText: `# ${row.name}\n\n## Purpose\nLocal version summary with newer details.\n\n## Usage\n- Run the local workflow first.\n- Review compare output before syncing.\n`
  };
  const added = {
    path: "examples/quickstart.md",
    change: "added" as const,
    isBinary: false,
    remoteText: "",
    localText: "## Quickstart\n\n1. Install the skill.\n2. Refresh SkillSync.\n"
  };
  const removed = {
    path: "notes/deprecated.md",
    change: "removed" as const,
    isBinary: false,
    remoteText: "Deprecated workflow notes.\n",
    localText: ""
  };
  const binary = {
    path: "assets/reference.bin",
    change: "modified" as const,
    isBinary: true
  };

  if (row.state === "only-local" || row.state === "local-changed") {
    return { files: [modified, added, binary] };
  }

  if (row.state === "only-remote" || row.state === "remote-changed") {
    return { files: [modified, removed, binary] };
  }

  if (row.state === "pending-delete") {
    return { files: [removed, binary] };
  }

  return { files: [modified, added, removed, binary] };
}
