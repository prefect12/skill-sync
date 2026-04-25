import type { SkillRow, SyncOperationType } from "./types";

export type ReviewDecision = SyncOperationType | "skip";

export function getReviewDecisionActions(row: SkillRow): ReviewDecision[] {
  if (row.state === "conflict") {
    return ["push", "pull", "skip"];
  }

  if (row.state !== "pending-delete") {
    return [];
  }

  if (row.local && !row.remote) {
    return ["push", "delete-local", "skip"];
  }

  if (!row.local && row.remote) {
    return ["restore-local", "delete-remote", "skip"];
  }

  return ["skip"];
}

export function isReviewDecisionAllowed(
  row: SkillRow,
  decision: ReviewDecision | undefined
) {
  return decision !== undefined && getReviewDecisionActions(row).includes(decision);
}

export function syncActionFromReviewDecision(
  row: SkillRow,
  decision: ReviewDecision | undefined
) {
  if (!isReviewDecisionAllowed(row, decision) || decision === "skip") {
    return undefined;
  }

  return decision;
}
