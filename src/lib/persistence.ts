import type {
  AppPreferences,
  BuiltInRootOverride,
  DefaultInstallRoots,
  KnownSyncedEntries,
  Language,
  SkillRootConfig
} from "./types";

export const CUSTOM_ROOTS_KEY = "skill-sync/custom-roots";
export const BUILT_IN_ROOT_OVERRIDES_KEY = "skill-sync/built-in-root-overrides";
export const REPO_URL_KEY = "skill-sync/repo-url";
export const SYNCED_IDS_KEY = "skill-sync/known-synced-ids";
export const DEFAULT_INSTALL_ROOTS_KEY = "skill-sync/default-install-roots";
export const LANGUAGE_KEY = "skill-sync/language";
export const PREFERENCES_KEY = "skill-sync/preferences";
export const LAST_GITHUB_OWNER_KEY = "skill-sync/github-last-owner";

export const DEFAULT_PREFERENCES: AppPreferences = {
  language: "en",
  appearance: "system",
  showTechnicalActivity: false
};

export const DEFAULT_INSTALL_ROOTS: DefaultInstallRoots = {
  codex: "codex-home",
  claude: "claude-home",
  generic: ""
};

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readPreferences(): AppPreferences {
  const stored = readJson<Partial<AppPreferences>>(PREFERENCES_KEY, {});
  const legacyLanguage = readJson<Language>(LANGUAGE_KEY, DEFAULT_PREFERENCES.language);

  return {
    ...DEFAULT_PREFERENCES,
    language: stored.language ?? legacyLanguage,
    appearance: stored.appearance ?? DEFAULT_PREFERENCES.appearance,
    showTechnicalActivity:
      stored.showTechnicalActivity ?? DEFAULT_PREFERENCES.showTechnicalActivity
  };
}

export function writePreferences(preferences: AppPreferences) {
  writeJson(PREFERENCES_KEY, preferences);
}

export function readLastGitHubOwner() {
  return window.localStorage.getItem(LAST_GITHUB_OWNER_KEY) ?? "";
}

export function writeLastGitHubOwner(owner: string) {
  if (!owner.trim()) {
    window.localStorage.removeItem(LAST_GITHUB_OWNER_KEY);
    return;
  }

  window.localStorage.setItem(LAST_GITHUB_OWNER_KEY, owner.trim());
}

export function readRootConfigs() {
  return readJson<SkillRootConfig[]>(CUSTOM_ROOTS_KEY, []).filter(
    (root) => root.kind === "custom"
  );
}

export function writeRootConfigs(roots: SkillRootConfig[]) {
  writeJson(CUSTOM_ROOTS_KEY, roots);
}

export function readBuiltInRootOverrides() {
  const stored = readJson<Record<string, BuiltInRootOverride>>(
    BUILT_IN_ROOT_OVERRIDES_KEY,
    {}
  );
  const legacyRoots = readJson<SkillRootConfig[]>(CUSTOM_ROOTS_KEY, []).filter(
    (root) => root.kind !== "custom"
  );

  const legacyOverrides = Object.fromEntries(
    legacyRoots.map((root) => [
      root.id,
      {
        label: root.label,
        providerHint: root.providerHint,
        localPath: root.localPath,
        remotePath: root.remotePath,
        enabled: root.enabled
      } satisfies BuiltInRootOverride
    ])
  );

  return { ...legacyOverrides, ...stored };
}

export function writeBuiltInRootOverrides(overrides: Record<string, BuiltInRootOverride>) {
  writeJson(BUILT_IN_ROOT_OVERRIDES_KEY, overrides);
}

export function readRepoUrl() {
  return window.localStorage.getItem(REPO_URL_KEY) ?? "";
}

export function writeRepoUrl(repoUrl: string) {
  window.localStorage.setItem(REPO_URL_KEY, repoUrl);
}

export function readKnownSyncedIds() {
  const stored = readJson<KnownSyncedEntries | string[]>(SYNCED_IDS_KEY, []);
  if (Array.isArray(stored)) {
    return Object.fromEntries(stored.map((id) => [id, true])) as KnownSyncedEntries;
  }
  return stored;
}

export function writeKnownSyncedIds(entries: KnownSyncedEntries) {
  writeJson(SYNCED_IDS_KEY, entries);
}

export function readDefaultInstallRoots() {
  return readJson<DefaultInstallRoots>(
    DEFAULT_INSTALL_ROOTS_KEY,
    DEFAULT_INSTALL_ROOTS
  );
}

export function writeDefaultInstallRoots(defaultInstallRoots: DefaultInstallRoots) {
  writeJson(DEFAULT_INSTALL_ROOTS_KEY, defaultInstallRoots);
}

export function uniqueRoots(roots: SkillRootConfig[]) {
  const map = new Map<string, SkillRootConfig>();
  roots.forEach((root) => map.set(root.id, root));
  return Array.from(map.values());
}

export function mergeRootConfigs(
  discoveredRoots: SkillRootConfig[],
  customRoots: SkillRootConfig[],
  builtInOverrides: Record<string, BuiltInRootOverride>
) {
  const mergedDiscoveredRoots = discoveredRoots.map((root) =>
    root.kind === "custom"
      ? root
      : {
          ...root,
          ...builtInOverrides[root.id]
        }
  );

  return uniqueRoots([...mergedDiscoveredRoots, ...customRoots]);
}

export function sanitizeId(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
