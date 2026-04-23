import { structuredPatch } from "diff";
import type { SkillDiffFile, SkillRow } from "./types";

export type CompareLoadState = "idle" | "loading" | "ready" | "error";
export type RenderedDiffLineKind = "context" | "added" | "removed" | "meta";

export interface RenderedDiffLine {
  key: string;
  prefix: string;
  content: string;
  kind: RenderedDiffLineKind;
}

export interface RenderedDiffHunk {
  key: string;
  header: string;
  lines: RenderedDiffLine[];
}

export function shouldShowCompare(row?: SkillRow | null) {
  return Boolean(row && row.state !== "in-sync");
}

export function buildSkillDiffCacheKey(row: SkillRow) {
  return [
    row.id,
    row.local?.contentHash ?? "missing-local",
    row.remote?.contentHash ?? "missing-remote"
  ].join("::");
}

export function pickInitialDiffFilePath(files: SkillDiffFile[]) {
  return files[0]?.path ?? "";
}

export function buildRenderedDiffHunks(file: SkillDiffFile): RenderedDiffHunk[] {
  if (file.isBinary) {
    return [];
  }

  const patch = structuredPatch(
    "Remote",
    "Local",
    file.remoteText ?? "",
    file.localText ?? "",
    "",
    "",
    { context: 3 }
  );

  return patch.hunks.map((hunk, hunkIndex) => ({
    key: `${file.path}-hunk-${hunkIndex}`,
    header: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
    lines: hunk.lines.map((line, lineIndex) => {
      const prefix = line[0] ?? " ";
      const kind =
        prefix === "+"
          ? "added"
          : prefix === "-"
            ? "removed"
            : prefix === "\\"
              ? "meta"
              : "context";

      return {
        key: `${file.path}-line-${hunkIndex}-${lineIndex}`,
        prefix,
        content: prefix === "\\" ? line : line.slice(1),
        kind
      };
    })
  }));
}
