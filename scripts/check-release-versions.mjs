import { readFile } from "node:fs/promises";
import process from "node:process";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function normalizeTag(rawTag) {
  return rawTag.trim().replace(/^refs\/tags\//, "");
}

function readCargoVersion(contents) {
  const match = contents.match(/^version\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error("Unable to find version in src-tauri/Cargo.toml");
  }

  return match[1];
}

async function main() {
  const [pkg, tauriConfig, cargoToml] = await Promise.all([
    readJson("package.json"),
    readJson("src-tauri/tauri.conf.json"),
    readFile("src-tauri/Cargo.toml", "utf8"),
  ]);

  const versions = {
    "package.json": pkg.version,
    "src-tauri/tauri.conf.json": tauriConfig.version,
    "src-tauri/Cargo.toml": readCargoVersion(cargoToml),
  };

  const uniqueVersions = [...new Set(Object.values(versions))];
  if (uniqueVersions.length !== 1) {
    console.error("Release version mismatch detected:");
    for (const [file, version] of Object.entries(versions)) {
      console.error(`- ${file}: ${version}`);
    }
    process.exit(1);
  }

  const appVersion = uniqueVersions[0];
  const releaseTagInput = process.env.RELEASE_TAG;
  if (releaseTagInput) {
    const releaseTag = normalizeTag(releaseTagInput);
    const expectedTag = `v${appVersion}`;
    if (releaseTag !== expectedTag) {
      console.error(
        `Release tag mismatch: expected ${expectedTag}, received ${releaseTag}`,
      );
      process.exit(1);
    }
  }

  console.log(`Release versions are aligned at ${appVersion}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
