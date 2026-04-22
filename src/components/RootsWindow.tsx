import { useState } from "react";
import { AppBrand } from "./AppBrand";
import { getMessages } from "../lib/i18n";
import { useRootsState } from "../state/useRootsState";
import type { Language, ProviderHint } from "../lib/types";

function providerLabel(messages: ReturnType<typeof getMessages>, provider: ProviderHint) {
  if (provider === "codex") {
    return messages.providerCodex;
  }
  if (provider === "claude") {
    return messages.providerClaude;
  }
  return messages.providerGeneric;
}

function ProviderGlyph({ provider }: { provider: ProviderHint }) {
  if (provider === "codex") {
    return <span className="choice-button-letter">C</span>;
  }
  if (provider === "claude") {
    return <span className="choice-button-letter">Cl</span>;
  }
  return <span className="choice-button-letter">+</span>;
}

function ProviderChoiceGroup({
  language,
  value,
  onChange
}: {
  language: Language;
  value: ProviderHint;
  onChange: (value: ProviderHint) => void;
}) {
  const messages = getMessages(language);
  const options: Array<{
    value: ProviderHint;
    label: string;
    description: string;
  }> = [
    {
      value: "codex",
      label: messages.providerCodex,
      description: messages.providerCodexDescription
    },
    {
      value: "claude",
      label: messages.providerClaude,
      description: messages.providerClaudeDescription
    },
    {
      value: "generic",
      label: messages.providerGeneric,
      description: messages.providerGenericDescription
    }
  ];

  return (
    <div className="settings-choice-group form-span">
      <span className="settings-choice-label">{messages.providerHint}</span>
      <p className="field-help">{messages.providerHintHelp}</p>
      <div className="settings-choice-grid" role="group" aria-label={messages.providerHint}>
        {options.map((option) => {
          const active = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              className={active ? "choice-button active" : "choice-button"}
              aria-pressed={active}
              onClick={() => onChange(option.value)}
            >
              <span className="choice-button-icon">
                <ProviderGlyph provider={option.value} />
              </span>
              <span className="choice-button-copy">
                <span className="choice-button-label">{option.label}</span>
                <span className="choice-button-description">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RootsWindow({ language }: { language: Language }) {
  const state = useRootsState();
  const messages = getMessages(language);
  const selectedRoot = state.selectedRoot;
  const selectedSnapshot = state.selectedSnapshot;

  return (
    <div className="window-shell utility-window">
      <main className="window-content utility-content">
        <header className="utility-header">
          <AppBrand
            kicker={messages.appName}
            title={messages.rootsWindowTitle}
            subtitle={messages.rootsWindowSubtitle}
          />
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
                      <span className="muted-copy">
                        {providerLabel(messages, item.root.providerHint)}
                      </span>
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
                  <p className="muted-copy">
                    {providerLabel(messages, selectedRoot.providerHint)} · {selectedRoot.localPath}
                  </p>

                  <div className="form-grid">
                    <label className="field">
                      <span>{messages.label}</span>
                      <input
                        value={selectedRoot.label}
                        onChange={(event) =>
                          state.updateRootConfig(selectedRoot.id, { label: event.target.value })
                        }
                      />
                      <p className="field-help">{messages.labelHelp}</p>
                    </label>
                    <ProviderChoiceGroup
                      language={language}
                      value={selectedRoot.providerHint}
                      onChange={(providerHint) =>
                        state.updateRootConfig(selectedRoot.id, { providerHint })
                      }
                    />
                    <label className="field form-span">
                      <span>{messages.localPath}</span>
                      <input
                        value={selectedRoot.localPath}
                        onChange={(event) =>
                          state.updateRootConfig(selectedRoot.id, { localPath: event.target.value })
                        }
                      />
                      <p className="field-help">{messages.localPathHelp}</p>
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
                      <p className="field-help">{messages.remoteRepoSubpathHelp}</p>
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
                  <p className="field-help">{messages.setAsDefaultHelp}</p>
                </section>

                <section className="inspector-section">
                  <div className="section-heading">
                    <h3>{messages.addRootTitle}</h3>
                  </div>
                  <p className="muted-copy">{messages.addRootSubtitle}</p>
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
  const [providerHint, setProviderHint] = useState<ProviderHint>("generic");

  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const label = String(form.get("label") ?? "").trim();
        const localPath = String(form.get("localPath") ?? "").trim();
        const remotePath = String(form.get("remotePath") ?? "").trim();
        if (!label || !localPath) {
          return;
        }
        onSubmit({ label, localPath, remotePath, providerHint });
        event.currentTarget.reset();
        setProviderHint("generic");
      }}
    >
      <label className="field">
        <span>{messages.label}</span>
        <input name="label" placeholder="Team Skills" />
        <p className="field-help">{messages.labelHelp}</p>
      </label>
      <ProviderChoiceGroup
        language={language}
        value={providerHint}
        onChange={setProviderHint}
      />
      <label className="field form-span">
        <span>{messages.localPath}</span>
        <input name="localPath" placeholder="/Users/me/team/skills" />
        <p className="field-help">{messages.localPathHelp}</p>
      </label>
      <label className="field form-span">
        <span>{messages.remoteRepoSubpath}</span>
        <input name="remotePath" placeholder="roots/team-skills" />
        <p className="field-help">{messages.remoteRepoSubpathHelp}</p>
      </label>
      <div className="form-actions form-span">
        <button className="primary-button" type="submit">
          {messages.addRoot}
        </button>
      </div>
    </form>
  );
}
