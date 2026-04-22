import type {
  DiscoverRootsPayload,
  LocalRootSnapshot,
  RemoteScanPayload,
  SkillRootConfig,
  SyncOperation,
  SyncResult
} from "./types";

export const PREVIEW_RUNTIME_ERROR = "Tauri runtime is not available in this preview.";

async function getInvoke() {
  const runtimeWindow = window as Window & { __TAURI_INTERNALS__?: unknown };
  if (!runtimeWindow.__TAURI_INTERNALS__) {
    throw new Error(PREVIEW_RUNTIME_ERROR);
  }

  const core = await import("@tauri-apps/api/core");
  return core.invoke;
}

async function safeInvoke<T>(command: string, args?: Record<string, unknown>) {
  try {
    const invoke = await getInvoke();
    return await invoke<T>(command, args);
  } catch (error) {
    throw new Error(String(error));
  }
}

export async function discoverRoots(baseDir?: string) {
  return safeInvoke<DiscoverRootsPayload>("discover_roots", { baseDir });
}

export async function scanLocalRoots(roots: SkillRootConfig[]) {
  return safeInvoke<LocalRootSnapshot[]>("scan_local_roots", { roots });
}

export async function loadRemoteSnapshot(
  repoUrl: string,
  roots: SkillRootConfig[]
) {
  return safeInvoke<RemoteScanPayload>("load_remote_snapshot", { repoUrl, roots });
}

export async function syncSelectedItems(
  repoUrl: string,
  roots: SkillRootConfig[],
  operations: SyncOperation[]
) {
  return safeInvoke<SyncResult>("sync_selected_items", {
    repoUrl,
    roots,
    operations
  });
}
