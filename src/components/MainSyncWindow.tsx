import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Cloud,
  CloudDownload,
  CloudUpload,
  FolderCog,
  GitBranch,
  Laptop,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react";
import { AppBrand } from "./AppBrand";
import { formatActionLabel, formatStateLabel, getMessages } from "../lib/i18n";
import { SkillDiffPanel } from "./SkillDiffPanel";
import { getReviewDecisionActions, type ReviewDecision } from "../lib/syncDecisions";
import { openAppWindow } from "../lib/windowing";
import { useSkillSyncState, type MainFilter } from "../state/useSkillSyncState";
import type { AppPreferences, Language, SkillRow, SyncOperationType } from "../lib/types";

const FILTERS: MainFilter[] = [
  "actionable",
  "changed",
  "conflicts",
  "pending-delete",
  "ignored",
  "all"
];

function formatTimestamp(value?: number) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function homeCopy(language: Language) {
  if (language === "zh-CN") {
    return {
      title: "同步中心",
      subtitle: "把这台 Mac 的 Codex / Claude skills 安全备份到 GitHub，也能在新电脑上恢复回来。",
      connected: "已连接",
      notConnected: "未连接同步仓库",
      repoReady: "GitHub 已准备好",
      repoMissing: "先连接一个 GitHub 仓库",
      localSkills: "这台 Mac",
      githubSkills: "GitHub",
      needsWork: "待处理",
      noChanges: "都已同步",
      syncSuggested: (count: number) => `同步建议项（${count}）`,
      syncSelected: (count: number) => `同步已选（${count}）`,
      backupNow: (count: number) => `备份 ${count} 个 skills`,
      reviewFirst: "先处理需要确认的条目",
      openFolders: "Skill 文件夹",
      advanced: "高级信息",
      hideAdvanced: "隐藏高级信息",
      setupTitle: "第一次使用 SkillSync",
      setupCopy: "三步完成：发现本机 skills，连接 GitHub，然后做第一次备份。",
      stepDiscover: "发现 Skills",
      stepConnect: "连接 GitHub",
      stepBackup: "第一次备份",
      createRepo: "创建私有仓库",
      createRepoBusy: "创建中...",
      chooseExisting: "选择已有仓库",
      manualRepo: "手动填写仓库地址",
      dismissGuide: "隐藏引导",
      firstBackupTitle: "可以开始第一次备份",
      firstBackupCopy: "GitHub 仓库还是空的，建议先把这台 Mac 上的 skills 上传作为初始版本。",
      listTitle: "Skills",
      listCopy: "默认只显示需要同步或需要确认的 skills；已同步的不会占列表。",
      selectAll: "选择当前列表",
      detailTitle: "详情",
      emptyTitle: "选择一个 skill",
      emptyCopy: "点选左侧条目，查看应该上传、下载，还是需要你决定保留哪一边。",
      chooseDirection: "选择处理方式",
      chooseDirectionCopy: "这一步不会自动猜测，避免误删或覆盖。",
      skip: "暂时不处理",
      useLocal: "使用这台 Mac 的版本",
      useGitHub: "使用 GitHub 的版本",
      uploadAgain: "重新上传到 GitHub",
      restoreHere: "恢复到这台 Mac",
      deleteHere: "确认删除这台 Mac 的副本",
      deleteGitHub: "确认删除 GitHub 副本",
      deleteHereCopy: "会从本机 skill 文件夹移除这个 skill。",
      deleteGitHubCopy: "会从同步仓库移除这个 skill。",
      uploadCopy: "把本机文件作为新的 GitHub 版本。",
      downloadCopy: "用 GitHub 版本覆盖这台 Mac。",
      restoreCopy: "从 GitHub 重新下载到本机。",
      location: "位置",
      localSide: "本机副本",
      githubSide: "GitHub 副本",
      available: "存在",
      missing: "缺失",
      latestLocal: "本机更新时间",
      latestGitHub: "GitHub 更新时间",
      noRepositoryHelp: "没有安装或登录 GitHub CLI 时，也可以直接粘贴仓库 URL。",
      repoPermission: "权限",
      needsReview: "需要确认",
      statusSyncing: "正在同步你选择的 skills。",
      statusRefreshing: "正在重新检查这台 Mac 和 GitHub。",
      statusLoadingRepos: "正在读取你的 GitHub 仓库列表。",
      statusNeedsRepo: "还没有连接 GitHub 仓库，先连接后才能检查云端副本。",
      statusRemoteUnavailable: "GitHub 这次没有读成功，暂时不能判断哪些 skill 需要同步。可以点刷新重试。",
      statusNeedsWork: (count: number) => `有 ${count} 个 skill 需要你处理。`,
      statusReady: "检查完成，目前没有需要同步的 skill。",
      waitingForGitHub: "等待 GitHub",
      syncCheckTitle: "同步检查",
      technicalDetailsTitle: "技术记录",
      viewTechnicalDetails: "打开高级信息可查看技术记录。",
      startupLoadingTitle: "正在检查你的 skills",
      startupLoadingCopy: "SkillSync 会自动发现这台 Mac 的 skills，并读取 GitHub 副本。检查完成前不会展示同步判断，避免误导。",
      startupLoadingLocal: "发现本机 skills",
      startupLoadingGitHub: "读取 GitHub 副本",
      startupLoadingCompare: "整理同步建议",
      noActionableTitle: "没有需要同步的 skill",
      noActionableCopy: "已同步的 skill 默认隐藏；需要检查完整列表时可切到“全部”。",
      ignoredBadge: "不同步",
      ignoreSkill: "不再同步",
      ignoreSkillCopy: "会写入 GitHub 不跟踪清单；如果 GitHub 有副本，会删除 GitHub 副本，本机文件保留。",
      moveToIgnored: "移入不跟踪",
      removeFromIgnored: "移除",
      removeFromIgnoredTitle: "从不跟踪列表移除",
      ignoreRemoteConfirm: (name: string) =>
        `将“${name}”移入不跟踪？\n\n这会写入 GitHub 仓库的 .skillsync/ignored-skills.json，并删除 GitHub 上这个 skill 的副本。本机文件不会删除。`,
      ignoreLocalConfirm: (name: string) =>
        `将“${name}”移入不跟踪？\n\n这会写入 GitHub 仓库的 .skillsync/ignored-skills.json。当前 GitHub 没有这个 skill 副本，所以不会删除文件。`,
      restoreSkill: "恢复同步",
      restoreSkillCopy: "恢复后会重新出现在需要同步或需要确认的列表里。",
      ignoredListCopy: "这里是已标记为不跟踪的 skills；点“移除”即可重新纳入同步。",
      ignoredEmptyTitle: "没有不跟踪的 skill",
      ignoredEmptyCopy: "在任意 skill 行点“移入不跟踪”，它之后就会出现在这里。"
    };
  }

  return {
    title: "Sync Center",
    subtitle: "Back up Codex and Claude skills from this Mac to GitHub, then restore them on another Mac.",
    connected: "Connected",
    notConnected: "No sync repository",
    repoReady: "GitHub is ready",
    repoMissing: "Connect a GitHub repository first",
    localSkills: "This Mac",
    githubSkills: "GitHub",
    needsWork: "Needs attention",
    noChanges: "Everything is synced",
    syncSuggested: (count: number) => `Sync suggestions (${count})`,
    syncSelected: (count: number) => `Sync selected (${count})`,
    backupNow: (count: number) => `Back up ${count} skills`,
    reviewFirst: "Review required items first",
    openFolders: "Skill folders",
    advanced: "Advanced details",
    hideAdvanced: "Hide advanced details",
    setupTitle: "First-time setup",
    setupCopy: "Finish three steps: find local skills, connect GitHub, then make the first backup.",
    stepDiscover: "Find skills",
    stepConnect: "Connect GitHub",
    stepBackup: "First backup",
    createRepo: "Create private repository",
    createRepoBusy: "Creating...",
    chooseExisting: "Choose an existing repository",
    manualRepo: "Paste repository URL",
    dismissGuide: "Hide guide",
    firstBackupTitle: "Ready for the first backup",
    firstBackupCopy: "The GitHub repository is empty. Start by uploading this Mac's skills as the initial copy.",
    listTitle: "Skills",
    listCopy: "Only skills that need sync or review are shown by default; synced skills stay out of the way.",
    selectAll: "Select visible items",
    detailTitle: "Details",
    emptyTitle: "Select a skill",
    emptyCopy: "Choose a row to see whether SkillSync should upload, download, or ask you to keep one side.",
    chooseDirection: "Choose what to keep",
    chooseDirectionCopy: "SkillSync asks here instead of guessing, so deletes and overwrites stay deliberate.",
    skip: "Skip for now",
    useLocal: "Use this Mac's version",
    useGitHub: "Use GitHub version",
    uploadAgain: "Upload again to GitHub",
    restoreHere: "Restore to this Mac",
    deleteHere: "Confirm delete from this Mac",
    deleteGitHub: "Confirm delete from GitHub",
    deleteHereCopy: "Removes this skill from the local skill folder.",
    deleteGitHubCopy: "Removes this skill from the sync repository.",
    uploadCopy: "Makes the local files the new GitHub copy.",
    downloadCopy: "Replaces this Mac's files with the GitHub copy.",
    restoreCopy: "Downloads the GitHub copy back to this Mac.",
    location: "Location",
    localSide: "Local copy",
    githubSide: "GitHub copy",
    available: "Available",
    missing: "Missing",
    latestLocal: "Local modified",
    latestGitHub: "GitHub modified",
    noRepositoryHelp: "If GitHub CLI is not installed or logged in, paste an existing repository URL.",
    repoPermission: "Permission",
    needsReview: "Needs review",
    statusSyncing: "Syncing the skills you selected.",
    statusRefreshing: "Checking this Mac and GitHub again.",
    statusLoadingRepos: "Loading your GitHub repositories.",
    statusNeedsRepo: "Connect a GitHub repository before checking cloud copies.",
    statusRemoteUnavailable: "GitHub could not be read this time, so SkillSync is not judging sync changes yet. Refresh to retry.",
    statusNeedsWork: (count: number) => `${count} skill(s) need your attention.`,
    statusReady: "Check complete. No skills need sync right now.",
    waitingForGitHub: "Waiting for GitHub",
    syncCheckTitle: "Sync check",
    technicalDetailsTitle: "Technical records",
    viewTechnicalDetails: "Open Advanced details to view technical records.",
    startupLoadingTitle: "Checking your skills",
    startupLoadingCopy: "SkillSync automatically finds skills on this Mac and reads the GitHub copy. It will not show sync judgments until the check is ready.",
    startupLoadingLocal: "Finding local skills",
    startupLoadingGitHub: "Reading GitHub copy",
    startupLoadingCompare: "Preparing sync suggestions",
    noActionableTitle: "No skills need sync",
    noActionableCopy: "Synced skills are hidden by default. Switch to All to inspect the full list.",
    ignoredBadge: "Not syncing",
    ignoreSkill: "Do not sync",
    ignoreSkillCopy: "Writes this to the GitHub ignored list. If GitHub has a copy, the GitHub copy is deleted while local files are kept.",
    moveToIgnored: "Move to ignored",
    removeFromIgnored: "Remove",
    removeFromIgnoredTitle: "Remove from ignored list",
    ignoreRemoteConfirm: (name: string) =>
      `Move "${name}" to ignored?\n\nThis writes .skillsync/ignored-skills.json in the GitHub repository and deletes this skill's GitHub copy. Local files are kept.`,
    ignoreLocalConfirm: (name: string) =>
      `Move "${name}" to ignored?\n\nThis writes .skillsync/ignored-skills.json in the GitHub repository. GitHub has no copy of this skill right now, so no files are deleted.`,
    restoreSkill: "Restore sync",
    restoreSkillCopy: "After restoring, this skill can appear again when it needs sync or review.",
    ignoredListCopy: "These skills are marked as not syncing. Use Remove to include one again.",
    ignoredEmptyTitle: "No ignored skills",
    ignoredEmptyCopy: "Use Move to ignored on any skill row to keep it out of sync suggestions."
  };
}

