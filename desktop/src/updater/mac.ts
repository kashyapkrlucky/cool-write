import { app, net } from "electron";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, constants, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import type { ReleaseFile } from "./manifest";
import { releaseFileUrl } from "./manifest";

// Custom updater for macOS. Squirrel.Mac — what electron-updater
// uses on macOS — requires a paid Developer ID signature, so ad-hoc signed
// builds replace their own bundle instead. Files this app downloads itself are
// not quarantined, so the new bundle launches without a Gatekeeper prompt.

const run = promisify(execFile);
const BUNDLE_ID = "app.coolwrite.desktop";

// …/Cool Write.app/Contents/MacOS/Cool Write → …/Cool Write.app
export function currentBundlePath() {
  return resolve(process.execPath, "..", "..", "..");
}

// Why this install can't replace itself (then the user gets a manual download instead).
export async function macInstallBlocker(): Promise<string | null> {
  if (!app.isPackaged) return "Development builds don't self-update.";
  const bundle = currentBundlePath();
  if (bundle.includes("/AppTranslocation/")) {
    return "Move Cool Write to your Applications folder to enable automatic updates.";
  }
  if (bundle.startsWith("/Volumes/")) {
    return "Cool Write is running from the installer disk image. Drag it into Applications first.";
  }
  try {
    await access(dirname(bundle), constants.W_OK);
  } catch {
    return "Cool Write can't write to the folder it's installed in.";
  }
  return null;
}

async function download(url: string, destination: string, expected: ReleaseFile, onProgress: (percent: number) => void) {
  // no-store: verify exactly what the server sends now, and don't keep a
  // second copy of a ~130 MB archive in the browser cache.
  const res = await net.fetch(url, { cache: "no-store" });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  const hash = createHash("sha512");
  const out = createWriteStream(destination);
  let received = 0;
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
      received += value.byteLength;
      if (!out.write(value)) await new Promise<void>((r) => out.once("drain", () => r()));
      onProgress(Math.min(99, Math.floor((received / expected.size) * 100)));
    }
  } finally {
    await new Promise<void>((r) => out.end(r));
  }
  if (received !== expected.size || hash.digest("base64") !== expected.sha512) {
    throw new Error("Downloaded update doesn't match the signed manifest.");
  }
}

const WORK_DIR_PREFIX = "cool-write-update-";

export async function removeOldWorkDirs() {
  const temp = app.getPath("temp");
  const entries = await readdir(temp).catch(() => [] as string[]);
  await Promise.all(
    entries
      .filter((name) => name.startsWith(WORK_DIR_PREFIX))
      .map((name) => rm(join(temp, name), { recursive: true, force: true, maxRetries: 3 }).catch(() => {})),
  );
}

async function readPlist(appPath: string, key: string) {
  const { stdout } = await run("/usr/bin/plutil", ["-extract", key, "raw", "-o", "-", join(appPath, "Contents", "Info.plist")]);
  return stdout.trim();
}

// Downloads, verifies and unpacks the update next to the temp dir. Returns the
// path of the staged .app, ready for installMacUpdate().
export async function prepareMacUpdate(version: string, file: ReleaseFile, onProgress: (percent: number) => void) {
  // A fresh folder per attempt: clearing a previous attempt's bundle can fail
  // (ENOTEMPTY) on macOS, and a stuck folder must never block updates.
  await removeOldWorkDirs();
  const workDir = await mkdtemp(join(app.getPath("temp"), `${WORK_DIR_PREFIX}${version}-`));

  const zipPath = join(workDir, file.name);
  await download(releaseFileUrl(`${version}/${file.name}`), zipPath, file, onProgress);

  const stagingDir = join(workDir, "staged");
  await run("/usr/bin/ditto", ["-x", "-k", zipPath, stagingDir]);
  await rm(zipPath, { force: true });

  const stagedApp = join(stagingDir, "Cool Write.app");
  // Sanity checks on what we're about to install: a valid (ad-hoc) signature,
  // our bundle id, and the version the signed manifest promised.
  await run("/usr/bin/codesign", ["--verify", "--deep", "--strict", stagedApp]);
  if ((await readPlist(stagedApp, "CFBundleIdentifier")) !== BUNDLE_ID) throw new Error("Update has an unexpected bundle id.");
  if ((await readPlist(stagedApp, "CFBundleShortVersionString")) !== version) throw new Error("Update has an unexpected version.");

  onProgress(100);
  return stagedApp;
}

// Waits for this process to exit, swaps the bundle (rolling back on failure),
// strips quarantine defensively, and relaunches. Paths come from app.getPath /
// process.execPath, never from the manifest.
const INSTALL_SCRIPT = `#!/bin/sh
PID="$1"; TARGET="$2"; STAGED="$3"; BACKUP="$4"
i=0
while kill -0 "$PID" 2>/dev/null; do
  i=$((i + 1)); [ "$i" -gt 300 ] && exit 1
  sleep 0.1
done
rm -rf "$BACKUP"
if mv "$TARGET" "$BACKUP"; then
  if /usr/bin/ditto "$STAGED" "$TARGET"; then
    /usr/bin/xattr -dr com.apple.quarantine "$TARGET" 2>/dev/null
    rm -rf "$BACKUP"
  else
    rm -rf "$TARGET"
    mv "$BACKUP" "$TARGET"
  fi
fi
# STAGED is <work dir>/staged/Cool Write.app; remove the whole work dir.
rm -rf "$(dirname "$(dirname "$STAGED")")"
/usr/bin/open "$TARGET"
`;

export async function installMacUpdate(stagedApp: string) {
  const target = currentBundlePath();
  const backup = join(dirname(target), `.Cool Write.app.previous`);
  const script = join(dirname(dirname(stagedApp)), "install.sh");
  await writeFile(script, INSTALL_SCRIPT, { mode: 0o700 });
  spawn("/bin/sh", [script, String(process.pid), target, stagedApp, backup], {
    detached: true,
    stdio: "ignore",
  }).unref();
  app.quit();
}
