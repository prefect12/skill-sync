import { formatActionLabel, formatStateLabel, getMessages } from "../lib/i18n";
import { openAppWindow } from "../lib/windowing";
import { useSkillSyncState, type MainFilter } from "../state/useSkillSyncState";
import type { AppPreferences, Language, SkillListRow, SyncOperationType } from "../lib/types";

const FILTERS: MainFilter[] = ["all", "changed", "conflicts", "pending-delete"];

function formatTimestamp(value?: number) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function reviewOptions(language: Language, item: SkillListRow) {
  const row = item.row;
  if (row.state === "conflict" || row.state === "pending-delete") {
    return [
      { value: "push" as const, label: formatActionLabel(language, "push") },
      { value: "pull" as const, label: formatActionLabel(language, "pull") },
      { value: "skip" as const, label: language === "zh-CN" ? "先跳过" : "Skip for now" }
    ];
  }

  return [];
}

function reviewLabel(
  language: Language,
  decision: SyncOperationType | "skip" | undefined
) {
  if (!decision) {
    return "";
  }
  if (decision === "skip") {
    return language === "zh-CN" ? "先跳过" : "Skip for now";
  }
  return formatActionLabel(language, decision);
}

export function MainSyncWindow({ preferences }: { preferences: AppPreferences }) {
  const state = useSkillSyncState(preferences);
  const messages = getMessages(preferences.language);
  const selectedItem = state.selectedItem;
  const selectedRow = selectedItem?.row;
  const selectedRoot = selectedItem?.root;

  return (
    <div className="window-shell">
      <main className="window-content main-window">
        <header className="app-toolbar">
          <div className="toolbar-copy">
            <p className="toolbar-kicker">{messages.appName}</p>
            <h1>{messages.skillsSectionTitle}</h1>
            <p className="toolbar-subtitle">{messages.appSubtitle}</p>
          </div>

          <div className="toolbar-stack">
            <section className="github-card">
              <div className="github-card-head">
                <div>
                  <p className="toolbar-kicker">{messages.githubSectionTitle}</p>
                  <h2>
                    {state.usesGitHubPicker && state.githubStatus.username
                      ? messages.githubConnectedAs(state.githubStatus.username)
                      : state.githubStatus.cliAvailable
                        ? messages.githubLoginRequiredTitle
                        : messages.githubCliMissingTitle}
                  </h2>
                  <p className="helper-copy">
                    {state.usesGitHubPicker
                      ? messages.githubUsingLocalGh
                      : state.githubStatus.cliAvailable
                        ? messages.githubLoginRequiredCopy
                        : messages.githubCliMissingCopy}
                  </p>
                </div>
                <span className="status-pill neutral">
                  {state.usesGitHubPicker ? "gh" : "URL"}
                </span>
              </div>

              {state.usesGitHubPicker ? (
                <div className="github-grid">
                  <label className="field">
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

                  <label className="field">
                    <span>{messages.githubRepositoryLabel}</span>
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
                      {state.repoValidation?.fullName &&
                      !state.githubRepositories.some(
                        (repository) => repository.fullName === state.repoValidation?.fullName
                      ) ? (
                        <option value={state.repoValidation.fullName}>
                          {state.repoValidation.fullName.split("/")[1]}
                        </option>
                      ) : null}
                      {state.githubRepositories.map((repository) => (
                        <option key={repository.fullName} value={repository.fullName}>
                          {repository.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field github-inline-field">
                    <span>{messages.githubResolvedRepoLabel}</span>
                    <input value={state.repoUrl} readOnly placeholder={messages.repoUrlPlaceholder} />
                  </label>

                  <div className="field github-inline-field">
                    <span>{messages.githubPermissionLabel}</span>
                    <div className="github-meta-row">
                      <strong>{state.selectedPermission ?? messages.githubPermissionUnknown}</strong>
                      {state.syncBlockedByPermission ? (
                        <span className="inline-note warning">
                          {messages.syncDisabledReadOnlyNote}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {!state.loadingRepositories &&
                  state.selectedOwner &&
                  state.repositoryLoadError ? (
                    <p className="inline-note warning form-span">{state.repositoryLoadError}</p>
                  ) : null}

                  {!state.loadingRepositories &&
                  state.selectedOwner &&
                  state.githubRepositories.length === 0 &&
                  !state.repositoryLoadError ? (
                    <p className="inline-note form-span">{messages.githubNoRepositories}</p>
                  ) : null}
                </div>
              ) : (
                <div className="github-grid">
                  <label className="field github-inline-field">
                    <span>{messages.repoUrlLabel}</span>
                    <input
                      value={state.repoUrl}
                      onChange={(event) => state.setManualRepoUrl(event.target.value)}
                      placeholder={messages.repoUrlPlaceholder}
                    />
                  </label>
                  {state.repoUrlError ? (
                    <p className="inline-note warning form-span">{state.repoUrlError}</p>
                  ) : null}
                </div>
              )}
            </section>

            <div className="toolbar-buttons">
              <button className="secondary-button" onClick={() => void openAppWindow("roots")}>
                {messages.openRoots}
              </button>
              <button
                className="secondary-button"
                onClick={() => void openAppWindow("settings")}
              >
                {messages.openSettings}
              </button>
              <button
                className="secondary-button"
                onClick={state.refresh}
                disabled={state.refreshing}
              >
                {state.refreshing ? messages.refreshing : messages.refresh}
              </button>
              <button
                className="primary-button"
                onClick={state.syncSelected}
                disabled={state.syncing || state.selectedCount === 0 || !state.canSync}
              >
                {state.syncing ? messages.syncing : messages.syncNow(state.selectedCount)}
              </button>
            </div>
          </div>
        </header>

        <section className="summary-strip">
          <div className="summary-card">
            <span>{messages.selectedCount(state.selectedCount)}</span>
            <strong>{state.allRows.length}</strong>
          </div>
          <div className="summary-card">
            <span>{messages.filterChanged(state.counts.changed)}</span>
            <strong>{state.counts.changed}</strong>
          </div>
          <div className="summary-card">
            <span>{messages.filterConflicts(state.counts.conflicts)}</span>
            <strong>{state.counts.conflicts}</strong>
          </div>
          <div className="summary-card">
            <span>{messages.filterPendingDelete(state.counts["pending-delete"])}</span>
            <strong>{state.counts["pending-delete"]}</strong>
          </div>
        </section>

        <section className="content-split">
          <section className="pane skill-pane">
            <div className="pane-header">
              <div>
                <h2>{messages.skillsSectionTitle}</h2>
                <p>{messages.batchHelpCopy}</p>
              </div>
              <label className="select-all">
                <input
                  type="checkbox"
                  checked={state.allVisibleSelected}
                  onChange={(event) => state.selectAllVisible(event.target.checked)}
                />
                <span>{messages.selectedCount(state.selectedCount)}</span>
              </label>
            </div>

            <div className="filter-bar" role="tablist" aria-label="filters">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  className={filter === state.filter ? "filter-chip active" : "filter-chip"}
                  onClick={() => state.setFilter(filter)}
                >
                  {filter === "all"
                    ? messages.filterAll(state.counts.all)
                    : filter === "changed"
                      ? messages.filterChanged(state.counts.changed)
                      : filter === "conflicts"
                        ? messages.filterConflicts(state.counts.conflicts)
                        : messages.filterPendingDelete(state.counts["pending-delete"])}
                </button>
              ))}
            </div>

            <div className="skill-list">
              {state.filteredRows.length === 0 ? (
                <div className="empty-state">
                  <strong>{messages.inspectorEmptyTitle}</strong>
                  <p>{messages.activityEmpty}</p>
                </div>
              ) : (
                state.filteredRows.map((item) => {
                  const checked = state.selectedIds.has(item.row.id);
                  const active = item.row.id === state.selectedRowId;
                  const subtitle = [item.root.label, item.root.providerHint, item.row.name]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <button
                      key={item.row.id}
                      className={active ? "skill-row active" : "skill-row"}
                      onClick={() => state.setSelectedSkill(item.row.id)}
                    >
                      <label
                        className="skill-check"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => state.toggleSkill(item.row.id)}
                        />
                      </label>
                      <div className="skill-row-copy">
                        <div className="skill-row-top">
                          <strong>{item.row.name}</strong>
                          <span className={`status-pill status-${item.row.state}`}>
                            {formatStateLabel(preferences.language, item.row.state)}
                          </span>
                        </div>
                        <p>{subtitle}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <aside className="pane inspector-pane">
            <div className="pane-header">
              <div>
                <h2>{messages.inspectorTitle}</h2>
                <p>{messages.batchHelpTitle}</p>
              </div>
            </div>

            {!selectedItem || !selectedRow || !selectedRoot ? (
              <div className="empty-state">
                <strong>{messages.inspectorEmptyTitle}</strong>
                <p>{messages.inspectorEmptyCopy}</p>
              </div>
            ) : (
              <div className="inspector-stack">
                <section className="inspector-section">
                  <div className="inspector-title-row">
                    <div>
                      <h3>{selectedRow.name}</h3>
                      <p>{selectedRoot.label}</p>
                    </div>
                    <span className={`status-pill status-${selectedRow.state}`}>
                      {formatStateLabel(preferences.language, selectedRow.state)}
                    </span>
                  </div>

                  <dl className="detail-grid">
                    <div>
                      <dt>{messages.provider}</dt>
                      <dd>{selectedRoot.providerHint}</dd>
                    </div>
                    <div>
                      <dt>{messages.rootLabel}</dt>
                      <dd>{selectedRoot.label}</dd>
                    </div>
                    <div className="detail-span">
                      <dt>{messages.localPath}</dt>
                      <dd>{selectedRow.local?.path ?? messages.missingThisSide}</dd>
                    </div>
                    <div className="detail-span">
                      <dt>{messages.remotePath}</dt>
                      <dd>{selectedRow.remote?.repoPath ?? messages.missingThisSide}</dd>
                    </div>
                    <div>
                      <dt>{messages.localModified}</dt>
                      <dd>{formatTimestamp(selectedRow.local?.modifiedAtMs)}</dd>
                    </div>
                    <div>
                      <dt>{messages.remoteModified}</dt>
                      <dd>{formatTimestamp(selectedRow.remote?.modifiedAtMs)}</dd>
                    </div>
                    <div>
                      <dt>{messages.suggestedAction}</dt>
                      <dd>
                        {selectedRow.recommendedAction
                          ? formatActionLabel(preferences.language, selectedRow.recommendedAction)
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>{messages.syncHash}</dt>
                      <dd>{selectedRow.local?.contentHash ?? selectedRow.remote?.contentHash ?? "—"}</dd>
                    </div>
                    {(selectedRow.local?.isSymlink || preferences.showTechnicalActivity) && (
                      <div>
                        <dt>{messages.symlinkSource}</dt>
                        <dd>{selectedRow.local?.isSymlink ? selectedRoot.localPath : "—"}</dd>
                      </div>
                    )}
                    {preferences.showTechnicalActivity && (
                      <div>
                        <dt>{messages.directDirectoryScan}</dt>
                        <dd>{selectedRow.local ? messages.rootAvailable : messages.rootMissing}</dd>
                      </div>
                    )}
                    {selectedRow.remote?.lastCommitSummary && (
                      <div className="detail-span">
                        <dt>{messages.lastCommitSummary}</dt>
                        <dd>{selectedRow.remote.lastCommitSummary}</dd>
                      </div>
                    )}
                  </dl>
                </section>

                {reviewOptions(preferences.language, selectedItem).length > 0 ? (
                  <section className="inspector-section">
                    <div className="section-heading">
                      <h3>{messages.reviewChoicesTitle}</h3>
                      {state.reviewDecisions[selectedRow.id] ? (
                        <span className="decision-copy">
                          {reviewLabel(preferences.language, state.reviewDecisions[selectedRow.id])}
                        </span>
                      ) : null}
                    </div>
                    <div className="decision-list">
                      {reviewOptions(preferences.language, selectedItem).map((option) => (
                        <label key={option.value} className="radio-row">
                          <input
                            type="radio"
                            name={`review-${selectedRow.id}`}
                            checked={state.reviewDecisions[selectedRow.id] === option.value}
                            onChange={() => state.setReviewDecision(selectedRow.id, option.value)}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="inspector-section">
                  <div className="section-heading">
                    <h3>{messages.recentActivity}</h3>
                  </div>
                  {state.recentNotes.length === 0 ? (
                    <p className="muted-copy">{messages.activityEmpty}</p>
                  ) : (
                    <div className="activity-list">
                      {state.recentNotes.map((note, index) => (
                        <p key={`${note}-${index}`}>{note}</p>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}
