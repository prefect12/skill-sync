import type {
  AppearanceMode,
  Language,
  SyncOperationType,
  SyncState
} from "./types";

type Messages = {
  appName: string;
  appSubtitle: string;
  repoUrlLabel: string;
  repoUrlPlaceholder: string;
  githubSectionTitle: string;
  githubConnectedAs: (username: string) => string;
  githubUsingLocalGh: string;
  githubCliMissingTitle: string;
  githubCliMissingCopy: string;
  githubLoginRequiredTitle: string;
  githubLoginRequiredCopy: string;
  githubOwnerLabel: string;
  githubRepositoryLabel: string;
  githubRepositoryPlaceholder: string;
  githubNoRepositories: string;
  githubLoadingRepositories: string;
  githubResolvedRepoLabel: string;
  githubPermissionLabel: string;
  githubPermissionUnknown: string;
  openRoots: string;
  openSettings: string;
  refresh: string;
  refreshing: string;
  syncing: string;
  syncNow: (count: number) => string;
  selectedCount: (count: number) => string;
  filterAll: (count: number) => string;
  filterChanged: (count: number) => string;
  filterConflicts: (count: number) => string;
  filterPendingDelete: (count: number) => string;
  skillsSectionTitle: string;
  inspectorTitle: string;
  inspectorEmptyTitle: string;
  inspectorEmptyCopy: string;
  batchHelpTitle: string;
  batchHelpCopy: string;
  localPath: string;
  remotePath: string;
  provider: string;
  rootLabel: string;
  status: string;
  suggestedAction: string;
  localModified: string;
  remoteModified: string;
  syncHash: string;
  symlinkSource: string;
  directDirectoryScan: string;
  lastCommitSummary: string;
  missingThisSide: string;
  reviewChoicesTitle: string;
  reviewSkip: string;
  reviewRequiredNote: (count: number) => string;
  nothingSelectedNote: string;
  missingRepoNote: string;
  repoRequiredAlert: string;
  repoUrlInvalidNote: string;
  syncDisabledReadOnlyNote: string;
  recentActivity: string;
  activityEmpty: string;
  rootsWindowTitle: string;
  rootsWindowSubtitle: string;
  rootsRefresh: string;
  rootsLoading: string;
  rootsEmpty: string;
  rootsInspectorTitle: string;
  builtInRoot: string;
  customRoot: string;
  rootAvailable: string;
  rootMissing: string;
  rootSkillCount: (count: number) => string;
  defaultInstallRoot: string;
  remoteRepoSubpath: string;
  removeRoot: string;
  addRootTitle: string;
  addRoot: string;
  label: string;
  providerHint: string;
  setAsDefault: string;
  clearDefault: string;
  settingsTitle: string;
  settingsSubtitle: string;
  settingsGeneral: string;
  settingsAdvanced: string;
  languageLabel: string;
  languageEnglish: string;
  languageChinese: string;
  appearanceLabel: string;
  appearanceSystem: string;
  appearanceLight: string;
  appearanceDark: string;
  showTechnicalActivity: string;
  close: string;
  skillsCount: (count: number) => string;
  inSync: string;
  changed: string;
  pendingDelete: string;
  rootManagerEyebrow: string;
  rootManagerTitle: string;
  defaultRootsTitle: string;
  defaultRootsBadge: string;
  defaultRootsCopy: string;
  noDefault: string;
  addCustomRoot: string;
  customBadge: string;
  reviewEyebrow: string;
  reviewTitle: string;
  reviewPending: (count: number) => string;
  reviewReady: string;
  reviewCancel: string;
  reviewConfirm: string;
  reviewConfirmBusy: string;
  rootEmpty: string;
  skippedReviewedNote: (count: number) => string;
};

