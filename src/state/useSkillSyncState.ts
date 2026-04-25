import { useEffect, useMemo, useState, useTransition } from "react";
import {
  fallbackLocalSnapshots,
  fallbackRemoteSnapshot,
  fallbackRoots,
  fallbackSkillDiff
} from "../lib/fallback";
import {
  buildSkillDiffCacheKey,
  pickInitialDiffFilePath,
  shouldShowCompare,
  type CompareLoadState
} from "../lib/compare";
import {
  canWriteToRepository,
  findGitHubRepository,
  parseGitHubRepositoryUrl,
  resolvePreferredOwner,
  shouldUseGitHubPicker
} from "../lib/github";
import { getMessages } from "../lib/i18n";
import { MENU_COMMAND_EVENT, type MenuCommand } from "../lib/menu";
import {
  countLocalSkills,
  countRemoteSkills,
  isFirstBackupRecommended,
  resolveOnboardingStep
} from "../lib/onboarding";
import {
  mergeRootConfigs,
  readDefaultInstallRoots,
  readKnownSyncedIds,
  readBuiltInRootOverrides,
  readLastGitHubOwner,
  readOnboardingDismissed,
  readRepoUrl,
  readRootConfigs,
  writeKnownSyncedIds,
  writeLastGitHubOwner,
  writeOnboardingDismissed,
  writeRepoUrl
} from "../lib/persistence";
import {
  flattenSkillRows,
  buildRootGroups,
  needsReview,
  reconcileKnownSyncedEntries
} from "../lib/status";
import {
  discoverRoots,
  loadGitHubOwners,
  loadGitHubRepositories,
  loadGitHubStatus,
  loadRemoteSnapshot,
  loadSkillDiff,
  PREVIEW_RUNTIME_ERROR,
  scanLocalRoots,
  syncSelectedItems,
  validateGitHubRepository,
  createGitHubRepository
} from "../lib/tauri";
import {
  isReviewDecisionAllowed,
  syncActionFromReviewDecision,
  type ReviewDecision
} from "../lib/syncDecisions";
import { isTauriRuntime } from "../lib/windowing";
import type {
  AppPreferences,
  GitHubOwner,
  GitHubRepository,
  GitHubRepositoryValidation,
  GitHubStatus,
  IgnoredSkillEntries,
  LocalRootSnapshot,
  RemoteScanPayload,
  RemoteRootSnapshot,
  SkillDiffPayload,
  SkillListRow,
  SkillRootConfig,
  SyncOperation,
  SyncState
} from "../lib/types";

export type MainFilter =
  | "actionable"
  | "changed"
  | "conflicts"
  | "pending-delete"
  | "ignored"
  | "all";
type LoadIntent = "startup" | "refresh" | "repository" | "sync";

const FALLBACK_GITHUB_STATUS: GitHubStatus = {
  cliAvailable: false,
  authenticated: false
};
const DEFAULT_GITHUB_REPOSITORY_NAME = "skillsync-skills";

function isPreviewRuntimeError(error: unknown) {
  return String(error).includes(PREVIEW_RUNTIME_ERROR);
}

function matchesFilter(state: SyncState, filter: Exclude<MainFilter, "ignored">) {
  switch (filter) {
    case "actionable":
      return state !== "in-sync";
    case "changed":
      return (
        state === "local-changed" ||
        state === "remote-changed" ||
        state === "only-local" ||
        state === "only-remote"
      );
    case "conflicts":
      return state === "conflict";
    case "pending-delete":
      return state === "pending-delete";
    default:
      return true;
  }
}

function createLoadLogger(label: string) {
  const startedAt = performance.now();
  let checkpoint = startedAt;

  function step(message: string) {
    const now = performance.now();
    const delta = Math.round(now - checkpoint);
    const total = Math.round(now - startedAt);
    checkpoint = now;
    const entry = `${label}: ${message} (+${delta}ms, ${total}ms total)`;
    console.info(`[SkillSync] ${entry}`);
    return entry;
  }

  return { step };
}

