import { describe, expect, it } from "vitest";
import {
  getReviewDecisionActions,
  syncActionFromReviewDecision
} from "./syncDecisions";
import type { SkillRow } from "./types";

function row(patch: Partial<SkillRow>): SkillRow {
  return {
    id: "codex-home:alpha",
    rootId: "codex-home",
    name: "alpha",
    state: "in-sync",
    ...patch
  };
}

describe("sync decision helpers", () => {
  it("maps local-only pending deletes to upload, delete local, or skip", () => {
    const pending = row({
      state: "pending-delete",
      local: {
        id: "codex-home:alpha",
        rootId: "codex-home",
        name: "alpha",
        path: "/tmp/alpha",
        modifiedAtMs: 10,
        contentHash: "local",
        isSymlink: false
      }
    });

    expect(getReviewDecisionActions(pending)).toEqual(["push", "delete-local", "skip"]);
    expect(syncActionFromReviewDecision(pending, "pull")).toBeUndefined();
  });

  it("maps remote-only pending deletes to restore, delete remote, or skip", () => {
    const pending = row({
      state: "pending-delete",
      remote: {
        id: "codex-home:alpha",
        rootId: "codex-home",
        name: "alpha",
        repoPath: "roots/codex-home/alpha",
        modifiedAtMs: 10,
        contentHash: "remote"
      }
    });

    expect(getReviewDecisionActions(pending)).toEqual([
      "restore-local",
      "delete-remote",
      "skip"
    ]);
    expect(syncActionFromReviewDecision(pending, "push")).toBeUndefined();
  });

  it("keeps conflicts limited to choosing local, GitHub, or skip", () => {
    const conflict = row({ state: "conflict" });
    expect(getReviewDecisionActions(conflict)).toEqual(["push", "pull", "skip"]);
  });
});