const messages: Record<Language, Messages> = {
  en: {
    appName: "SkillSync Mac",
    appSubtitle: "See which skills need sync, then choose the sync direction.",
    repoUrlLabel: "GitHub repository",
    repoUrlPlaceholder: "git@github.com:you/skill-sync.git",
    githubSectionTitle: "GitHub",
    githubConnectedAs: (username) => `Connected as ${username}`,
    githubUsingLocalGh: "Uses your local GitHub CLI session. Git operations still run through system git.",
    githubCliMissingTitle: "GitHub CLI not found",
    githubCliMissingCopy: "Paste a repository URL below, or install and log into gh to browse repositories in-app.",
    githubLoginRequiredTitle: "GitHub CLI needs login",
    githubLoginRequiredCopy: "Run gh auth login in your terminal, or paste a repository URL below.",
    githubOwnerLabel: "Owner",
    githubRepositoryLabel: "Repository",
    githubRepositoryPlaceholder: "Choose a repository",
    githubNoRepositories: "No repositories found for this owner.",
    githubLoadingRepositories: "Loading repositories…",
    githubResolvedRepoLabel: "Resolved repository URL",
    githubPermissionLabel: "Permission",
    githubPermissionUnknown: "Permission unavailable",
    openRoots: "Skill Locations",
    openSettings: "Settings",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    syncing: "Syncing…",
    syncNow: (count) => `Sync Selected (${count})`,
    selectedCount: (count) => `${count} selected`,
    filterAll: (count) => `All ${count}`,
    filterChanged: (count) => `Needs Update ${count}`,
    filterConflicts: (count) => `Needs Attention ${count}`,
    filterPendingDelete: (count) => `Choose Direction ${count}`,
    skillsSectionTitle: "Skills",
    inspectorTitle: "Inspector",
    inspectorEmptyTitle: "Select a skill",
    inspectorEmptyCopy:
      "Choose a skill from the list to inspect paths, timestamps, and the next sync action.",
    batchHelpTitle: "Batch selection",
    batchHelpCopy:
      "Use the checkboxes to build a sync set. If a skill is out of sync, choose whether local or remote should win.",
    localPath: "Local path",
    remotePath: "Remote path",
    provider: "Provider",
    rootLabel: "Location",
    status: "Status",
    suggestedAction: "Suggested action",
    localModified: "Local modified",
    remoteModified: "Remote modified",
    syncHash: "Content hash",
    symlinkSource: "Symlink source",
    directDirectoryScan: "Direct directory scan",
    lastCommitSummary: "Last remote commit",
    missingThisSide: "Missing on this side",
    reviewChoicesTitle: "Choose sync direction",
    reviewSkip: "Skip for now",
    reviewRequiredNote: (count) =>
      `${count} selected item(s) still need a sync direction.`,
    nothingSelectedNote: "Nothing selected for sync.",
    missingRepoNote: "Set a GitHub repository before loading the remote snapshot.",
    repoRequiredAlert: "Add a GitHub repository before starting sync.",
    repoUrlInvalidNote: "Enter a valid GitHub repository URL such as https://github.com/owner/repo or git@github.com:owner/repo.git.",
    syncDisabledReadOnlyNote: "This repository is read-only for the current GitHub account. Refresh and choose a repo with write access before syncing.",
    recentActivity: "Recent activity",
    activityEmpty: "No activity yet.",
    rootsWindowTitle: "Skill Locations",
    rootsWindowSubtitle: "Manage the local folders that SkillSync scans and writes.",
    rootsRefresh: "Refresh",
    rootsLoading: "Refreshing…",
    rootsEmpty: "No locations available.",
    rootsInspectorTitle: "Location details",
    builtInRoot: "Built-in",
    customRoot: "Custom",
    rootAvailable: "Available on this Mac",
    rootMissing: "Missing on this Mac",
    rootSkillCount: (count) => `${count} skills`,
    defaultInstallRoot: "Default install location",
    remoteRepoSubpath: "Remote repo subpath",
    removeRoot: "Remove location",
    addRootTitle: "Add custom location",
    addRoot: "Add location",
    label: "Label",
    providerHint: "Provider",
    setAsDefault: "Set as default for provider",
    clearDefault: "Clear default",
    settingsTitle: "Settings",
    settingsSubtitle: "Choose global preferences for SkillSync Mac.",
    settingsGeneral: "General",
    settingsAdvanced: "Advanced",
    languageLabel: "Interface language",
    languageEnglish: "English",
    languageChinese: "Chinese",
    appearanceLabel: "Appearance",
    appearanceSystem: "Follow system",
    appearanceLight: "Light",
    appearanceDark: "Dark",
    showTechnicalActivity: "Show detailed technical activity in the inspector",
    close: "Close",
    skillsCount: (count) => `${count} skills`,
    inSync: "in sync",
    changed: "needs update",
    pendingDelete: "choose direction",
    rootManagerEyebrow: "Managed roots",
    rootManagerTitle: "Choose where the app scans and writes skills.",
    defaultRootsTitle: "Default install roots",
    defaultRootsBadge: "settings",
    defaultRootsCopy:
      "When a remote-only skill needs a destination, the app uses the root selected here for that provider.",
    noDefault: "No default",
    addCustomRoot: "Add custom root",
    customBadge: "custom",
    reviewEyebrow: "Needs Attention",
    reviewTitle: "Choose a sync direction before syncing.",
    reviewPending: (count) => `${count} item(s) still need a sync direction.`,
    reviewReady: "All selected items have a sync direction. You can continue.",
    reviewCancel: "Cancel",
    reviewConfirm: "Sync reviewed items",
    reviewConfirmBusy: "Syncing…",
    rootEmpty: "No skills found in this root yet.",
    skippedReviewedNote: (count) => `Skipped ${count} reviewed item(s).`
  },
  "zh-CN": {
    appName: "SkillSync Mac",
    appSubtitle: "查看哪些 skill 需要同步，然后选择同步方向。",
    repoUrlLabel: "GitHub 仓库",
    repoUrlPlaceholder: "git@github.com:you/skill-sync.git",
    githubSectionTitle: "GitHub",
    githubConnectedAs: (username) => `当前账号：${username}`,
    githubUsingLocalGh: "直接复用本机 gh 登录态识别账号和仓库；clone/pull/push 仍然走系统 git。",
    githubCliMissingTitle: "未检测到 GitHub CLI",
    githubCliMissingCopy: "你可以直接填写仓库地址，或者先安装并登录 gh，再在应用里选择仓库。",
    githubLoginRequiredTitle: "GitHub CLI 尚未登录",
    githubLoginRequiredCopy: "先在终端执行 gh auth login，或者直接填写仓库地址。",
    githubOwnerLabel: "Owner",
    githubRepositoryLabel: "仓库",
    githubRepositoryPlaceholder: "选择一个仓库",
    githubNoRepositories: "这个 owner 下暂时没有可选仓库。",
    githubLoadingRepositories: "仓库加载中…",
    githubResolvedRepoLabel: "当前仓库地址",
    githubPermissionLabel: "权限",
    githubPermissionUnknown: "无法判断权限",
    openRoots: "Skill 目录",
    openSettings: "设置",
    refresh: "刷新",
    refreshing: "刷新中…",
    syncing: "同步中…",
    syncNow: (count) => `同步已选（${count}）`,
    selectedCount: (count) => `已选 ${count} 项`,
    filterAll: (count) => `全部 ${count}`,
    filterChanged: (count) => `需要更新 ${count}`,
    filterConflicts: (count) => `需要处理 ${count}`,
    filterPendingDelete: (count) => `待选方向 ${count}`,
    skillsSectionTitle: "Skills",
    inspectorTitle: "详情",
    inspectorEmptyTitle: "选择一个 skill",
    inspectorEmptyCopy: "从左侧列表选择一个 skill，查看路径、更新时间和下一步同步动作。",
    batchHelpTitle: "批量同步",
    batchHelpCopy: "用复选框选中要同步的 skill。遇到未同步条目时，先选本地覆盖远端，还是远端覆盖本地。",
    localPath: "本地路径",
    remotePath: "远端路径",
    provider: "Provider",
    rootLabel: "目录",
    status: "状态",
    suggestedAction: "建议操作",
    localModified: "本地更新时间",
    remoteModified: "远端更新时间",
    syncHash: "内容哈希",
    symlinkSource: "符号链接源目录",
    directDirectoryScan: "目录直扫结果",
    lastCommitSummary: "远端最近提交",
    missingThisSide: "这一侧缺失",
    reviewChoicesTitle: "选择同步方向",
    reviewSkip: "先跳过",
    reviewRequiredNote: (count) => `还有 ${count} 个已选条目需要先选择同步方向。`,
    nothingSelectedNote: "当前没有选中任何需要同步的条目。",
    missingRepoNote: "请先填写 GitHub 仓库，再读取远端快照。",
    repoRequiredAlert: "开始同步前，请先填写 GitHub 仓库地址。",
    repoUrlInvalidNote: "请输入有效的 GitHub 仓库地址，例如 https://github.com/owner/repo 或 git@github.com:owner/repo.git。",
    syncDisabledReadOnlyNote: "当前 GitHub 账号对这个仓库只有只读权限。请刷新并选择有写权限的仓库后再同步。",
    recentActivity: "最近活动",
    activityEmpty: "暂时还没有活动记录。",
    rootsWindowTitle: "Skill 目录",
    rootsWindowSubtitle: "管理 SkillSync 要扫描和写入的本地目录。",
    rootsRefresh: "刷新",
    rootsLoading: "刷新中…",
    rootsEmpty: "暂时没有可用目录。",
    rootsInspectorTitle: "目录详情",
    builtInRoot: "内置",
    customRoot: "自定义",
    rootAvailable: "这台 Mac 上可用",
    rootMissing: "这台 Mac 上缺失",
    rootSkillCount: (count) => `${count} 个 skills`,
    defaultInstallRoot: "默认安装目录",
    remoteRepoSubpath: "远端仓库子路径",
    removeRoot: "删除目录",
    addRootTitle: "添加自定义目录",
    addRoot: "添加目录",
    label: "名称",
    providerHint: "Provider",
    setAsDefault: "设为该 provider 的默认目录",
    clearDefault: "清除默认",
    settingsTitle: "设置",
    settingsSubtitle: "调整 SkillSync Mac 的全局偏好。",
    settingsGeneral: "通用",
    settingsAdvanced: "高级",
    languageLabel: "界面语言",
    languageEnglish: "英文",
    languageChinese: "中文",
    appearanceLabel: "外观",
    appearanceSystem: "跟随系统",
    appearanceLight: "浅色",
    appearanceDark: "深色",
    showTechnicalActivity: "在详情区显示更详细的技术活动信息",
    close: "关闭",
    skillsCount: (count) => `${count} 个 skills`,
    inSync: "已同步",
    changed: "需要更新",
    pendingDelete: "待选方向",
    rootManagerEyebrow: "受管目录",
    rootManagerTitle: "选择应用扫描和写入 skills 的目录。",
    defaultRootsTitle: "默认安装目录",
    defaultRootsBadge: "设置",
    defaultRootsCopy:
      "当远端 skill 只存在于仓库、需要落到本地时，应用会按这里选定的 provider 默认目录写入。",
    noDefault: "未设置默认目录",
    addCustomRoot: "添加自定义目录",
    customBadge: "自定义",
    reviewEyebrow: "需要处理",
    reviewTitle: "先选择同步方向，再执行同步。",
    reviewPending: (count) => `还有 ${count} 个条目还没选择同步方向。`,
    reviewReady: "所有已选条目都已选好同步方向，可以继续同步。",
    reviewCancel: "取消",
    reviewConfirm: "同步已审核条目",
    reviewConfirmBusy: "同步中…",
    rootEmpty: "这个目录里暂时还没有发现 skill。",
    skippedReviewedNote: (count) => `跳过了 ${count} 个已审核条目。`
  }
};

