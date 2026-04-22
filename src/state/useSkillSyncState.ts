import { useEffect, useMemo, useState, useTransition } from "react";
import { fallbackLocalSnapshots, fallbackRemoteSnapshot, fallbackRoots } from "../lib/fallback";
import { getMessages } from "../lib/i18n";
import {
  readDefaultInstallRoots,
  readKnownSyncedIds,
  readRepoUrl,
  readRootConfigs,
  uniqueRoots,
  writeKnownSyncedIds,
  writeRepoUrl
} from "../lib/persistence";
import { flattenSkillRows, buildRootGroups, needsReview } from "../lib/status";
import {
  discoverRoots,
  loadRemoteSnapshot,
  PREVIEW_RUNTIME_ERROR,
  scanLocalRoots,
  syncSelectedItems
} from "../lib/tauri";
import type {
  AppPreferences,
  LocalRootSnapshot,
  RemoteRootSnapshot,
  SkillListRow,
  SkillRootConfig,
  SyncOperation,
  SyncOperationType,
  SyncState
} from "../lib/types";

export type MainFilter = "all" | "changed" | "conflicts" | "pending-delete";

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
  const [refreshing, startRefresh] = useTransition();
  const [syncing, startSync] = useTransition();

  async function loadAll(overrideRoots?: SkillRootConfig[], overrideRepoUrl?: string) {
    const localRepoUrl = overrideRepoUrl ?? repoUrl;
    const customRoots = readRootConfigs();
    let discovered = fallbackRoots();
    let local = fallbackLocalSnapshots(
      overrideRoots ?? uniqueRoots([...fallbackRoots().roots, ...customRoots])
    );
    let remote = fallbackRemoteSnapshot(
      overrideRoots ?? uniqueRoots([...fallbackRoots().roots, ...customRoots])
    );
    const mergedNotes: string[] = [];

    try {
      discovered = await discoverRoots();
      mergedNotes.push(...discovered.notes);
    } catch (error) {
      if (!isPreviewRuntimeError(error)) {
        mergedNotes.push(String(error));
      }
    }

    const mergedRoots = uniqueRoots([
      ...(overrideRoots ?? []),
      ...discovered.roots,
      ...customRoots
    ]);
    setRootConfigs(mergedRoots);

    try {
      local = await scanLocalRoots(mergedRoots);
    } catch (error) {
      if (!isPreviewRuntimeError(error)) {
        mergedNotes.push(String(error));
      }
      local = fallbackLocalSnapshots(mergedRoots);
    }

    if (localRepoUrl.trim()) {
      try {
        const payload = await loadRemoteSnapshot(localRepoUrl, mergedRoots);
        remote = payload;
        mergedNotes.push(...payload.notes);
      } catch (error) {
        if (!isPreviewRuntimeError(error)) {
          mergedNotes.push(String(error));
        }
        remote = fallbackRemoteSnapshot(mergedRoots);
      }
    } else {
      remote = { roots: [], notes: [messages.missingRepoNote] };
    }

    setLocalSnapshots(local);
    setRemoteSnapshots(remote.roots);
    setNotes(mergedNotes.concat(remote.notes));
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
      void loadAll();
    };

    window.addEventListener("storage", syncFromStorage);
    window.addEventListener("focus", syncFromStorage);

    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener("focus", syncFromStorage);
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
      const nextSynced = new Set(knownSyncedIds);
      result.syncedRowIds.forEach((id) => nextSynced.add(id));
      setKnownSyncedIds(nextSynced);
      writeKnownSyncedIds(nextSynced);
      setNotes((current) => current.concat(result.notes));
      setSelectedIds(new Set());
      setReviewDecisions({});
      await loadAll(rootConfigs, repoUrl);
    } catch (error) {
      setNotes((current) => current.concat(String(error)));
    }
  }

  function syncSelected() {
    if (!repoUrl.trim()) {
      window.alert(messages.repoRequiredAlert);
      setNotes((current) => current.concat(messages.repoRequiredAlert));
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
      void loadAll();
    });
  }

  const recentNotes = notes.slice(-8).reverse();
  const selectedCount = selectedIds.size;
  const visibleSelectedCount = filteredRows.filter((item) => selectedIds.has(item.row.id)).length;
  const allVisibleSelected =
    filteredRows.length > 0 && visibleSelectedCount === filteredRows.length;

  return {
    messages,
    repoUrl,
    setRepoUrl,
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
    defaultInstallRoots: readDefaultInstallRoots()
  };
}
