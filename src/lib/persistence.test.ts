import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IGNORED_SKILL_IDS_KEY,
  mergeRootConfigs,
  readIgnoredSkillIds,
  writeIgnoredSkillIds
} from "./persistence";
import type { SkillRootConfig } from "./types";

const BUILT_IN_ROOT: SkillRootConfig = {
  id: "codex-home",
  label: "Codex Home",
  kind: "codex-home",
  providerHint: "codex",
  localPath: "~/.codex/skills",
  remotePath: "roots/codex-home",
  enabled: true
};

function stubLocalStorage() {
  const storage = new Map<string, string>();

  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      }
    }
  });

  return storage;
}

describe("persistence helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies built-in overrides without turning presets into custom roots", () => {
    const merged = mergeRootConfigs(
      [BUILT_IN_ROOT],
      [
        {
          id: "team-shared",
          label: "Team Shared",
          kind: "custom",
          providerHint: "generic",
          localPath: "~/Skills/team",
          remotePath: "roots/team-shared",
          enabled: true
        }
      ],
      {
        "codex-home": {
          label: "My Codex Root",
          localPath: "~/Custom/Codex"
        }
      }
    );

    expect(merged).toEqual([
      {
        ...BUILT_IN_ROOT,
        label: "My Codex Root",
        localPath: "~/Custom/Codex"
      },
      {
        id: "team-shared",
        label: "Team Shared",
        kind: "custom",
        providerHint: "generic",
        localPath: "~/Skills/team",
        remotePath: "roots/team-shared",
        enabled: true
      }
    ]);
  });

  it("persists legacy local ignored skill ids", () => {
    const storage = stubLocalStorage();

    writeIgnoredSkillIds({
      "codex-home:local-only": true,
      "claude-home:team-note": true
    });

    expect(JSON.parse(storage.get(IGNORED_SKILL_IDS_KEY) ?? "{}")).toEqual({
      "codex-home:local-only": true,
      "claude-home:team-note": true
    });
    expect(readIgnoredSkillIds()).toEqual({
      "codex-home:local-only": true,
      "claude-home:team-note": true
    });
  });

  it("keeps reading older local ignored skill arrays", () => {
    const storage = stubLocalStorage();
    storage.set(
      IGNORED_SKILL_IDS_KEY,
      JSON.stringify(["codex-home:old-skill", "claude-home:old-skill"])
    );

    expect(readIgnoredSkillIds()).toEqual({
      "codex-home:old-skill": true,
      "claude-home:old-skill": true
    });
  });
});
