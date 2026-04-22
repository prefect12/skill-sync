import { useState } from "react";
import { formatAppearanceLabel, getMessages } from "../lib/i18n";
import type { AppPreferences, AppearanceMode, Language } from "../lib/types";

type ChoiceValue = Language | AppearanceMode;
type SettingsTab = "general" | "appearance" | "advanced";

type ChoiceOption<T extends ChoiceValue> = {
  value: T;
  label: string;
};

function ChoiceGlyph({ value }: { value: ChoiceValue }) {
  if (value === "en" || value === "zh-CN") {
    return <span className="choice-button-letter">{value === "en" ? "A" : "文"}</span>;
  }

  if (value === "light") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 4.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V5a.75.75 0 0 1 .75-.75Zm0 12.75a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 12 17Zm7-5.75a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1 0-1.5H19Zm-12.5 0a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1 0-1.5h1.5Zm9.015-4.265a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06Zm-8.09 8.09a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06Zm9.15 2.12a.75.75 0 0 1 0-1.06l1.06-1.06a.75.75 0 0 1 1.06 1.06l-1.06 1.06a.75.75 0 0 1-1.06 0Zm-8.09-8.09a.75.75 0 0 1 0-1.06L8.545 6.98a.75.75 0 0 1 1.06 1.06l-1.06 1.06a.75.75 0 0 1-1.06 0ZM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (value === "dark") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M14.7 4.1a.75.75 0 0 1 .81 1.05 6.75 6.75 0 1 0 8.34 8.34.75.75 0 0 1 1.05.81A8.25 8.25 0 1 1 14.7 4.1Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5.75 6A1.75 1.75 0 0 1 7.5 4.25h9A1.75 1.75 0 0 1 18.25 6v7A1.75 1.75 0 0 1 16.5 14.75h-3.75v1.5h1.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5h1.5v-1.5H7.5A1.75 1.75 0 0 1 5.75 13V6Zm1.75-.25a.25.25 0 0 0-.25.25v7c0 .138.112.25.25.25h9a.25.25 0 0 0 .25-.25V6a.25.25 0 0 0-.25-.25h-9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SettingsTabGlyph({ tab }: { tab: SettingsTab }) {
  if (tab === "general") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M10.09 3.45a1 1 0 0 1 .98-.8h1.86a1 1 0 0 1 .98.8l.28 1.36c.47.14.92.33 1.34.57l1.29-.74a1 1 0 0 1 1.24.2l1.31 1.31a1 1 0 0 1 .2 1.24l-.74 1.29c.24.42.43.87.57 1.34l1.36.28a1 1 0 0 1 .8.98v1.86a1 1 0 0 1-.8.98l-1.36.28a6.7 6.7 0 0 1-.57 1.34l.74 1.29a1 1 0 0 1-.2 1.24l-1.31 1.31a1 1 0 0 1-1.24.2l-1.29-.74c-.42.24-.87.43-1.34.57l-.28 1.36a1 1 0 0 1-.98.8h-1.86a1 1 0 0 1-.98-.8l-.28-1.36a6.7 6.7 0 0 1-1.34-.57l-1.29.74a1 1 0 0 1-1.24-.2L4.69 18.8a1 1 0 0 1-.2-1.24l.74-1.29a6.7 6.7 0 0 1-.57-1.34l-1.36-.28a1 1 0 0 1-.8-.98v-1.86a1 1 0 0 1 .8-.98l1.36-.28c.14-.47.33-.92.57-1.34l-.74-1.29a1 1 0 0 1 .2-1.24L6 4.68a1 1 0 0 1 1.24-.2l1.29.74c.42-.24.87-.43 1.34-.57l.28-1.2ZM12 8.25A3.75 3.75 0 1 0 12 15.75 3.75 3.75 0 0 0 12 8.25Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (tab === "appearance") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4.75 5.5A1.75 1.75 0 0 1 6.5 3.75h11A1.75 1.75 0 0 1 19.25 5.5v13A1.75 1.75 0 0 1 17.5 20.25h-11A1.75 1.75 0 0 1 4.75 18.5v-13Zm1.5 0v13c0 .14.11.25.25.25h5.75v-13.5H6.5a.25.25 0 0 0-.25.25Zm7.5 13.25h3.75a.25.25 0 0 0 .25-.25v-13a.25.25 0 0 0-.25-.25h-3.75v13.5Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 5.75A1.75 1.75 0 0 1 6.75 4h10.5A1.75 1.75 0 0 1 19 5.75v5.5A1.75 1.75 0 0 1 17.25 13H6.75A1.75 1.75 0 0 1 5 11.25v-5.5Zm1.75-.25a.25.25 0 0 0-.25.25v5.5c0 .14.11.25.25.25h10.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25H6.75Zm1.5 10.75A2.25 2.25 0 1 1 10.5 18.5 2.25 2.25 0 0 1 8.25 16.25Zm7.5 0A2.25 2.25 0 1 1 18 18.5a2.25 2.25 0 0 1-2.25-2.25Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChoiceGroup<T extends ChoiceValue>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="settings-choice-group">
      <span className="settings-choice-label">{label}</span>
      <div className="settings-choice-grid" role="group" aria-label={label}>
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
                <ChoiceGlyph value={option.value} />
              </span>
              <span className="choice-button-label">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsWindow({
  preferences,
  onLanguageChange,
  onAppearanceChange,
  onShowTechnicalActivityChange
}: {
  preferences: AppPreferences;
  onLanguageChange: (language: Language) => void;
  onAppearanceChange: (appearance: AppearanceMode) => void;
  onShowTechnicalActivityChange: (value: boolean) => void;
}) {
  const messages = getMessages(preferences.language);
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const languageOptions: ChoiceOption<Language>[] = [
    { value: "zh-CN", label: messages.languageChinese },
    { value: "en", label: messages.languageEnglish }
  ];
  const appearanceOptions: ChoiceOption<AppearanceMode>[] = [
    { value: "system", label: formatAppearanceLabel(preferences.language, "system") },
    { value: "light", label: formatAppearanceLabel(preferences.language, "light") },
    { value: "dark", label: formatAppearanceLabel(preferences.language, "dark") }
  ];
  const tabs: Array<{ key: SettingsTab; label: string }> = [
    { key: "general", label: messages.settingsGeneral },
    { key: "appearance", label: messages.appearanceLabel },
    { key: "advanced", label: messages.settingsAdvanced }
  ];

  return (
    <div className="window-shell utility-window">
      <main className="window-content settings-content preferences-content">
        <section className="preferences-frame">
          <nav className="preferences-tabbar" aria-label={messages.settingsTitle}>
            {tabs.map((tab) => {
              const active = tab.key === activeTab;

              return (
                <button
                  key={tab.key}
                  type="button"
                  className={active ? "preferences-tab active" : "preferences-tab"}
                  aria-pressed={active}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <span className="preferences-tab-icon">
                    <SettingsTabGlyph tab={tab.key} />
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <section className="preferences-body">
            {activeTab === "general" ? (
              <div className="preferences-panel">
                <div className="preferences-panel-header">
                  <h2>{messages.settingsGeneral}</h2>
                  <p>{messages.settingsSubtitle}</p>
                </div>
                <div className="preferences-panel-content">
                  <ChoiceGroup
                    label={messages.languageLabel}
                    value={preferences.language}
                    options={languageOptions}
                    onChange={onLanguageChange}
                  />
                </div>
              </div>
            ) : null}

            {activeTab === "appearance" ? (
              <div className="preferences-panel">
                <div className="preferences-panel-header">
                  <h2>{messages.appearanceLabel}</h2>
                  <p>{messages.settingsSubtitle}</p>
                </div>
                <div className="preferences-panel-content">
                  <ChoiceGroup
                    label={messages.appearanceLabel}
                    value={preferences.appearance}
                    options={appearanceOptions}
                    onChange={onAppearanceChange}
                  />
                </div>
              </div>
            ) : null}

            {activeTab === "advanced" ? (
              <div className="preferences-panel">
                <div className="preferences-panel-header">
                  <h2>{messages.settingsAdvanced}</h2>
                  <p>{messages.settingsSubtitle}</p>
                </div>
                <div className="preferences-panel-content">
                  <label className="preferences-toggle-row">
                    <span className="preferences-toggle-copy">
                      <strong>{messages.showTechnicalActivity}</strong>
                      <span>{messages.inspectorTitle}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={preferences.showTechnicalActivity}
                      onChange={(event) =>
                        onShowTechnicalActivityChange(event.target.checked)
                      }
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </section>
        </section>
      </main>
    </div>
  );
}
