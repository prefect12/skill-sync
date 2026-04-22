import { getMessages } from "../lib/i18n";
import { useRootsState } from "../state/useRootsState";
import type { Language, ProviderHint } from "../lib/types";

export function RootsWindow({ language }: { language: Language }) {
  const state = useRootsState();
  const messages = getMessages(language);
  const selectedRoot = state.selectedRoot;
  const selectedSnapshot = state.selectedSnapshot;

  return (
    <div className="window-shell utility-window">
      <main className="window-content utility-content">
        <header className="utility-header">
          <div>
            <p className="toolbar-kicker">{messages.rootsWindowTitle}</p>
            <h1>{messages.rootsWindowTitle}</h1>
            <p className="toolbar-subtitle">{messages.rootsWindowSubtitle}</p>
          </div>
          <button className="secondary-button" onClick={state.refresh} disabled={state.loading}>
            {state.loading ? messages.rootsLoading : messages.rootsRefresh}
          </button>
        </header>

        <section className="content-split utility-split">
          <section className="pane roots-list-pane">
            <div className="pane-header">
              <div>
                <h2>{messages.openRoots}</h2>
                <p>{messages.skillsCount(state.rootItems.length)}</p>
              </div>
            </div>

            <div className="roots-table">
              {state.rootItems.length === 0 ? (
                <div className="empty-state">
                  <strong>{messages.rootsEmpty}</strong>
                </div>
              ) : (
                state.rootItems.map((item) => (
                  <button
                    key={item.root.id}
                    className={
                      item.root.id === state.selectedRootId ? "root-row active" : "root-row"
                    }
                    onClick={() => state.setSelectedRootId(item.root.id)}
                  >
                    <div className="root-row-primary">
                      <strong>{item.root.label}</strong>
                      <span className="muted-copy">{item.root.providerHint}</span>
                    </div>
                    <div className="root-row-meta">
                      <span>{item.root.localPath}</span>
                      <span>{messages.rootSkillCount(item.skillCount)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <aside className="pane inspector-pane">
            {!selectedRoot ? (
              <div className="empty-state">
                <strong>{messages.rootsInspectorTitle}</strong>
                <p>{messages.rootsEmpty}</p>
              </div>
            ) : (
              <div className="inspector-stack">
                <section className="inspector-section">
                  <div className="inspector-title-row">
                    <div>
                      <h3>{selectedRoot.label}</h3>
                      <p>
                        {selectedRoot.kind === "custom"
                          ? messages.customRoot
                          : messages.builtInRoot}
                      </p>
                    </div>
                    <span className="status-pill neutral">
                      {selectedSnapshot?.exists ? messages.rootAvailable : messages.rootMissing}
                    </span>
                  </div>

                  <div className="form-grid">
                    <label className="field">
                      <span>{messages.label}</span>
                      <input
                        value={selectedRoot.label}
                        onChange={(event) =>
                          state.updateRootConfig(selectedRoot.id, { label: event.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>{messages.providerHint}</span>
                      <select
                        value={selectedRoot.providerHint}
                        onChange={(event) =>
                          state.updateRootConfig(selectedRoot.id, {
                            providerHint: event.target.value as ProviderHint
                          })
                        }
                      >
                        <option value="codex">codex</option>
                        <option value="claude">claude</option>
                        <option value="generic">generic</option>
                      </select>
                    </label>
                    <label className="field form-span">
                      <span>{messages.localPath}</span>
                      <input
                        value={selectedRoot.localPath}
                        onChange={(event) =>
                          state.updateRootConfig(selectedRoot.id, { localPath: event.target.value })
                        }
                      />
                    </label>
                    <label className="field form-span">
                      <span>{messages.remoteRepoSubpath}</span>
                      <input
                        value={selectedRoot.remotePath}
                        onChange={(event) =>
                          state.updateRootConfig(selectedRoot.id, {
                            remotePath: event.target.value
                          })
                        }
                      />
                    </label>
                  </div>

                  <div className="default-toggle">
                    <label className="radio-row">
                      <input
                        type="checkbox"
                        checked={
                          state.rootItems.find((item) => item.root.id === selectedRoot.id)?.isDefault ??
                          false
                        }
                        onChange={(event) =>
                          event.target.checked
                            ? state.setDefaultInstallRoot(
                                selectedRoot.providerHint,
                                selectedRoot.id
                              )
                            : state.clearDefaultInstallRoot(selectedRoot.providerHint)
                        }
                      />
                      <span>{messages.setAsDefault}</span>
                    </label>
                    {selectedRoot.kind === "custom" ? (
                      <button
                        className="danger-button"
                        onClick={() => state.removeRoot(selectedRoot.id)}
                      >
                        {messages.removeRoot}
                      </button>
                    ) : null}
                  </div>
                </section>

                <section className="inspector-section">
                  <div className="section-heading">
                    <h3>{messages.addRootTitle}</h3>
                  </div>
                  <AddRootForm language={language} onSubmit={state.addCustomRoot} />
                </section>

                {state.notes.length > 0 ? (
                  <section className="inspector-section">
                    <div className="section-heading">
                      <h3>{messages.recentActivity}</h3>
                    </div>
                    <div className="activity-list">
                      {state.notes.map((note, index) => (
                        <p key={`${note}-${index}`}>{note}</p>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}

function AddRootForm({
  language,
  onSubmit
}: {
  language: Language;
  onSubmit: (input: {
    label: string;
    localPath: string;
    remotePath?: string;
    providerHint: ProviderHint;
  }) => void;
}) {
  const messages = getMessages(language);

  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const label = String(form.get("label") ?? "").trim();
        const localPath = String(form.get("localPath") ?? "").trim();
        const remotePath = String(form.get("remotePath") ?? "").trim();
        const providerHint = String(form.get("providerHint") ?? "generic") as ProviderHint;
        if (!label || !localPath) {
          return;
        }
        onSubmit({ label, localPath, remotePath, providerHint });
        event.currentTarget.reset();
      }}
    >
      <label className="field">
        <span>{messages.label}</span>
        <input name="label" placeholder="Team Skills" />
      </label>
      <label className="field">
        <span>{messages.providerHint}</span>
        <select name="providerHint" defaultValue="generic">
          <option value="codex">codex</option>
          <option value="claude">claude</option>
          <option value="generic">generic</option>
        </select>
      </label>
      <label className="field form-span">
        <span>{messages.localPath}</span>
        <input name="localPath" placeholder="/Users/me/team/skills" />
      </label>
      <label className="field form-span">
        <span>{messages.remoteRepoSubpath}</span>
        <input name="remotePath" placeholder="roots/team-skills" />
      </label>
      <div className="form-actions form-span">
        <button className="primary-button" type="submit">
          {messages.addRoot}
        </button>
      </div>
    </form>
  );
}
