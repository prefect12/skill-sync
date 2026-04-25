import type { LocalRootSnapshot, OnboardingStep, RemoteRootSnapshot } from "./types";

export function countLocalSkills(snapshots: LocalRootSnapshot[]) {
  return snapshots.reduce((total, root) => total + root.skills.length, 0);
}

export function countRemoteSkills(snapshots: RemoteRootSnapshot[]) {
  return snapshots.reduce((total, root) => total + root.skills.length, 0);
}

export function isFirstBackupRecommended({
  repoUrl,
  repoUrlError,
  localSkillCount,
  remoteSkillCount
}: {
  repoUrl: string;
  repoUrlError: string;
  localSkillCount: number;
  remoteSkillCount: number;
}) {
  return Boolean(repoUrl.trim()) && !repoUrlError && localSkillCount > 0 && remoteSkillCount === 0;
}

export function resolveOnboardingStep({
  dismissed,
  repoUrl,
  repoUrlError,
  localSkillCount,
  remoteSkillCount
}: {
  dismissed: boolean;
  repoUrl: string;
  repoUrlError: string;
  localSkillCount: number;
  remoteSkillCount: number;
}): OnboardingStep {
  if (dismissed) {
    return "done";
  }

  if (localSkillCount === 0) {
    return "discover";
  }

  if (!repoUrl.trim() || repoUrlError) {
    return "connect";
  }

  if (
    isFirstBackupRecommended({
      repoUrl,
      repoUrlError,
      localSkillCount,
      remoteSkillCount
    })
  ) {
    return "backup";
  }

  return "done";
}
