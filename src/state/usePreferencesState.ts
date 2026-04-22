import { useEffect, useState } from "react";
import {
  readPreferences,
  writePreferences
} from "../lib/persistence";
import type { AppPreferences, AppearanceMode, Language } from "../lib/types";

export function usePreferencesState() {
  const [preferences, setPreferences] = useState<AppPreferences>(readPreferences);

  useEffect(() => {
    writePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    const syncFromStorage = (event: StorageEvent) => {
      if (event && event.key && event.key !== "skill-sync/preferences") {
        return;
      }
      setPreferences(readPreferences());
    };
    const syncFromFocus = () => {
      setPreferences(readPreferences());
    };

    window.addEventListener("storage", syncFromStorage);
    window.addEventListener("focus", syncFromFocus);

    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener("focus", syncFromFocus);
    };
  }, []);

  function updateLanguage(language: Language) {
    setPreferences((current) => ({ ...current, language }));
  }

  function updateAppearance(appearance: AppearanceMode) {
    setPreferences((current) => ({ ...current, appearance }));
  }

  function setShowTechnicalActivity(showTechnicalActivity: boolean) {
    setPreferences((current) => ({ ...current, showTechnicalActivity }));
  }

  return {
    preferences,
    setPreferences,
    updateLanguage,
    updateAppearance,
    setShowTechnicalActivity
  };
}