function rowIcon(row: SkillRow) {
  if (row.state === "in-sync") {
    return <CheckCircle2 />;
  }
  if (row.state === "only-local" || row.state === "local-changed") {
    return <Laptop />;
  }
  if (row.state === "only-remote" || row.state === "remote-changed") {
    return <Cloud />;
  }
  return <AlertTriangle />;
}

function actionIcon(action: ReviewDecision | SyncOperationType) {
  if (action === "push") {
    return <CloudUpload />;
  }
  if (action === "pull") {
    return <CloudDownload />;
  }
  if (action === "restore-local") {
    return <RotateCcw />;
  }
  if (action === "delete-local" || action === "delete-remote") {
    return <Trash2 />;
  }
  return <X />;
}

function reviewLabel(language: Language, row: SkillRow, action: ReviewDecision) {
  const copy = homeCopy(language);
  if (action === "skip") {
    return copy.skip;
  }
  if (row.state === "conflict" && action === "push") {
    return copy.useLocal;
  }
  if (row.state === "conflict" && action === "pull") {
    return copy.useGitHub;
  }
  if (row.state === "pending-delete" && action === "push") {
    return copy.uploadAgain;
  }
  if (row.state === "pending-delete" && action === "restore-local") {
    return copy.restoreHere;
  }
  if (action === "delete-local") {
    return copy.deleteHere;
  }
  if (action === "delete-remote") {
    return copy.deleteGitHub;
  }
  return formatActionLabel(language, action);
}

