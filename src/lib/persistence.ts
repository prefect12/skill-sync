import type {
  AppPreferences,
  DefaultInstallRoots,
  Language,
  SkillRootConfig
} from "./types";

export const CUSTOM_ROOTS_KEY = "skill-sync/custom-roots";
export const REPO_URL_KEY = "skill-sync/repo-url";
export const SYNCED_IDS_KEY = "skill-sync/known-synced-ids";
export const DEFAULT_INSTALL_ROOTS_KEY = "skill-sync/default-install-roots";
export const LANGUAGE_KEY = "skill-sync/language";
export const PREFERENCES_KEY = "skill-sync/preferences";

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

export function readRootConfigs() {
  return readJson<SkillRootConfig[]>(CUSTOM_ROOTS_KEY, []);
}

export function writeRootConfigs(roots: SkillRootConfig[]) {
  writeJson(CUSTOM_ROOTS_KEY, roots);
}

export function readRepoUrl() {
  return window.localStorage.getItem(REPO_URL_KEY) ?? "";
}

export function writeRepoUrl(repoUrl: string) {
  window.localStorage.setItem(REPO_URL_KEY, repoUrl);
}

export function readKnownSyncedIds() {
  return new Set(readJson<string[]>(SYNCED_IDS_KEY, []));
}

export function writeKnownSyncedIds(ids: Set<string>) {
  writeJson(SYNCED_IDS_KEY, Array.from(ids));
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

export function sanitizeId(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
