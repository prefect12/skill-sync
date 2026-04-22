import { useEffect, useState, useTransition } from "react";
import { fallbackLocalSnapshots, fallbackRoots } from "../lib/fallback";
import { getMessages } from "../lib/i18n";
import {
  DEFAULT_INSTALL_ROOTS,
  readDefaultInstallRoots,
  readPreferences,
  readRootConfigs,
  sanitizeId,
  uniqueRoots,
  writeDefaultInstallRoots,
  writeRootConfigs
} from "../lib/persistence";
import { discoverRoots, PREVIEW_RUNTIME_ERROR, scanLocalRoots } from "../lib/tauri";
import type {
  DefaultInstallRoots,
  LocalRootSnapshot,
  ProviderHint,
  SkillRootConfig
} from "../lib/types";

function isPreviewRuntimeError(error: unknown) {
  return String(error).includes(PREVIEW_RUNTIME_ERROR);
}

export function useRootsState() {
  const preferences = readPreferences();
  const messages = getMessages(preferences.language);
  const [rootConfigs, setRootConfigs] = useState<SkillRootConfig[]>([]);
  const [localSnapshots, setLocalSnapshots] = useState<LocalRootSnapshot[]>([]);
  const [defaultInstallRoots, setDefaultInstallRoots] =
    useState<DefaultInstallRoots>(readDefaultInstallRoots);
  const [selectedRootId, setSelectedRootId] = useState<string>("");
  const [notes, setNotes] = useState<string[]>([]);
  const [loading, startLoading] = useTransition();

  async function loadRoots(overrideRoots?: SkillRootConfig[]) {
    const customRoots = readRootConfigs();
    let discovered = fallbackRoots();
    let local = fallbackLocalSnapshots(
      overrideRoots ?? uniqueRoots([...fallbackRoots().roots, ...customRoots])
    );
    const nextNotes: string[] = [];

    try {
      discovered = await discoverRoots();
      nextNotes.push(...discovered.notes);
    } catch (error) {
      if (!isPreviewRuntimeError(error)) {
        nextNotes.push(String(error));
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
        nextNotes.push(String(error));
      }
      local = fallbackLocalSnapshots(mergedRoots);
    }

    setLocalSnapshots(local);
    setNotes(nextNotes);
  }

  useEffect(() => {
    void loadRoots();
  }, []);

  useEffect(() => {
    const syncFromStorage = () => {
      setDefaultInstallRoots(readDefaultInstallRoots());
      void loadRoots();
    };

    window.addEventListener("storage", syncFromStorage);
    window.addEventListener("focus", syncFromStorage);

    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener("focus", syncFromStorage);
    };
  }, []);

  useEffect(() => {
    if (!rootConfigs.length) {
      setSelectedRootId("");
      return;
    }

    if (!rootConfigs.some((root) => root.id === selectedRootId)) {
      setSelectedRootId(rootConfigs[0].id);
    }
  }, [rootConfigs, selectedRootId]);

  function updateRootConfig(rootId: string, patch: Partial<SkillRootConfig>) {
    const nextRoots = rootConfigs.map((root) =>
      root.id === rootId ? { ...root, ...patch } : root
    );
    setRootConfigs(nextRoots);
    writeRootConfigs(nextRoots);
  }

  function addCustomRoot(input: {
    label: string;
    localPath: string;
    remotePath?: string;
    providerHint: SkillRootConfig["providerHint"];
  }) {
    const id = sanitizeId(input.label || input.localPath.split("/").pop() || "custom-root");
    const root: SkillRootConfig = {
      id,
      label: input.label || id,
      kind: "custom",
      providerHint: input.providerHint,
      localPath: input.localPath,
      remotePath: input.remotePath?.trim() || `roots/${id}`,
      enabled: true
    };

    const nextRoots = uniqueRoots([...rootConfigs, root]);
    setRootConfigs(nextRoots);
    writeRootConfigs(nextRoots);
    setSelectedRootId(root.id);
    void loadRoots(nextRoots);
  }

  function removeRoot(rootId: string) {
    const nextRoots = rootConfigs.filter((root) => root.id !== rootId);
    setRootConfigs(nextRoots);
    writeRootConfigs(nextRoots);
    setSelectedRootId(nextRoots[0]?.id ?? "");
    void loadRoots(nextRoots);
  }

  function setDefaultInstallRoot(provider: ProviderHint, rootId: string) {
    const next = {
      ...defaultInstallRoots,
      [provider]: rootId
    };
    setDefaultInstallRoots(next);
    writeDefaultInstallRoots(next);
  }

  function clearDefaultInstallRoot(provider: ProviderHint) {
    const next = {
      ...defaultInstallRoots,
      [provider]: DEFAULT_INSTALL_ROOTS[provider]
    };
    setDefaultInstallRoots(next);
    writeDefaultInstallRoots(next);
  }

  function refresh() {
    startLoading(() => {
      void loadRoots();
    });
  }

  const rootItems = rootConfigs.map((root) => {
    const snapshot = localSnapshots.find((item) => item.rootId === root.id);
    const skillCount = snapshot?.skills.length ?? 0;
    const isDefault = defaultInstallRoots[root.providerHint] === root.id;

    return {
      root,
      exists: Boolean(snapshot?.exists),
      skillCount,
      isDefault
    };
  });

  const selectedRoot = rootConfigs.find((root) => root.id === selectedRootId) ?? null;
  const selectedSnapshot =
    localSnapshots.find((item) => item.rootId === selectedRootId) ?? null;

  return {
    messages,
    rootItems,
    selectedRootId,
    setSelectedRootId,
    selectedRoot,
    selectedSnapshot,
    notes,
    loading,
    updateRootConfig,
    addCustomRoot,
    removeRoot,
    setDefaultInstallRoot,
    clearDefaultInstallRoot,
    refresh
  };
}