export function getMessages(language: Language) {
  return messages[language] ?? messages.en;
}

export function formatStateLabel(language: Language, state: SyncState) {
  const labels: Record<Language, Record<SyncState, string>> = {
    en: {
      "in-sync": "In Sync",
      "only-local": "Unsynced",
      "only-remote": "Unsynced",
      "local-changed": "Local Version Is Newer",
      "remote-changed": "Remote Version Is Newer",
      conflict: "Needs Attention",
      "pending-delete": "Unsynced"
    },
    "zh-CN": {
      "in-sync": "已同步",
      "only-local": "未同步",
      "only-remote": "未同步",
      "local-changed": "本地版本较新",
      "remote-changed": "远端版本较新",
      conflict: "需要处理",
      "pending-delete": "未同步"
    }
  };

  return labels[language]?.[state] ?? labels.en[state];
}

export function formatActionLabel(language: Language, action: SyncOperationType) {
  const labels: Record<Language, Record<SyncOperationType, string>> = {
    en: {
      push: "Sync local to remote",
      pull: "Sync remote to local",
      "delete-local": "Delete local copy",
      "delete-remote": "Delete remote copy",
      "restore-local": "Restore local copy"
    },
    "zh-CN": {
      push: "本地同步到远端",
      pull: "远端同步到本地",
      "delete-local": "删除本地副本",
      "delete-remote": "删除远端副本",
      "restore-local": "恢复本地副本"
    }
  };

  return labels[language]?.[action] ?? labels.en[action];
}

export function formatAppearanceLabel(language: Language, appearance: AppearanceMode) {
  const copy = getMessages(language);
  switch (appearance) {
    case "light":
      return copy.appearanceLight;
    case "dark":
      return copy.appearanceDark;
    default:
      return copy.appearanceSystem;
  }
}
