import { describe, expect, it } from "vitest";
import {
  buildRootGroups,
  needsReview,
  reconcileKnownSyncedEntries
} from "./status";
import type {
  KnownSyncedEntries,
  LocalRootSnapshot,
  RemoteRootSnapshot,
  SkillRootConfig
} from "./types";

const ROOT: SkillRootConfig = {
  id: "codex-home",
  label: "Codex Home",
  kind: "codex-home",
  providerHint: "codex",
  localPath: "~/.codex/skills",
  remotePath: "roots/codex-home",
  enabled: true
};

function localSnapshot(skills: LocalRootSnapshot["skills"]): LocalRootSnapshot {
  return {
    rootId: ROOT.id,
    path: ROOT.localPath,
    exists: true,
    skills
  };
}

function remoteSnapshot(skills: RemoteRootSnapshot["skills"]): RemoteRootSnapshot {
  return {
    rootId: ROOT.id,
    remotePath: ROOT.remotePath,
    skills
  };
}

describe("status helpers", () => {
  it("derives in-sync, local-changed, remote-changed and pending-delete states", () => {
    const groups = buildRootGroups(
      [ROOT],
      [
        localSnapshot([
          {
            id: "codex-home:alpha",
            rootId: ROOT.id,
            name: "alpha",
            path: "/tmp/alpha",
            modifiedAtMs: 20,
            contentHash: "same",
            isSymlink: false
          },
          {
            id: "codex-home:beta",
            rootId: ROOT.id,
            name: "beta",
            path: "/tmp/beta",
            modifiedAtMs: 30,
            contentHash: "local-new",
            isSymlink: false
          },
          {
            id: "codex-home:delta",
            rootId: ROOT.id,
            name: "delta",
            path: "/tmp/delta",
            modifiedAtMs: 10,
            contentHash: "only-local",
            isSymlink: false
          }
        ])
      ],
      [
        remoteSnapshot([
          {
            id: "codex-home:alpha",
            rootId: ROOT.id,
            name: "alpha",
            repoPath: "roots/codex-home/alpha",
            modifiedAtMs: 20,
            contentHash: "same"
          },
          {
            id: "codex-home:beta",
            rootId: ROOT.id,
            name: "beta",
            repoPath: "roots/codex-home/beta",
            modifiedAtMs: 10,
            contentHash: "remote-old"
          },
          {
            id: "codex-home:gamma",
            rootId: ROOT.id,
            name: "gamma",
            repoPath: "roots/codex-home/gamma",
            modifiedAtMs: 40,
            contentHash: "remote-new"
          }
        ])
      ],
      { "codex-home:delta": true }
    );

    const rows = Object.fromEntries(groups[0].rows.map((row) => [row.name, row]));
    expect(rows.alpha.state).toBe("in-sync");
    expect(rows.beta.state).toBe("local-changed");
    expect(rows.gamma.state).toBe("only-remote");
    expect(rows.delta.state).toBe("pending-delete");
  });

  it("flags only conflict and pending delete rows for review", () => {
    expect(needsReview({ state: "conflict" } as never)).toBe(true);
    expect(needsReview({ state: "pending-delete" } as never)).toBe(true);
    expect(needsReview({ state: "local-changed" } as never)).toBe(false);
  });

  it("expires pending-delete tombstones when recreated content no longer matches", () => {
    const groups = buildRootGroups(
      [ROOT],
      [
        localSnapshot([
          {
            id: "codex-home:alpha",
            rootId: ROOT.id,
            name: "alpha",
            path: "/tmp/alpha",
            modifiedAtMs: 50,
            contentHash: "recreated-local",
            isSymlink: false
          }
        ])
      ],
      [remoteSnapshot([])],
      { "codex-home:alpha": "old-synced-hash" }
    );

    expect(groups[0].rows[0].state).toBe("only-local");
  });

  it("stores the latest synced hash for in-sync and pending-delete rows", () => {
    const rows = buildRootGroups(
      [ROOT],
      [
        localSnapshot([
          {
            id: "codex-home:alpha",
            rootId: ROOT.id,
            name: "alpha",
            path: "/tmp/alpha",
            modifiedAtMs: 20,
            contentHash: "same",
            isSymlink: false
          },
          {
            id: "codex-home:beta",
            rootId: ROOT.id,
            name: "beta",
            path: "/tmp/beta",
            modifiedAtMs: 30,
            contentHash: "local-only",
            isSymlink: false
          }
        ])
      ],
      [
        remoteSnapshot([
          {
            id: "codex-home:alpha",
            rootId: ROOT.id,
            name: "alpha",
            repoPath: "roots/codex-home/alpha",
            modifiedAtMs: 20,
            contentHash: "same"
          }
        ])
      ],
      { "codex-home:beta": "local-only" }
    )[0].rows;

    const current: KnownSyncedEntries = {
      "codex-home:legacy": true
    };

    expect(reconcileKnownSyncedEntries(current, rows, ["codex-home:alpha"])).toEqual({
      "codex-home:alpha": "same",
      "codex-home:legacy": true
    });
  });
});