function reviewDescription(language: Language, action: ReviewDecision) {
  const copy = homeCopy(language);
  if (action === "push") {
    return copy.uploadCopy;
  }
  if (action === "pull") {
    return copy.downloadCopy;
  }
  if (action === "restore-local") {
    return copy.restoreCopy;
  }
  if (action === "delete-local") {
    return copy.deleteHereCopy;
  }
  if (action === "delete-remote") {
    return copy.deleteGitHubCopy;
  }
  return "";
}

function isDangerousReviewAction(action: ReviewDecision) {
  return action === "delete-local" || action === "delete-remote";
}

function filterLabel(language: Language, filter: MainFilter, count: number) {
  if (language === "zh-CN") {
    const labels: Record<MainFilter, string> = {
      actionable: `待处理 ${count}`,
      all: `全部 ${count}`,
      changed: `可同步 ${count}`,
      conflicts: `需确认 ${count}`,
      ignored: `不跟踪 ${count}`,
      "pending-delete": `可能删除 ${count}`
    };
    return labels[filter];
  }

  const labels: Record<MainFilter, string> = {
    actionable: `Needs action ${count}`,
    all: `All ${count}`,
    changed: `Ready ${count}`,
    conflicts: `Review ${count}`,
    ignored: `Ignored ${count}`,
    "pending-delete": `Deleted? ${count}`
  };
  return labels[filter];
}

