import { describe, expect, it } from "vitest";
import { mergeRootConfigs } from "./persistence";
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

describe("persistence helpers", () => {
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
});
