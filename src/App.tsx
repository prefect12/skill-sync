import { useEffect } from "react";
import { MainSyncWindow } from "./components/MainSyncWindow";
import { RootsWindow } from "./components/RootsWindow";
import { MENU_COMMAND_EVENT, type MenuCommand } from "./lib/menu";
import { SettingsWindow } from "./components/SettingsWindow";
import { getWindowView, isTauriRuntime, openAppWindow } from "./lib/windowing";
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
    if (!isTauriRuntime()) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const unsubscribe = await listen<MenuCommand>(MENU_COMMAND_EVENT, (event) => {
        if (event.payload === "open-roots") {
          void openAppWindow("roots");
        }

        if (event.payload === "open-settings") {
          void openAppWindow("settings");
        }
      });

      if (disposed) {
        unsubscribe();
        return;
      }

      unlisten = unsubscribe;
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
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
