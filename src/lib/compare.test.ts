import { describe, expect, it } from "vitest";
import {
  buildRenderedDiffHunks,
  buildSkillDiffCacheKey,
  pickInitialDiffFilePath,
  shouldShowCompare
} from "./compare";
import type { SkillDiffFile, SkillRow } from "./types";

function buildRow(overrides: Partial<SkillRow> = {}): SkillRow {
  return {
    id: "codex-home:alpha",
    rootId: "codex-home",
    name: "alpha",
    state: "local-changed",
    local: {
      id: "codex-home:alpha",
      rootId: "codex-home",
      name: "alpha",
      path: "/tmp/alpha",
      modifiedAtMs: 20,
      contentHash: "local-hash",
      isSymlink: false
    },
    remote: {
      id: "codex-home:alpha",
      rootId: "codex-home",
      name: "alpha",
      repoPath: "roots/codex-home/alpha",
      modifiedAtMs: 10,
      contentHash: "remote-hash"
    },
    ...overrides
  };
}

describe("compare helpers", () => {
  it("builds unified diff hunks with added and removed lines", () => {
    const file: SkillDiffFile = {
      path: "SKILL.md",
      change: "modified",
      isBinary: false,
      remoteText: "# Skill\nOld line\n",
      localText: "# Skill\nNew line\n"
    };

    const hunks = buildRenderedDiffHunks(file);
    const lines = hunks.flatMap((hunk) => hunk.lines);

    expect(hunks.length).toBeGreaterThan(0);
    expect(lines.some((line) => line.kind === "removed" && line.content === "Old line")).toBe(
      true
    );
    expect(lines.some((line) => line.kind === "added" && line.content === "New line")).toBe(
      true
    );
  });

  it("returns no hunks for binary files", () => {
    expect(
      buildRenderedDiffHunks({
        path: "assets/reference.bin",
        change: "modified",
        isBinary: true
      })
    ).toEqual([]);
  });

  it("uses the first changed file as the default selection", () => {
    expect(
      pickInitialDiffFilePath([
        { path: "SKILL.md", change: "modified", isBinary: false },
        { path: "notes.md", change: "added", isBinary: false }
      ])
    ).toBe("SKILL.md");
  });

  it("builds cache keys from both local and remote hashes", () => {
    const row = buildRow();
    const originalKey = buildSkillDiffCacheKey(row);
    const updatedKey = buildSkillDiffCacheKey(
      buildRow({
        local: {
          ...row.local!,
          contentHash: "local-hash-v2"
        }
      })
    );

    expect(originalKey).not.toBe(updatedKey);
  });

  it("skips compare for in-sync rows", () => {
    expect(shouldShowCompare(buildRow({ state: "in-sync" }))).toBe(false);
    expect(shouldShowCompare(buildRow({ state: "only-local" }))).toBe(true);
  });
});
