import { useEffect, useLayoutEffect } from "react";
import { MainSyncWindow } from "./components/MainSyncWindow";
import { RootsWindow } from "./components/RootsWindow";
import { SettingsWindow } from "./components/SettingsWindow";
import { getWindowView, revealCurrentAppWindow } from "./lib/windowing";
import { usePreferencesState } from "./state/usePreferencesState";

function resolveTheme(appearance: "system" | "light" | "dark") {
  if (appearance === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return appearance;
}

export default function App() {
  const { preferences, updateAppearance, updateLanguage, setShowTechnicalActivity } =
    usePreferencesState();
  const view = getWindowView();

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(preferences.appearance);
  }, [preferences.appearance]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      document.documentElement.dataset.theme = resolveTheme(preferences.appearance);
    };

    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => {
      media.removeEventListener("change", applyTheme);
    };
  }, [preferences.appearance]);

  useEffect(() => {
    void revealCurrentAppWindow();
  }, []);

  if (view === "roots") {
    return <RootsWindow language={preferences.language} />;
  }

  if (view === "settings") {
    return (
      <SettingsWindow
        preferences={preferences}
        onLanguageChange={updateLanguage}
        onAppearanceChange={updateAppearance}
        onShowTechnicalActivityChange={setShowTechnicalActivity}
      />
    );
  }

  return <MainSyncWindow preferences={preferences} />;
}
