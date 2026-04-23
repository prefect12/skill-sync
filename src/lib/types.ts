export type RootKind =
  | "codex-home"
  | "claude-home"
  | "claude-project"
  | "custom";

export type ProviderHint = "codex" | "claude" | "generic";
export type Language = "en" | "zh-CN";
export type AppearanceMode = "system" | "light" | "dark";
export type WindowView = "main" | "roots" | "settings";
export type GitHubOwnerKind = "user" | "org";

export type SyncState =
  | "in-sync"
  | "only-local"
  | "only-remote"
  | "local-changed"
  | "remote-changed"
  | "conflict"
  | "pending-delete";

export interface SkillRootConfig {
  id: string;
  label: string;
  kind: RootKind;
  providerHint: ProviderHint;
  localPath: string;
  remotePath: string;
  enabled: boolean;
}

export type DefaultInstallRoots = Record<ProviderHint, string>;
export type BuiltInRootOverride = Partial<
  Pick<SkillRootConfig, "label" | "providerHint" | "localPath" | "remotePath" | "enabled">
>;
export type KnownSyncedEntries = Record<string, string | true>;

export interface AppPreferences {
  language: Language;
  appearance: AppearanceMode;
  showTechnicalActivity: boolean;
}

export interface LocalSkillEntry {
  id: string;
  rootId: string;
  name: string;
  path: string;
  modifiedAtMs: number;
  contentHash: string;
  isSymlink: boolean;
}

export interface LocalRootSnapshot {
  rootId: string;
  path: string;
  exists: boolean;
  skills: LocalSkillEntry[];
}

export interface RemoteSkillEntry {
  id: string;
  rootId: string;
  name: string;
  repoPath: string;
  modifiedAtMs: number;
  contentHash: string;
  lastCommitSummary?: string;
}

export interface RemoteRootSnapshot {
  rootId: string;
  remotePath: string;
  skills: RemoteSkillEntry[];
}

export interface SkillRow {
  id: string;
  rootId: string;
  name: string;
  local?: LocalSkillEntry;
  remote?: RemoteSkillEntry;
  state: SyncState;
  recommendedAction?: SyncOperationType;
}

export interface SkillListRow {
  root: SkillRootConfig;
  row: SkillRow;
}

export interface RootGroup {
  root: SkillRootConfig;
  rows: SkillRow[];
  existsLocally: boolean;
}

export interface DiscoverRootsPayload {
  roots: SkillRootConfig[];
  notes: string[];
}

export interface RemoteScanPayload {
  roots: RemoteRootSnapshot[];
  notes: string[];
}

export type SkillDiffChange = "modified" | "added" | "removed";

export interface SkillDiffFile {
  path: string;
  change: SkillDiffChange;
  isBinary: boolean;
  localText?: string;
  remoteText?: string;
}

export interface SkillDiffPayload {
  files: SkillDiffFile[];
}

export interface SyncOperation {
  rowId: string;
  rootId: string;
  skillName: string;
  action: SyncOperationType;
}

export type SyncOperationType =
  | "push"
  | "pull"
  | "delete-local"
  | "delete-remote"
  | "restore-local";

export interface SyncResult {
  remoteRoots: RemoteRootSnapshot[];
  notes: string[];
  syncedRowIds: string[];
}

export interface GitHubStatus {
  cliAvailable: boolean;
  authenticated: boolean;
  username?: string;
  note?: string;
}

export interface GitHubOwner {
  login: string;
  kind: GitHubOwnerKind;
}

export interface GitHubRepository {
  owner: string;
  name: string;
  fullName: string;
  url: string;
  sshUrl?: string;
  description?: string;
  isPrivate: boolean;
  viewerPermission?: string;
}

export interface GitHubRepositoryValidation {
  fullName: string;
  url: string;
  sshUrl?: string;
  viewerPermission?: string;
}