function sourceSummary(language: Language, row: SkillRow) {
  if (language === "zh-CN") {
    if (row.local && row.remote) {
      return "本机和 GitHub 都有副本";
    }
    if (row.local) {
      return "只在这台 Mac 上";
    }
    if (row.remote) {
      return "只在 GitHub 上";
    }
    return "等待确认";
  }

  if (row.local && row.remote) {
    return "Available on this Mac and GitHub";
  }
  if (row.local) {
    return "Only on this Mac";
  }
  if (row.remote) {
    return "Only on GitHub";
  }
  return "Needs review";
}

function isTechnicalActivityNote(note: string) {
  return (
    note.startsWith("Reload: ") ||
    note.startsWith("Startup: ") ||
    note.startsWith("Loaded remote snapshot from ") ||
    note.startsWith("Project root scan base does not exist yet:") ||
    note.startsWith("Error: Failed to update GitHub repository") ||
    note.startsWith("Failed to update GitHub repository")
  );
}

export function MainSyncWindow({ preferences }: { preferences: AppPreferences }) {
  const state = useSkillSyncState(preferences);
  const messages = getMessages(preferences.language);
  const copy = homeCopy(preferences.language);
  const selectedItem = state.selectedItem;
  const selectedRow = selectedItem?.row;
  const selectedRoot = selectedItem?.root;
  const selectedIgnored = selectedRow ? Boolean(state.ignoredSkillIds[selectedRow.id]) : false;
  const reviewActions = selectedRow && !selectedIgnored ? getReviewDecisionActions(selectedRow) : [];
  const setupVisible = state.onboardingStep !== "done" && !state.onboardingDismissed;
  const suggestedCount = state.rowsNeedingAction.length;
  const primaryCount = state.selectedCount || suggestedCount;
  const primaryLabel = state.selectedCount
    ? copy.syncSelected(state.selectedCount)
    : state.firstBackupRecommended
      ? copy.backupNow(state.localSkillCount)
      : copy.syncSuggested(suggestedCount);
  const primaryDisabled = state.syncing || !state.canSync || primaryCount === 0;
  const repoName =
    state.repoValidation?.fullName ??
    state.selectedRepository?.fullName ??
    state.repoUrl.replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "");
  const connectionTitle = state.repoUrl.trim() ? copy.repoReady : copy.repoMissing;
  const userFacingNotes = state.recentNotes.filter((note) => !isTechnicalActivityNote(note));
  const technicalNotes = state.recentNotes.filter(isTechnicalActivityNote);
  const showTechnicalActivity =
    state.showAdvancedDetails || preferences.showTechnicalActivity;
  const statusMessage = state.syncing
    ? copy.statusSyncing
    : state.refreshing
      ? copy.statusRefreshing
      : state.loadingRepositories
        ? copy.statusLoadingRepos
        : !state.repoUrl.trim()
          ? copy.statusNeedsRepo
          : state.remoteLoadError
            ? copy.statusRemoteUnavailable
            : suggestedCount
              ? copy.statusNeedsWork(suggestedCount)
              : copy.statusReady;

  function confirmMoveToIgnored(row: SkillRow) {
    const message = row.remote
      ? copy.ignoreRemoteConfirm(row.name)
      : copy.ignoreLocalConfirm(row.name);
    return window.confirm(message);
  }

  return (
    <div className="window-shell">
      <main className="window-content main-window sync-home">
        <header className="sync-topbar">
          <AppBrand
            kicker={messages.appName}
            title={copy.title}
            subtitle={copy.subtitle}
          />

          <div className="sync-topbar-actions">
            <div className={state.repoUrl.trim() ? "connection-pill connected" : "connection-pill"}>
              <GitBranch aria-hidden="true" />
              <span>{state.repoUrl.trim() ? copy.connected : copy.notConnected}</span>
              {repoName ? <strong>{repoName}</strong> : null}
            </div>
            <button
              className="icon-button quiet-icon-button"
              type="button"
              aria-label={messages.refresh}
              title={messages.refresh}
              onClick={state.refresh}
              disabled={state.refreshing}
            >
              <RefreshCw />
            </button>
            <button
              className="icon-button quiet-icon-button"
              type="button"
              aria-label={messages.openRoots}
              title={messages.openRoots}
              onClick={() => void openAppWindow("roots")}
            >
              <FolderCog />
            </button>
            <button
              className="icon-button quiet-icon-button"
              type="button"
              aria-label={messages.openSettings}
              title={messages.openSettings}
              onClick={() => void openAppWindow("settings")}
            >
              <Settings />
            </button>
          </div>
        </header>

        {state.startupLoading ? (
          <section className="startup-loading-panel" aria-live="polite">
            <div className="startup-loading-icon">
              <RefreshCw />
            </div>
            <div className="startup-loading-copy">
              <p className="toolbar-kicker">{copy.syncCheckTitle}</p>
              <h2>{copy.startupLoadingTitle}</h2>
              <p>{copy.startupLoadingCopy}</p>
            </div>
            <div className="startup-loading-steps">
              <span>{copy.startupLoadingLocal}</span>
              <span>{copy.startupLoadingGitHub}</span>
              <span>{copy.startupLoadingCompare}</span>
            </div>
          </section>
        ) : (
          <>
        {setupVisible ? (
          <section className="setup-guide">
            <div className="setup-guide-copy">
              <p className="toolbar-kicker">{copy.setupTitle}</p>
              <h2>{state.onboardingStep === "backup" ? copy.firstBackupTitle : connectionTitle}</h2>
              <p>
                {state.onboardingStep === "backup" ? copy.firstBackupCopy : copy.setupCopy}
              </p>
            </div>

            <div className="setup-steps" aria-label={copy.setupTitle}>
              {[
                ["discover", copy.stepDiscover],
                ["connect", copy.stepConnect],
                ["backup", copy.stepBackup]
              ].map(([step, label]) => {
                const active = state.onboardingStep === step;
                const complete =
                  (step === "discover" && state.localSkillCount > 0) ||
                  (step === "connect" && Boolean(state.repoUrl.trim()) && !state.repoUrlError) ||
                  (step === "backup" && !state.firstBackupRecommended && Boolean(state.repoUrl.trim()));

                return (
                  <div
                    key={step}
                    className={`setup-step${active ? " active" : ""}${complete ? " complete" : ""}`}
                  >
                    <span>{complete ? <CheckCircle2 /> : <ChevronRight />}</span>
                    <strong>{label}</strong>
                  </div>
                );
              })}
            </div>

            <div className="setup-actions">
              {state.usesGitHubPicker ? (
                <>
                  <label className="field compact-field">
                    <span>{messages.githubOwnerLabel}</span>
                    <select
                      value={state.selectedOwner}
                      onChange={(event) => state.chooseOwner(event.target.value)}
                      disabled={state.loadingRepositories || state.githubOwners.length === 0}
                    >
                      {state.githubOwners.map((owner) => (
                        <option key={owner.login} value={owner.login}>
                          {owner.login}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field compact-field">
                    <span>{copy.chooseExisting}</span>
                    <select
                      value={state.selectedRepository?.fullName ?? state.repoValidation?.fullName ?? ""}
                      onChange={(event) => state.chooseRepository(event.target.value)}
                      disabled={
                        state.loadingRepositories ||
                        !state.selectedOwner ||
                        state.githubRepositories.length === 0
                      }
                    >
                      <option value="">
                        {state.loadingRepositories
                          ? messages.githubLoadingRepositories
                          : messages.githubRepositoryPlaceholder}
                      </option>
                      {state.githubRepositories.map((repository) => (
                        <option key={repository.fullName} value={repository.fullName}>
                          {repository.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={state.createDefaultRepository}
                    disabled={state.creatingRepository}
                  >
                    {state.creatingRepository ? copy.createRepoBusy : copy.createRepo}
                  </button>
                </>
              ) : (
                <label className="field manual-repo-field">
                  <span>{copy.manualRepo}</span>
                  <input
                    value={state.repoUrl}
                    onChange={(event) => state.setManualRepoUrl(event.target.value)}
                    placeholder={messages.repoUrlPlaceholder}
                  />
                  <p className={state.repoUrlError ? "field-help warning-copy" : "field-help"}>
                    {state.repoUrlError || copy.noRepositoryHelp}
                  </p>
                </label>
              )}
              <button
                className="secondary-button"
                type="button"
                onClick={() => state.setOnboardingDismissed(true)}
              >
                {copy.dismissGuide}
              </button>
            </div>
          </section>
        ) : null}

        <section className="sync-overview">
          <div className="sync-summary">
            <div className="sync-summary-item">
              <Laptop />
              <span>{copy.localSkills}</span>
              <strong>{state.localSkillCount}</strong>
            </div>
            <div className="sync-summary-item">
              <Cloud />
              <span>{copy.githubSkills}</span>
              <strong>{state.remoteSkillCount}</strong>
            </div>
            <div className={suggestedCount ? "sync-summary-item attention" : "sync-summary-item"}>
              <ShieldCheck />
              <span>{suggestedCount ? copy.needsWork : copy.noChanges}</span>
              <strong>{suggestedCount}</strong>
            </div>
          </div>

          <div className="primary-sync-panel">
            <div className="primary-sync-copy">
              <p className="toolbar-kicker">{copy.syncCheckTitle}</p>
              <h2>{statusMessage}</h2>
              <p className="sync-panel-meta">
                {state.reviewRequiredCount
                  ? copy.reviewFirst
                  : `${copy.repoPermission}: ${state.selectedPermission ?? messages.githubPermissionUnknown}`}
              </p>
              {userFacingNotes.length > 0 ? (
                <div className="activity-list sync-panel-notes">
                  {userFacingNotes.map((note, index) => (
                    <p key={`${note}-${index}`}>{note}</p>
                  ))}
                </div>
              ) : technicalNotes.length > 0 && !showTechnicalActivity ? (
                <p className="field-help">{copy.viewTechnicalDetails}</p>
              ) : null}
            </div>
            <button
              className="primary-button primary-sync-button"
              type="button"
              onClick={state.selectedCount ? state.syncSelected : state.syncSuggested}
              disabled={primaryDisabled}
            >
              {state.syncing ? messages.syncing : primaryLabel}
            </button>
          </div>
        </section>

        <section className="finder-workbench">
          <section className="finder-pane skill-pane">
            <div className="finder-pane-header">
              <div>
                <h2>{copy.listTitle}</h2>
                <p>{state.filter === "ignored" ? copy.ignoredListCopy : copy.listCopy}</p>
              </div>
              <label className="select-all compact-select-all">
                <input
                  type="checkbox"
                  checked={state.allVisibleSelected}
                  onChange={(event) => state.selectAllVisible(event.target.checked)}
                />
                <span>{copy.selectAll}</span>
              </label>
            </div>

            <div className="filter-bar finder-filter-bar" role="tablist" aria-label="filters">
              {FILTERS.map((filter) => {
                const count =
                  filter === "actionable"
                    ? state.counts.actionable
                    : filter === "all"
                      ? state.counts.all
                      : filter === "changed"
                        ? state.counts.changed
                        : filter === "conflicts"
                          ? state.counts.conflicts
                          : filter === "ignored"
                            ? state.counts.ignored
                            : state.counts["pending-delete"];

                return (
                  <button
                    key={filter}
                    className={filter === state.filter ? "filter-chip active" : "filter-chip"}
                    onClick={() => state.setFilter(filter)}
                  >
                    {filterLabel(preferences.language, filter, count)}
                  </button>
                );
              })}
            </div>

            <div className="finder-skill-list">
              {state.filteredRows.length === 0 ? (
                <div className="empty-state finder-empty-state">
                  <CheckCircle2 />
                  <strong>
                    {state.filter === "ignored"
                      ? copy.ignoredEmptyTitle
                      : state.filter === "actionable"
                        ? copy.noActionableTitle
                        : copy.noChanges}
                  </strong>
                  <p>
                    {state.filter === "ignored"
                      ? copy.ignoredEmptyCopy
                      : state.filter === "actionable"
                        ? copy.noActionableCopy
                        : messages.activityEmpty}
                  </p>
                </div>
              ) : (
                state.filteredRows.map((item) => {
                  const ignored = Boolean(state.ignoredSkillIds[item.row.id]);
                  const checked = !ignored && state.selectedIds.has(item.row.id);
                  const active = item.row.id === state.selectedRowId;
                  const action = ignored
                    ? copy.ignoredBadge
                    : item.row.recommendedAction
                    ? state.remoteLoadError
                      ? copy.waitingForGitHub
                      : formatActionLabel(preferences.language, item.row.recommendedAction)
                    : item.row.state === "in-sync"
                      ? copy.noChanges
                      : state.remoteLoadError
                        ? copy.waitingForGitHub
                        : copy.needsReview;

                  return (
                    <div
                      key={item.row.id}
                      className={`finder-row${active ? " active" : ""}${ignored ? " ignored" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => state.setSelectedSkill(item.row.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          state.setSelectedSkill(item.row.id);
                        }
                      }}
                    >
                      <label
                        className="skill-check"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={ignored}
                          onChange={() => state.toggleSkill(item.row.id)}
                        />
                      </label>
                      <span className={`row-source-icon status-${item.row.state}`}>
                        {rowIcon(item.row)}
                      </span>
                      <span className="finder-row-name">
                        <strong>{item.row.name}</strong>
                        <small>{item.root.label}</small>
                      </span>
                      <span className={`status-pill status-${item.row.state}`}>
                        {formatStateLabel(preferences.language, item.row.state)}
                      </span>
                      <span className="finder-row-action">{action}</span>
                      <button
                        className="row-track-button"
                        type="button"
                        disabled={state.syncing}
                        title={ignored ? copy.removeFromIgnoredTitle : copy.moveToIgnored}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (ignored) {
                            state.restoreIgnoredSkill(item.row.id);
                            return;
                          }
                          if (!confirmMoveToIgnored(item.row)) {
                            return;
                          }
                          state.ignoreSkill(item.row.id);
                        }}
                      >
                        {ignored ? <RotateCcw /> : <X />}
                        <span>{ignored ? copy.removeFromIgnored : copy.moveToIgnored}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <aside className="finder-pane inspector-pane">
            <div className="finder-pane-header">
              <div>
                <h2>{copy.detailTitle}</h2>
                <p>{selectedRow ? sourceSummary(preferences.language, selectedRow) : copy.emptyCopy}</p>
              </div>
              <button
                className="secondary-button compact-button"
                type="button"
                onClick={() => state.setShowAdvancedDetails(!state.showAdvancedDetails)}
              >
                <SlidersHorizontal />
                {state.showAdvancedDetails ? copy.hideAdvanced : copy.advanced}
              </button>
            </div>

            {!selectedItem || !selectedRow || !selectedRoot ? (
              <div className="empty-state finder-empty-state">
                <Cloud />
                <strong>{copy.emptyTitle}</strong>
                <p>{copy.emptyCopy}</p>
              </div>
            ) : (
              <div className="inspector-stack">
                <section className="inspector-section simple-inspector-section">
                  <div className="inspector-title-row">
                    <div>
                      <h3>{selectedRow.name}</h3>
                      <p>{selectedRoot.label}</p>
                    </div>
                    <span className="inspector-badges">
                      <span className={`status-pill status-${selectedRow.state}`}>
                        {formatStateLabel(preferences.language, selectedRow.state)}
                      </span>
                      {selectedIgnored ? (
                        <span className="status-pill neutral">{copy.ignoredBadge}</span>
                      ) : null}
                    </span>
                  </div>

                  <div className="presence-grid">
                    <div className={selectedRow.local ? "presence-item available" : "presence-item"}>
                      <Laptop />
                      <span>{copy.localSide}</span>
                      <strong>{selectedRow.local ? copy.available : copy.missing}</strong>
                    </div>
                    <div className={selectedRow.remote ? "presence-item available" : "presence-item"}>
                      <Cloud />
                      <span>{copy.githubSide}</span>
                      <strong>{selectedRow.remote ? copy.available : copy.missing}</strong>
                    </div>
                  </div>

                  <dl className="detail-grid quiet-detail-grid">
                    <div>
                      <dt>{copy.latestLocal}</dt>
                      <dd>{formatTimestamp(selectedRow.local?.modifiedAtMs)}</dd>
                    </div>
                    <div>
                      <dt>{copy.latestGitHub}</dt>
                      <dd>{formatTimestamp(selectedRow.remote?.modifiedAtMs)}</dd>
                    </div>
                  </dl>

                  <div className="ignore-action-row">
                    <button
                      className="secondary-button compact-button"
                      type="button"
                      disabled={state.syncing}
                      onClick={() =>
                        selectedIgnored
                          ? state.restoreIgnoredSkill(selectedRow.id)
                          : confirmMoveToIgnored(selectedRow)
                            ? state.ignoreSkill(selectedRow.id)
                            : undefined
                      }
                    >
                      {selectedIgnored ? <RotateCcw /> : <X />}
                      {selectedIgnored ? copy.restoreSkill : copy.moveToIgnored}
                    </button>
                    <p className="field-help">
                      {selectedIgnored ? copy.restoreSkillCopy : copy.ignoreSkillCopy}
                    </p>
                  </div>
                </section>

                {reviewActions.length > 0 ? (
                  <section className="inspector-section simple-inspector-section">
                    <div className="section-heading">
                      <div>
                        <h3>{copy.chooseDirection}</h3>
                        <p className="muted-copy">{copy.chooseDirectionCopy}</p>
                      </div>
                    </div>
                    <div className="decision-list friendly-decision-list">
                      {reviewActions.map((action) => (
                        <label
                          key={action}
                          className={
                            isDangerousReviewAction(action)
                              ? "decision-option danger"
                              : "decision-option"
                          }
                        >
                          <input
                            type="radio"
                            name={`review-${selectedRow.id}`}
                            checked={state.reviewDecisions[selectedRow.id] === action}
                            onChange={() => state.setReviewDecision(selectedRow.id, action)}
                          />
                          <span className="decision-option-icon">
                            {actionIcon(action)}
                          </span>
                          <span className="decision-option-copy">
                            <strong>{reviewLabel(preferences.language, selectedRow, action)}</strong>
                            {reviewDescription(preferences.language, action) ? (
                              <small>{reviewDescription(preferences.language, action)}</small>
                            ) : null}
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                ) : null}

                {state.showAdvancedDetails ? (
                  <section className="inspector-section simple-inspector-section">
                    <div className="section-heading">
                      <h3>{copy.advanced}</h3>
                    </div>
                    <dl className="detail-grid">
                      <div>
                        <dt>{messages.provider}</dt>
                        <dd>{selectedRoot.providerHint}</dd>
                      </div>
                      <div>
                        <dt>{messages.syncHash}</dt>
                        <dd>{selectedRow.local?.contentHash ?? selectedRow.remote?.contentHash ?? "—"}</dd>
                      </div>
                      <div className="detail-span">
                        <dt>{messages.localPath}</dt>
                        <dd>{selectedRow.local?.path ?? messages.missingThisSide}</dd>
                      </div>
                      <div className="detail-span">
                        <dt>{messages.remotePath}</dt>
                        <dd>{selectedRow.remote?.repoPath ?? messages.missingThisSide}</dd>
                      </div>
                      {selectedRow.remote?.lastCommitSummary ? (
                        <div className="detail-span">
                          <dt>{messages.lastCommitSummary}</dt>
                          <dd>{selectedRow.remote.lastCommitSummary}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </section>
                ) : null}

                {state.showAdvancedDetails && !state.remoteLoadError && selectedRow.state !== "in-sync" ? (
                  <SkillDiffPanel
                    language={preferences.language}
                    compare={state.selectedCompare}
                    loading={state.selectedCompareLoading}
                    error={state.selectedCompareError}
                    activeFilePath={state.selectedDiffFilePath}
                    onSelectFile={state.setSelectedDiffFilePath}
                  />
                ) : null}

                {showTechnicalActivity && technicalNotes.length > 0 ? (
                  <section className="inspector-section simple-inspector-section">
                    <div className="section-heading">
                      <h3>{copy.technicalDetailsTitle}</h3>
                    </div>
                    <div className="activity-list technical-activity-list">
                      {technicalNotes.map((note, index) => (
                        <p key={`technical-${note}-${index}`}>{note}</p>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </aside>
        </section>
          </>
        )}
      </main>
    </div>
  );
}
