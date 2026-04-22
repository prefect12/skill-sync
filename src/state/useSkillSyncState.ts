import { useEffect, useMemo, useState, useTransition } from "react";
import { fallbackLocalSnapshots, fallbackRemoteSnapshot, fallbackRoots } from "../lib/fallback";
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
  mergeRootConfigs,
  readDefaultInstallRoots,
  readKnownSyncedIds,
  readBuiltInRootOverrides,
  readLastGitHubOwner,
  readRepoUrl,
  readRootConfigs,
  writeKnownSyncedIds,
  writeLastGitHubOwner,
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
  PREVIEW_RUNTIME_ERROR,
  scanLocalRoots,
  syncSelectedItems,
  validateGitHubRepository
} from "../lib/tauri";
import { isTauriRuntime } from "../lib/windowing";
import type {
  AppPreferences,
  GitHubOwner,
  GitHubRepository,
  GitHubRepositoryValidation,
  GitHubStatus,
  LocalRootSnapshot,
  RemoteRootSnapshot,
  SkillListRow,
  SkillRootConfig,
  SyncOperation,
  SyncOperationType,
  SyncState
} from "../lib/types";

export type MainFilter = "all" | "changed" | "conflicts" | "pending-delete";

const FALLBACK_GITHUB_STATUS: GitHubStatus = {
  cliAvailable: false,
  authenticated: false
};

function isPreviewRuntimeError(error: unknown) {
  return String(error).includes(PREVIEW_RUNTIME_ERROR);
}

