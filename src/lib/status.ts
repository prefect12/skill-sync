import type {
  KnownSyncedEntries,
  LocalRootSnapshot,
  RemoteRootSnapshot,
  RootGroup,
  SkillListRow,
  SkillRootConfig,
  SkillRow,
  SyncState
} from "./types";

function sortRows(rows: SkillRow[]): SkillRow[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

function shouldKeepPendingDelete(
  rememberedHash: string | true | undefined,
  currentHash: string
) {
  if (!rememberedHash) {
    return false;
  }

  if (rememberedHash === true) {
    return true;
  }

  return rememberedHash === currentHash;
}

function pickState(row: SkillRow, knownSynced: KnownSyncedEntries): SyncState {
  if (row.local && row.remote) {
    if (row.local.contentHash === row.remote.contentHash) {
      return "in-sync";
    }

    if (row.local.modifiedAtMs > row.remote.modifiedAtMs) {
      return "local-changed";
    }

    if (row.local.modifiedAtMs < row.remote.modifiedAtMs) {
      return "remote-changed";
    }
  }

  if (row.local && !row.remote) {
    return shouldKeepPendingDelete(knownSynced[row.id], row.local.contentHash)
      ? "pending-delete"
      : "only-local";
  }

  if (!row.local && row.remote) {
    return shouldKeepPendingDelete(knownSynced[row.id], row.remote.contentHash)
      ? "pending-delete"
      : "only-remote";
  }

  return "conflict";
}

function recommendedAction(state: SyncState) {
  switch (state) {
    case "only-local":
    case "local-changed":
      return "push" as const;
    case "only-remote":
    case "remote-changed":
      return "pull" as const;
    default:
      return undefined;
  }
}

export function buildRootGroups(
  roots: SkillRootConfig[],
  localSnapshots: LocalRootSnapshot[],
  remoteSnapshots: RemoteRootSnapshot[],
  knownSyncedEntries: KnownSyncedEntries
): RootGroup[] {
  return roots.map((root) => {
    const localSnapshot = localSnapshots.find((item) => item.rootId === root.id);
    const remoteSnapshot = remoteSnapshots.find((item) => item.rootId === root.id);
    const keys = new Set<string>();

    localSnapshot?.skills.forEach((skill) => keys.add(skill.name));
    remoteSnapshot?.skills.forEach((skill) => keys.add(skill.name));

    const rows = Array.from(keys).map((name) => {
      const local = localSnapshot?.skills.find((skill) => skill.name === name);
      const remote = remoteSnapshot?.skills.find((skill) => skill.name === name);
      const id = `${root.id}:${name}`;
      const row: SkillRow = {
        id,
        rootId: root.id,
        name,
        local,
        remote,
        state: "conflict"
      };

      row.state = pickState(row, knownSyncedEntries);
      row.recommendedAction = recommendedAction(row.state);

      return row;
    });

    return {
      root,
      rows: sortRows(rows),
      existsLocally: Boolean(localSnapshot?.exists)
    };
  });
}

export function reconcileKnownSyncedEntries(
  current: KnownSyncedEntries,
  rows: SkillRow[],
  syncedRowIds?: Iterable<string>
) {
  const next: KnownSyncedEntries = {};
  const rowMap = new Map(rows.map((row) => [row.id, row]));
  const syncedSet = syncedRowIds ? new Set(syncedRowIds) : null;

  Object.entries(current).forEach(([id, rememberedHash]) => {
    const row = rowMap.get(id);
    if (!row) {
      next[id] = rememberedHash;
      return;
    }

    if (row.local && row.remote && row.local.contentHash === row.remote.contentHash) {
      next[id] = row.local.contentHash;
      return;
    }

    if (row.state === "pending-delete") {
      next[id] = row.local?.contentHash ?? row.remote?.contentHash ?? rememberedHash;
    }
  });

  if (syncedSet) {
    syncedSet.forEach((id) => {
      const row = rowMap.get(id);
      if (!row) {
        delete next[id];
        return;
      }

      if (row.local && row.remote && row.local.contentHash === row.remote.contentHash) {
        next[id] = row.local.contentHash;
        return;
      }

      if (row.local && !row.remote) {
        next[id] = row.local.contentHash;
        return;
      }

      if (!row.local && row.remote) {
        next[id] = row.remote.contentHash;
        return;
      }

      delete next[id];
    });
  }

  return next;
}

export function summarizeRoot(group: RootGroup) {
  const counts = group.rows.reduce<Record<SyncState, number>>(
    (acc, row) => {
      acc[row.state] += 1;
      return acc;
    },
    {
      "in-sync": 0,
      "only-local": 0,
      "only-remote": 0,
      "local-changed": 0,
      "remote-changed": 0,
      conflict: 0,
      "pending-delete": 0
    }
  );

  return counts;
}

export function needsReview(row: SkillRow) {
  return row.state === "conflict" || row.state === "pending-delete";
}

export function flattenSkillRows(groups: RootGroup[]): SkillListRow[] {
  return groups.flatMap((group) =>
    group.rows.map((row) => ({
      root: group.root,
      row
    }))
  );
}
