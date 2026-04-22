import type {
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

function pickState(row: SkillRow, knownSynced: Set<string>): SyncState {
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
    return knownSynced.has(row.id) ? "pending-delete" : "only-local";
  }

  if (!row.local && row.remote) {
    return knownSynced.has(row.id) ? "pending-delete" : "only-remote";
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
  knownSyncedIds: Set<string>
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

      row.state = pickState(row, knownSyncedIds);
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