export function useSkillSyncState(preferences: AppPreferences) {
  const messages = getMessages(preferences.language);
  const [rootConfigs, setRootConfigs] = useState<SkillRootConfig[]>([]);
  const [localSnapshots, setLocalSnapshots] = useState<LocalRootSnapshot[]>([]);
  const [remoteSnapshots, setRemoteSnapshots] = useState<RemoteRootSnapshot[]>([]);
  const [repoUrl, setRepoUrl] = useState(readRepoUrl);
  const [notes, setNotes] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [knownSyncedIds, setKnownSyncedIds] = useState(readKnownSyncedIds);
  const [ignoredSkillIds, setIgnoredSkillIds] = useState<IgnoredSkillEntries>({});
  const [selectedRowId, setSelectedRowId] = useState<string>("");
  const [reviewDecisions, setReviewDecisions] = useState<Record<string, ReviewDecision | undefined>>({});
  const [onboardingDismissed, setOnboardingDismissed] = useState(readOnboardingDismissed);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [creatingRepository, setCreatingRepository] = useState(false);
  const [filter, setFilter] = useState<MainFilter>("actionable");
  const [githubStatus, setGitHubStatus] = useState<GitHubStatus>(FALLBACK_GITHUB_STATUS);
  const [githubOwners, setGitHubOwners] = useState<GitHubOwner[]>([]);
  const [selectedOwner, setSelectedOwnerState] = useState(readLastGitHubOwner);
  const [githubRepositories, setGitHubRepositories] = useState<GitHubRepository[]>([]);
  const [repositoryLoadError, setRepositoryLoadError] = useState("");
  const [repoValidation, setRepoValidation] = useState<GitHubRepositoryValidation | null>(null);
  const [repoUrlError, setRepoUrlError] = useState("");
  const [remoteLoadError, setRemoteLoadError] = useState("");
  const [diffCache, setDiffCache] = useState<Record<string, SkillDiffPayload>>({});
  const [diffStateByKey, setDiffStateByKey] = useState<Record<string, CompareLoadState>>({});
  const [diffErrorByKey, setDiffErrorByKey] = useState<Record<string, string>>({});
  const [selectedDiffFilePath, setSelectedDiffFilePath] = useState("");
  const [loadIntent, setLoadIntent] = useState<LoadIntent | null>("startup");
  const [refreshing, startRefresh] = useTransition();
  const [syncing, startSync] = useTransition();
  const [loadingRepositories, startRepositoryLoad] = useTransition();

  function clearCompareState() {
    setDiffCache({});
    setDiffStateByKey({});
    setDiffErrorByKey({});
    setSelectedDiffFilePath("");
  }

  async function loadGitHubContext(localRepoUrl: string, ownerOverride?: string) {
    let nextStatus = FALLBACK_GITHUB_STATUS;
    const nextNotes: string[] = [];
    let nextOwners: GitHubOwner[] = [];
    let nextRepositories: GitHubRepository[] = [];
    let nextRepositoryLoadError = "";
    let nextValidation: GitHubRepositoryValidation | null = null;
    let nextRepoError = "";

    try {
      nextStatus = await loadGitHubStatus();
    } catch (error) {
      if (!isPreviewRuntimeError(error)) {
        nextNotes.push(String(error));
      }
    }

    const usesPicker = shouldUseGitHubPicker(nextStatus);

    if (usesPicker) {
      try {
        nextOwners = await loadGitHubOwners();
      } catch (error) {
        nextNotes.push(String(error));
      }

      const nextOwner = resolvePreferredOwner({
        owners: nextOwners,
        storedOwner: ownerOverride ?? readLastGitHubOwner(),
        repoUrl: localRepoUrl,
        username: nextStatus.username
      });

      setSelectedOwnerState(nextOwner);
      writeLastGitHubOwner(nextOwner);

      if (nextOwner) {
        try {
          nextRepositories = await loadGitHubRepositories(nextOwner);
        } catch (error) {
          nextRepositoryLoadError = String(error);
          nextNotes.push(nextRepositoryLoadError);
        }
      }

      if (localRepoUrl.trim()) {
        try {
          nextValidation = await validateGitHubRepository({ repoUrl: localRepoUrl });
        } catch (error) {
          nextRepoError = String(error);
        }
      }
    } else {
      setSelectedOwnerState("");
      writeLastGitHubOwner("");

      if (localRepoUrl.trim()) {
        nextValidation = parseGitHubRepositoryUrl(localRepoUrl);
        if (!nextValidation) {
          nextRepoError = messages.repoUrlInvalidNote;
        }
      }

      if (nextStatus.note && !isPreviewRuntimeError(nextStatus.note)) {
        nextNotes.push(nextStatus.note);
      }
    }

    setGitHubStatus(nextStatus);
    setGitHubOwners(nextOwners);
    setGitHubRepositories(nextRepositories);
    setRepositoryLoadError(nextRepositoryLoadError);
    setRepoValidation(nextValidation);
    setRepoUrlError(nextRepoError);

    return {
      usesPicker,
      notes: nextNotes,
      repoError: nextRepoError
    };
  }

  async function loadAll(
    overrideRoots?: SkillRootConfig[],
    overrideRepoUrl?: string,
    ownerOverride?: string,
    intent?: LoadIntent
  ) {
    if (intent) {
      setLoadIntent(intent);
    }

    const logger = createLoadLogger(
      overrideRoots || overrideRepoUrl !== undefined || ownerOverride ? "Reload" : "Startup"
    );
    const localRepoUrl = overrideRepoUrl ?? repoUrl;
    clearCompareState();
    const customRoots = readRootConfigs();
    const builtInOverrides = readBuiltInRootOverrides();
    let discovered = fallbackRoots();
    let mergedRoots = overrideRoots ?? mergeRootConfigs(fallbackRoots().roots, customRoots, builtInOverrides);
    let local = fallbackLocalSnapshots(mergedRoots);
    let remote: RemoteScanPayload = {
      roots: remoteSnapshots,
      notes: [],
      ignoredSkillIds
    };
    let nextRemoteLoadError = "";
    const mergedNotes: string[] = [];

    const githubPromise = loadGitHubContext(localRepoUrl, ownerOverride);

    try {
      discovered = await discoverRoots();
      mergedNotes.push(...discovered.notes);
      mergedNotes.push(logger.step(`discovered ${discovered.roots.length} root(s)`));
    } catch (error) {
      if (!isPreviewRuntimeError(error)) {
        mergedNotes.push(String(error));
      }
    }

    mergedRoots = overrideRoots ?? mergeRootConfigs(discovered.roots, customRoots, builtInOverrides);
    setRootConfigs(mergedRoots);

    try {
      local = await scanLocalRoots(mergedRoots);
      mergedNotes.push(logger.step(`scanned ${local.length} local root snapshot(s)`));
    } catch (error) {
      if (!isPreviewRuntimeError(error)) {
        mergedNotes.push(String(error));
      }
      local = fallbackLocalSnapshots(mergedRoots);
    }

    setLocalSnapshots(local);
    setRemoteSnapshots([]);
    setNotes([...mergedNotes]);

    const github = await githubPromise;
    mergedNotes.push(...github.notes);
    mergedNotes.push(logger.step("loaded GitHub context"));

    if (localRepoUrl.trim() && !github.repoError) {
      try {
        const payload = await loadRemoteSnapshot(localRepoUrl, mergedRoots);
        remote = payload;
        mergedNotes.push(...payload.notes);
        mergedNotes.push(logger.step(`loaded ${payload.roots.length} remote root snapshot(s)`));
      } catch (error) {
        if (isPreviewRuntimeError(error)) {
          remote = fallbackRemoteSnapshot(mergedRoots);
        } else {
          nextRemoteLoadError = String(error);
          mergedNotes.push(nextRemoteLoadError);
        }
      }
    } else if (github.repoError) {
      remote = { roots: [], notes: [github.repoError], ignoredSkillIds: {} };
      nextRemoteLoadError = github.repoError;
    } else {
      remote = { roots: [], notes: [messages.missingRepoNote], ignoredSkillIds: {} };
    }

    setLocalSnapshots(local);
    setRemoteSnapshots(remote.roots);
    setIgnoredSkillIds(remote.ignoredSkillIds);
    setRemoteLoadError(nextRemoteLoadError);
    setNotes(mergedNotes.concat(remote.notes));
    setLoadIntent((current) =>
      current === (intent ?? "startup") ? null : current
    );

    return {
      rootConfigs: mergedRoots,
      localSnapshots: local,
      remoteSnapshots: remote.roots
    };
  }

  // Keep the in-flight request alive across the "idle" -> "loading" state flip.
  useEffect(() => {
    void loadAll(undefined, readRepoUrl(), undefined, "startup");
  }, []);

  useEffect(() => {
    writeRepoUrl(repoUrl);
  }, [repoUrl]);

  useEffect(() => {
    writeOnboardingDismissed(onboardingDismissed);
  }, [onboardingDismissed]);

  useEffect(() => {
    const syncFromStorage = () => {
      setRepoUrl(readRepoUrl());
      setKnownSyncedIds(readKnownSyncedIds());
      setSelectedOwnerState(readLastGitHubOwner());
      setOnboardingDismissed(readOnboardingDismissed());
      void loadAll(undefined, undefined, undefined, "refresh");
    };

    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener("storage", syncFromStorage);
    };
  }, [repoUrl, preferences.language]);

  const groups = useMemo(
    () => buildRootGroups(rootConfigs, localSnapshots, remoteSnapshots, knownSyncedIds),
    [rootConfigs, localSnapshots, remoteSnapshots, knownSyncedIds]
  );

  const allRows = useMemo(() => flattenSkillRows(groups), [groups]);
  const unignoredRows = useMemo(
    () => allRows.filter((item) => !ignoredSkillIds[item.row.id]),
    [allRows, ignoredSkillIds]
  );
  const ignoredCount = useMemo(
    () => allRows.filter((item) => ignoredSkillIds[item.row.id]).length,
    [allRows, ignoredSkillIds]
  );
  const localSkillCount = useMemo(() => countLocalSkills(localSnapshots), [localSnapshots]);
  const remoteSkillCount = useMemo(() => countRemoteSkills(remoteSnapshots), [remoteSnapshots]);

  const filteredRows = useMemo(
    () => {
      if (filter === "ignored") {
        return allRows.filter((item) => ignoredSkillIds[item.row.id]);
      }

      return unignoredRows.filter((item) => matchesFilter(item.row.state, filter));
    },
    [allRows, filter, ignoredSkillIds, unignoredRows]
  );

  useEffect(() => {
    if (!filteredRows.length) {
      setSelectedRowId("");
      return;
    }

    if (!filteredRows.some((item) => item.row.id === selectedRowId)) {
      setSelectedRowId(filteredRows[0].row.id);
    }
  }, [filteredRows, selectedRowId]);

  const selectedItem =
    filteredRows.find((item) => item.row.id === selectedRowId) ??
    null;
  const selectedCompareKey =
    showAdvancedDetails && selectedItem && shouldShowCompare(selectedItem.row)
      ? buildSkillDiffCacheKey(selectedItem.row)
      : "";
  const selectedCompare =
    selectedCompareKey ? diffCache[selectedCompareKey] ?? null : null;
  const selectedCompareState =
    selectedCompareKey ? diffStateByKey[selectedCompareKey] ?? "idle" : "idle";
  const selectedCompareError =
    selectedCompareKey ? diffErrorByKey[selectedCompareKey] ?? "" : "";

  useEffect(() => {
    setSelectedDiffFilePath("");
  }, [selectedCompareKey]);

  useEffect(() => {
    if (!selectedCompare?.files.length) {
      return;
    }

    setSelectedDiffFilePath((current) =>
      current && selectedCompare.files.some((file) => file.path === current)
        ? current
        : pickInitialDiffFilePath(selectedCompare.files)
    );
  }, [selectedCompare]);

  useEffect(() => {
    if (!selectedItem || !selectedCompareKey || !shouldShowCompare(selectedItem.row)) {
      return;
    }

    if (selectedCompareState === "loading" || selectedCompareState === "ready") {
      return;
    }

    let disposed = false;

    setDiffStateByKey((current) => ({
      ...current,
      [selectedCompareKey]: "loading"
    }));
    setDiffErrorByKey((current) => ({
      ...current,
      [selectedCompareKey]: ""
    }));

    void (async () => {
      try {
        let payload: SkillDiffPayload;

        try {
          payload = await loadSkillDiff(
            repoUrl,
            rootConfigs,
            selectedItem.root.id,
            selectedItem.row.name
          );
        } catch (error) {
          if (isPreviewRuntimeError(error)) {
            payload = fallbackSkillDiff(selectedItem.row);
          } else {
            throw error;
          }
        }

        if (disposed) {
          return;
        }

        setDiffCache((current) => ({
          ...current,
          [selectedCompareKey]: payload
        }));
        setDiffStateByKey((current) => ({
          ...current,
          [selectedCompareKey]: "ready"
        }));
      } catch (error) {
        if (disposed) {
          return;
        }

        setDiffStateByKey((current) => ({
          ...current,
          [selectedCompareKey]: "error"
        }));
        setDiffErrorByKey((current) => ({
          ...current,
          [selectedCompareKey]: String(error)
        }));
      }
    })();

    return () => {
      disposed = true;
    };
  }, [
    repoUrl,
    rootConfigs,
    selectedCompareKey,
    selectedItem
  ]);

  const counts = useMemo(
    () => ({
      all: unignoredRows.length,
      ignored: ignoredCount,
      actionable: remoteLoadError
        ? 0
        : unignoredRows.filter((item) => matchesFilter(item.row.state, "actionable")).length,
      changed: remoteLoadError
        ? 0
        : unignoredRows.filter((item) => matchesFilter(item.row.state, "changed")).length,
      conflicts: remoteLoadError
        ? 0
        : unignoredRows.filter((item) => item.row.state === "conflict").length,
      "pending-delete": remoteLoadError
        ? 0
        : unignoredRows.filter((item) => item.row.state === "pending-delete").length
    }),
    [ignoredCount, remoteLoadError, unignoredRows]
  );
  const rowsNeedingAction = useMemo(
    () =>
      remoteLoadError
        ? []
        : unignoredRows.filter((item) => item.row.state !== "in-sync"),
    [remoteLoadError, unignoredRows]
  );
  const reviewRequiredCount = useMemo(
    () =>
      rowsNeedingAction.filter(
        (item) =>
          needsReview(item.row) &&
          !isReviewDecisionAllowed(item.row, reviewDecisions[item.row.id])
      ).length,
    [rowsNeedingAction, reviewDecisions]
  );

  const usesGitHubPicker = shouldUseGitHubPicker(githubStatus);
  const selectedRepository = findGitHubRepository(githubRepositories, repoUrl);
  const selectedPermission =
    repoValidation?.viewerPermission ?? selectedRepository?.viewerPermission;
  const syncBlockedByPermission =
    Boolean(selectedPermission) && !canWriteToRepository(selectedPermission);

  function toggleSkill(rowId: string) {
    if (ignoredSkillIds[rowId]) {
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }

  function setSelectedSkill(rowId: string) {
    setSelectedRowId(rowId);
  }

  function selectAllVisible(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      filteredRows.forEach((item) => {
        if (ignoredSkillIds[item.row.id]) {
          return;
        }

        if (checked) {
          next.add(item.row.id);
        } else {
          next.delete(item.row.id);
        }
      });
      return next;
    });
  }

  function setReviewDecision(rowId: string, decision: ReviewDecision) {
    setReviewDecisions((current) => ({
      ...current,
      [rowId]: decision
    }));
  }

  function selectedRowsList(): SkillListRow[] {
    return unignoredRows.filter((item) => selectedIds.has(item.row.id));
  }

  function syncTrackingRule(rowId: string, action: "ignore-remote" | "unignore") {
    if (!repoUrl.trim()) {
      setNotes((current) => current.concat(messages.repoRequiredAlert));
      return;
    }

    if (repoUrlError) {
      setNotes((current) => current.concat(repoUrlError));
      return;
    }

    if (syncBlockedByPermission) {
      setNotes((current) => current.concat(messages.syncDisabledReadOnlyNote));
      return;
    }

    if (remoteLoadError) {
      setNotes((current) => current.concat(remoteLoadError));
      return;
    }

    const item = allRows.find((candidate) => candidate.row.id === rowId);
    if (!item) {
      setNotes((current) => current.concat(`Cannot find skill row: ${rowId}`));
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(rowId);
      return next;
    });
    setReviewDecisions((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });

    startSync(() => {
      void runSync([
        {
          rowId: item.row.id,
          rootId: item.row.rootId,
          skillName: item.row.name,
          action
        }
      ]);
    });
  }

  function ignoreSkill(rowId: string) {
    syncTrackingRule(rowId, "ignore-remote");
  }

  function restoreIgnoredSkill(rowId: string) {
    syncTrackingRule(rowId, "unignore");
  }

  function setManualRepoUrl(value: string) {
    setRepoUrl(value);

    if (!value.trim()) {
      setRepoValidation(null);
      setRepoUrlError("");
      return;
    }

    const parsed = parseGitHubRepositoryUrl(value);
    setRepoValidation(parsed);
    setRepoUrlError(parsed ? "" : messages.repoUrlInvalidNote);
  }

  function chooseOwner(nextOwner: string) {
    setSelectedOwnerState(nextOwner);
    writeLastGitHubOwner(nextOwner);
    setGitHubRepositories([]);
    setRepositoryLoadError("");
    setRepoValidation(null);
    setRepoUrl("");
    setRepoUrlError("");

    startRepositoryLoad(() => {
      void loadAll(rootConfigs, "", nextOwner, "repository");
    });
  }

  function chooseRepository(fullName: string) {
    const repository =
      githubRepositories.find((item) => item.fullName === fullName) ?? null;
    if (!repository) {
      return;
    }

    const validation: GitHubRepositoryValidation = {
      fullName: repository.fullName,
      url: repository.url,
      sshUrl: repository.sshUrl,
      viewerPermission: repository.viewerPermission
    };

    setRepoValidation(validation);
    setRepoUrlError("");
    setRepoUrl(repository.url);

    startRefresh(() => {
      void loadAll(rootConfigs, repository.url, repository.owner, "repository");
    });
  }

  async function createDefaultRepository() {
    if (!githubStatus.cliAvailable || !githubStatus.authenticated) {
      setNotes((current) => current.concat(messages.githubLoginRequiredCopy));
      return;
    }

    setCreatingRepository(true);
    try {
      const validation = await createGitHubRepository({
        name: DEFAULT_GITHUB_REPOSITORY_NAME,
        private: true
      });
      const owner = validation.fullName.split("/")[0] ?? "";

      setRepoValidation(validation);
      setRepoUrlError("");
      setRepoUrl(validation.url);
      setSelectedOwnerState(owner);
      writeLastGitHubOwner(owner);
      setOnboardingDismissed(false);
      await loadAll(rootConfigs, validation.url, owner, "repository");
    } catch (error) {
      setNotes((current) => current.concat(String(error)));
    } finally {
      setCreatingRepository(false);
    }
  }

  async function runSync(operations: SyncOperation[]) {
    if (!operations.length) {
      setNotes((current) => current.concat(messages.nothingSelectedNote));
      return;
    }

    try {
      const result = await syncSelectedItems(repoUrl, rootConfigs, operations);
      setRemoteSnapshots((current) =>
        result.remoteRoots.length ? result.remoteRoots : current
      );
      setIgnoredSkillIds(result.ignoredSkillIds);
      setNotes((current) => current.concat(result.notes));
      setSelectedIds(new Set());
      setReviewDecisions({});
      const refreshed = await loadAll(rootConfigs, repoUrl, selectedOwner, "sync");
      const refreshedRows = flattenSkillRows(
        buildRootGroups(
          refreshed.rootConfigs,
          refreshed.localSnapshots,
          refreshed.remoteSnapshots,
          knownSyncedIds
        )
      ).map((item) => item.row);
      const nextSynced = reconcileKnownSyncedEntries(
        knownSyncedIds,
        refreshedRows,
        result.syncedRowIds
      );
      setKnownSyncedIds(nextSynced);
      writeKnownSyncedIds(nextSynced);
    } catch (error) {
      setNotes((current) => current.concat(String(error)));
    }
  }

  function buildOperationsForRows(rows: SkillListRow[]) {
    const unresolved = rows.filter(
      (item) =>
        needsReview(item.row) &&
        !isReviewDecisionAllowed(item.row, reviewDecisions[item.row.id])
    );
    const operations: SyncOperation[] = [];

    rows.forEach((item) => {
      if (needsReview(item.row)) {
        const action = syncActionFromReviewDecision(item.row, reviewDecisions[item.row.id]);
        if (!action) {
          return;
        }

        operations.push({
          rowId: item.row.id,
          rootId: item.row.rootId,
          skillName: item.row.name,
          action
        });
        return;
      }

      if (item.row.recommendedAction) {
        operations.push({
          rowId: item.row.id,
          rootId: item.row.rootId,
          skillName: item.row.name,
          action: item.row.recommendedAction
        });
      }
    });

    return { unresolved, operations };
  }

  function syncRows(rows: SkillListRow[]) {
    if (!repoUrl.trim()) {
      setNotes((current) => current.concat(messages.repoRequiredAlert));
      return;
    }

    if (repoUrlError) {
      setNotes((current) => current.concat(repoUrlError));
      return;
    }

    if (syncBlockedByPermission) {
      setNotes((current) => current.concat(messages.syncDisabledReadOnlyNote));
      return;
    }

    if (!rows.length) {
      setNotes((current) => current.concat(messages.nothingSelectedNote));
      return;
    }

    const { unresolved, operations } = buildOperationsForRows(rows);

    if (unresolved.length > 0) {
      setSelectedRowId(unresolved[0].row.id);
      setSelectedIds(new Set(rows.map((item) => item.row.id)));
      setNotes((current) =>
        current.concat(messages.reviewRequiredNote(unresolved.length))
      );
      return;
    }

    startSync(() => {
      void runSync(operations);
    });
  }

  function syncSelected() {
    syncRows(selectedRowsList());
  }

  function syncSuggested() {
    setSelectedIds(new Set(rowsNeedingAction.map((item) => item.row.id)));
    syncRows(rowsNeedingAction);
  }

  function refresh() {
    startRefresh(() => {
      void loadAll(undefined, repoUrl, selectedOwner, "refresh");
    });
  }

  const recentNotes = notes.slice(-8).reverse();
  const selectedCount = unignoredRows.filter((item) => selectedIds.has(item.row.id)).length;
  const selectableVisibleCount = filteredRows.filter(
    (item) => !ignoredSkillIds[item.row.id]
  ).length;
  const visibleSelectedCount = filteredRows.filter(
    (item) => !ignoredSkillIds[item.row.id] && selectedIds.has(item.row.id)
  ).length;
  const allVisibleSelected =
    selectableVisibleCount > 0 && visibleSelectedCount === selectableVisibleCount;
  const canSync =
    Boolean(repoUrl.trim()) && !repoUrlError && !syncBlockedByPermission && !remoteLoadError;
  const firstBackupRecommended = isFirstBackupRecommended({
    repoUrl,
    repoUrlError,
    localSkillCount,
    remoteSkillCount
  });
  const onboardingStep = resolveOnboardingStep({
    dismissed: onboardingDismissed,
    repoUrl,
    repoUrlError,
    localSkillCount,
    remoteSkillCount
  });

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const unsubscribe = await listen<MenuCommand>(MENU_COMMAND_EVENT, (event) => {
        if (event.payload === "refresh") {
          refresh();
        }

        if (event.payload === "sync-selected") {
          syncSelected();
        }
      });

      if (disposed) {
        unsubscribe();
        return;
      }

      unlisten = unsubscribe;
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [repoUrl, selectedOwner, repoUrlError, syncBlockedByPermission, selectedIds, reviewDecisions]);

  return {
    messages,
    repoUrl,
    setRepoUrl,
    setManualRepoUrl,
    repoUrlError,
    repoValidation,
    usesGitHubPicker,
    githubStatus,
    githubOwners,
    githubRepositories,
    selectedOwner,
    chooseOwner,
    chooseRepository,
    createDefaultRepository,
    creatingRepository,
    defaultRepositoryName: DEFAULT_GITHUB_REPOSITORY_NAME,
    selectedRepository,
    selectedPermission,
    loadingRepositories: loadingRepositories || loadIntent === "repository",
    loadIntent,
    startupLoading: loadIntent === "startup",
    checking:
      loadIntent === "startup" ||
      loadIntent === "refresh" ||
      loadIntent === "repository",
    repositoryLoadError,
    remoteLoadError,
    filter,
    setFilter,
    counts,
    ignoredSkillIds,
    ignoredCount,
    localSkillCount,
    remoteSkillCount,
    rowsNeedingAction,
    reviewRequiredCount,
    allRows,
    filteredRows,
    selectedIds,
    selectedCount,
    allVisibleSelected,
    toggleSkill,
    selectAllVisible,
    selectedRowId,
    setSelectedSkill,
    selectedItem,
    selectedCompare,
    selectedCompareLoading:
      Boolean(selectedCompareKey) &&
      (selectedCompareState === "loading" || selectedCompareState === "idle"),
    selectedCompareError,
    selectedDiffFilePath,
    setSelectedDiffFilePath,
    recentNotes,
    reviewDecisions,
    setReviewDecision,
    ignoreSkill,
    restoreIgnoredSkill,
    syncSelected,
    syncSuggested,
    refresh,
    refreshing: refreshing || loadIntent === "refresh",
    syncing,
    canSync,
    syncBlockedByPermission,
    onboardingDismissed,
    setOnboardingDismissed,
    onboardingStep,
    firstBackupRecommended,
    showAdvancedDetails,
    setShowAdvancedDetails,
    defaultInstallRoots: readDefaultInstallRoots()
  };
}
