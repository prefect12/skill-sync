import { formatAppearanceLabel, getMessages } from "../lib/i18n";
import { closeCurrentAppWindow } from "../lib/windowing";
import type { AppPreferences, AppearanceMode, Language } from "../lib/types";

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

  return (
    <div className="window-shell utility-window">
      <main className="window-content settings-content">
        <header className="utility-header">
          <div>
            <p className="toolbar-kicker">{messages.settingsTitle}</p>
            <h1>{messages.settingsTitle}</h1>
            <p className="toolbar-subtitle">{messages.settingsSubtitle}</p>
          </div>
          <button className="secondary-button" onClick={() => void closeCurrentAppWindow()}>
            {messages.close}
          </button>
        </header>

        <section className="settings-sections">
          <section className="pane settings-pane">
            <div className="section-heading">
              <h2>{messages.settingsGeneral}</h2>
            </div>
            <div className="form-grid">
              <label className="field form-span">
                <span>{messages.languageLabel}</span>
                <select
                  value={preferences.language}
                  onChange={(event) => onLanguageChange(event.target.value as Language)}
                >
                  <option value="en">{messages.languageEnglish}</option>
                  <option value="zh-CN">{messages.languageChinese}</option>
                </select>
              </label>
              <label className="field form-span">
                <span>{messages.appearanceLabel}</span>
                <select
                  value={preferences.appearance}
                  onChange={(event) =>
                    onAppearanceChange(event.target.value as AppearanceMode)
                  }
                >
                  <option value="system">
                    {formatAppearanceLabel(preferences.language, "system")}
                  </option>
                  <option value="light">
                    {formatAppearanceLabel(preferences.language, "light")}
                  </option>
                  <option value="dark">
                    {formatAppearanceLabel(preferences.language, "dark")}
                  </option>
                </select>
              </label>
            </div>
          </section>

          <section className="pane settings-pane">
            <div className="section-heading">
              <h2>{messages.settingsAdvanced}</h2>
            </div>
            <label className="radio-row checkbox-row">
              <input
                type="checkbox"
                checked={preferences.showTechnicalActivity}
                onChange={(event) =>
                  onShowTechnicalActivityChange(event.target.checked)
                }
              />
              <span>{messages.showTechnicalActivity}</span>
            </label>
          </section>
        </section>
      </main>
    </div>
  );
}
