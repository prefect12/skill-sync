import type {
  GitHubOwner,
  GitHubRepository,
  GitHubRepositoryValidation,
  GitHubStatus
} from "./types";

const WRITABLE_PERMISSIONS = new Set(["ADMIN", "MAINTAIN", "WRITE"]);
const READ_ONLY_PERMISSIONS = new Set(["READ", "TRIAGE"]);

function trimRepoSuffix(value: string) {
  return value.replace(/\.git$/i, "").replace(/\/+$/, "");
}

function buildValidation(fullName: string): GitHubRepositoryValidation {
  return {
    fullName,
    url: `https://github.com/${fullName}`,
    sshUrl: `git@github.com:${fullName}.git`
  };
}

export function normalizeRepositoryFullName(input: string) {
  const trimmed = trimRepoSuffix(input.trim());
  const parts = trimmed.split("/").filter(Boolean);

  if (parts.length !== 2) {
    return null;
  }

  const [owner, name] = parts;
  if (!owner || !name) {
    return null;
  }

  return `${owner}/${name}`;
}

export function parseGitHubRepositoryUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const sshMatch = trimmed.match(/^git@github\.com:(.+)$/i);
  if (sshMatch?.[1]) {
    const fullName = normalizeRepositoryFullName(sshMatch[1]);
    return fullName ? buildValidation(fullName) : null;
  }

  const sshUrlMatch = trimmed.match(/^ssh:\/\/git@github\.com\/(.+)$/i);
  if (sshUrlMatch?.[1]) {
    const fullName = normalizeRepositoryFullName(sshUrlMatch[1]);
    return fullName ? buildValidation(fullName) : null;
  }

  if (!trimmed.includes(":")) {
    const direct = normalizeRepositoryFullName(trimmed);
    if (direct) {
      return buildValidation(direct);
    }
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.hostname.toLowerCase() !== "github.com") {
      return null;
    }

    const fullName = normalizeRepositoryFullName(parsed.pathname);
    return fullName ? buildValidation(fullName) : null;
  } catch {
    return null;
  }
}

export function isValidGitHubRepositoryUrl(input: string) {
  return Boolean(parseGitHubRepositoryUrl(input));
}

export function shouldUseGitHubPicker(status: GitHubStatus) {
  return status.cliAvailable && status.authenticated;
}

export function resolvePreferredOwner({
  owners,
  storedOwner,
  repoUrl,
  username
}: {
  owners: GitHubOwner[];
  storedOwner: string;
  repoUrl: string;
  username?: string;
}) {
  const ownerLogins = new Set(owners.map((owner) => owner.login));
  const repoOwner = parseGitHubRepositoryUrl(repoUrl)?.fullName.split("/")[0];

  if (repoOwner && ownerLogins.has(repoOwner)) {
    return repoOwner;
  }

  if (storedOwner && ownerLogins.has(storedOwner)) {
    return storedOwner;
  }

  if (username && ownerLogins.has(username)) {
    return username;
  }

  return owners[0]?.login ?? "";
}

export function findGitHubRepository(
  repositories: GitHubRepository[],
  repoUrl: string
) {
  const fullName = parseGitHubRepositoryUrl(repoUrl)?.fullName;
  if (!fullName) {
    return null;
  }

  return repositories.find((repository) => repository.fullName === fullName) ?? null;
}

export function isReadOnlyPermission(viewerPermission?: string) {
  return viewerPermission ? READ_ONLY_PERMISSIONS.has(viewerPermission.toUpperCase()) : false;
}

export function canWriteToRepository(viewerPermission?: string) {
  if (!viewerPermission) {
    return true;
  }

  const normalized = viewerPermission.toUpperCase();
  if (READ_ONLY_PERMISSIONS.has(normalized)) {
    return false;
  }

  return WRITABLE_PERMISSIONS.has(normalized) || !READ_ONLY_PERMISSIONS.has(normalized);
}