function matchesFilter(state: SyncState, filter: MainFilter) {
  switch (filter) {
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
  const [selectedRowId, setSelectedRowId] = useState<string>("");
  const [reviewDecisions, setReviewDecisions] = useState<
    Record<string, SyncOperationType | "skip" | undefined>
  >({});
  const [filter, setFilter] = useState<MainFilter>("all");
  const [githubStatus, setGitHubStatus] = useState<GitHubStatus>(FALLBACK_GITHUB_STATUS);
  const [githubOwners, setGitHubOwners] = useState<GitHubOwner[]>([]);
  const [selectedOwner, setSelectedOwnerState] = useState(readLastGitHubOwner);
  const [githubRepositories, setGitHubRepositories] = useState<GitHubRepository[]>([]);
  const [repositoryLoadError, setRepositoryLoadError] = useState("");
  const [repoValidation, setRepoValidation] = useState<GitHubRepositoryValidation | null>(null);
  const [repoUrlError, setRepoUrlError] = useState("");
  const [refreshing, startRefresh] = useTransition();
  const [syncing, startSync] = useTransition();
  const [loadingRepositories, startRepositoryLoad] = useTransition();

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
    ownerOverride?: string
  ) {
    const logger = createLoadLogger(
      overrideRoots || overrideRepoUrl !== undefined || ownerOverride ? "Reload" : "Startup"
    );
    const localRepoUrl = overrideRepoUrl ?? repoUrl;
    const customRoots = readRootConfigs();
    const builtInOverrides = readBuiltInRootOverrides();
    let discovered = fallbackRoots();
    let mergedRoots = overrideRoots ?? mergeRootConfigs(fallbackRoots().roots, customRoots, builtInOverrides);
    let local = fallbackLocalSnapshots(mergedRoots);
    let remote = fallbackRemoteSnapshot(mergedRoots);
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
        if (!isPreviewRuntimeError(error)) {
          mergedNotes.push(String(error));
        }
        remote = fallbackRemoteSnapshot(mergedRoots);
      }
    } else if (github.repoError) {
      remote = { roots: [], notes: [github.repoError] };
    } else {
      remote = { roots: [], notes: [messages.missingRepoNote] };
    }

    setLocalSnapshots(local);
    setRemoteSnapshots(remote.roots);
    setNotes(mergedNotes.concat(remote.notes));

    return {
      rootConfigs: mergedRoots,
      localSnapshots: local,
      remoteSnapshots: remote.roots
    };
  }

  useEffect(() => {
    void loadAll(undefined, readRepoUrl());
  }, []);

  useEffect(() => {
    writeRepoUrl(repoUrl);
  }, [repoUrl]);

  useEffect(() => {
    const syncFromStorage = () => {
      setRepoUrl(readRepoUrl());
      setKnownSyncedIds(readKnownSyncedIds());
      setSelectedOwnerState(readLastGitHubOwner());
      void loadAll();
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

  const filteredRows = useMemo(
    () => allRows.filter((item) => matchesFilter(item.row.state, filter)),
    [allRows, filter]
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
    allRows.find((item) => item.row.id === selectedRowId) ??
    null;

  const counts = useMemo(
    () => ({
      all: allRows.length,
      changed: allRows.filter((item) => matchesFilter(item.row.state, "changed")).length,
      conflicts: allRows.filter((item) => item.row.state === "conflict").length,
      "pending-delete": allRows.filter((item) => item.row.state === "pending-delete").length
    }),
    [allRows]
  );

  const usesGitHubPicker = shouldUseGitHubPicker(githubStatus);
  const selectedRepository = findGitHubRepository(githubRepositories, repoUrl);
  const selectedPermission =
    repoValidation?.viewerPermission ?? selectedRepository?.viewerPermission;
  const syncBlockedByPermission =
    Boolean(selectedPermission) && !canWriteToRepository(selectedPermission);

  function toggleSkill(rowId: string) {
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
        if (checked) {
          next.add(item.row.id);
        } else {
          next.delete(item.row.id);
        }
      });
      return next;
    });
  }

  function setReviewDecision(rowId: string, decision: SyncOperationType | "skip") {
    setReviewDecisions((current) => ({
      ...current,
      [rowId]: decision
    }));
  }

  function selectedRowsList(): SkillListRow[] {
    return allRows.filter((item) => selectedIds.has(item.row.id));
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
      void loadAll(rootConfigs, "", nextOwner);
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
      void loadAll(rootConfigs, repository.url, repository.owner);
    });
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
      setNotes((current) => current.concat(result.notes));
      setSelectedIds(new Set());
      setReviewDecisions({});
      const refreshed = await loadAll(rootConfigs, repoUrl, selectedOwner);
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

  function syncSelected() {
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

    const selectedRows = selectedRowsList();
    const unresolved = selectedRows.filter(
      (item) => needsReview(item.row) && reviewDecisions[item.row.id] === undefined
    );

    if (unresolved.length > 0) {
      setSelectedRowId(unresolved[0].row.id);
      setNotes((current) =>
        current.concat(messages.reviewRequiredNote(unresolved.length))
      );
      return;
    }

    const operations: SyncOperation[] = [];

    selectedRows.forEach((item) => {
      if (needsReview(item.row)) {
        const decision = reviewDecisions[item.row.id];
        if (!decision || decision === "skip") {
          return;
        }
        operations.push({
          rowId: item.row.id,
          rootId: item.row.rootId,
          skillName: item.row.name,
          action: decision
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

    startSync(() => {
      void runSync(operations);
    });
  }

  function refresh() {
    startRefresh(() => {
      void loadAll(undefined, repoUrl, selectedOwner);
    });
  }

  const recentNotes = notes.slice(-8).reverse();
  const selectedCount = selectedIds.size;
  const visibleSelectedCount = filteredRows.filter((item) => selectedIds.has(item.row.id)).length;
  const allVisibleSelected =
    filteredRows.length > 0 && visibleSelectedCount === filteredRows.length;
  const canSync =
    Boolean(repoUrl.trim()) && !repoUrlError && !syncBlockedByPermission;

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
    selectedRepository,
    selectedPermission,
    loadingRepositories,
    repositoryLoadError,
    filter,
    setFilter,
    counts,
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
    recentNotes,
    reviewDecisions,
    setReviewDecision,
    syncSelected,
    refresh,
    refreshing,
    syncing,
    canSync,
    syncBlockedByPermission,
    defaultInstallRoots: readDefaultInstallRoots()
  };
}
