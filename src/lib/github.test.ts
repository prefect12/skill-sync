import { describe, expect, it } from "vitest";
import {
  canWriteToRepository,
  parseGitHubRepositoryUrl,
  resolvePreferredOwner,
  shouldUseGitHubPicker
} from "./github";

describe("github helpers", () => {
  it("parses https and ssh repository urls", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/acme/skills.git")?.fullName).toBe(
      "acme/skills"
    );
    expect(parseGitHubRepositoryUrl("git@github.com:acme/skills.git")?.fullName).toBe(
      "acme/skills"
    );
  });

  it("rejects non-github hosts", () => {
    expect(parseGitHubRepositoryUrl("https://gitlab.com/acme/skills")).toBeNull();
  });

  it("chooses picker mode only when gh is available and authenticated", () => {
    expect(
      shouldUseGitHubPicker({ cliAvailable: true, authenticated: true, username: "prefect12" })
    ).toBe(true);
    expect(shouldUseGitHubPicker({ cliAvailable: true, authenticated: false })).toBe(false);
  });

  it("prefers repository owner, then stored owner, then username", () => {
    const owners = [
      { login: "prefect12", kind: "user" as const },
      { login: "AhaAITeam", kind: "org" as const }
    ];

    expect(
      resolvePreferredOwner({
        owners,
        storedOwner: "prefect12",
        repoUrl: "https://github.com/AhaAITeam/seed-next",
        username: "prefect12"
      })
    ).toBe("AhaAITeam");

    expect(
      resolvePreferredOwner({
        owners,
        storedOwner: "prefect12",
        repoUrl: "",
        username: "ignored"
      })
    ).toBe("prefect12");
  });

  it("blocks sync only for explicit read-only permissions", () => {
    expect(canWriteToRepository("ADMIN")).toBe(true);
    expect(canWriteToRepository("WRITE")).toBe(true);
    expect(canWriteToRepository("READ")).toBe(false);
    expect(canWriteToRepository("TRIAGE")).toBe(false);
    expect(canWriteToRepository(undefined)).toBe(true);
  });
});
