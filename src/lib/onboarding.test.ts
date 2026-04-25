import { describe, expect, it } from "vitest";
import { isFirstBackupRecommended, resolveOnboardingStep } from "./onboarding";

describe("onboarding helpers", () => {
  it("walks first-time users from discovery to connection to first backup", () => {
    expect(
      resolveOnboardingStep({
        dismissed: false,
        repoUrl: "",
        repoUrlError: "",
        localSkillCount: 0,
        remoteSkillCount: 0
      })
    ).toBe("discover");

    expect(
      resolveOnboardingStep({
        dismissed: false,
        repoUrl: "",
        repoUrlError: "",
        localSkillCount: 3,
        remoteSkillCount: 0
      })
    ).toBe("connect");

    expect(
      resolveOnboardingStep({
        dismissed: false,
        repoUrl: "https://github.com/acme/skills",
        repoUrlError: "",
        localSkillCount: 3,
        remoteSkillCount: 0
      })
    ).toBe("backup");
  });

  it("finishes onboarding when dismissed or when both sides already have skills", () => {
    expect(
      resolveOnboardingStep({
        dismissed: true,
        repoUrl: "",
        repoUrlError: "",
        localSkillCount: 3,
        remoteSkillCount: 0
      })
    ).toBe("done");

    expect(
      resolveOnboardingStep({
        dismissed: false,
        repoUrl: "https://github.com/acme/skills",
        repoUrlError: "",
        localSkillCount: 3,
        remoteSkillCount: 2
      })
    ).toBe("done");
  });

  it("recommends first backup only for an empty connected GitHub repository", () => {
    expect(
      isFirstBackupRecommended({
        repoUrl: "https://github.com/acme/skills",
        repoUrlError: "",
        localSkillCount: 3,
        remoteSkillCount: 0
      })
    ).toBe(true);

    expect(
      isFirstBackupRecommended({
        repoUrl: "https://github.com/acme/skills",
        repoUrlError: "",
        localSkillCount: 3,
        remoteSkillCount: 1
      })
    ).toBe(false);
  });
});
