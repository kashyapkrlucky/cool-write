import { app, dialog, type BrowserWindow } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logInfo } from "./logging";
import { compareVersions, fetchVerifiedManifest, UPDATES_ENABLED } from "./updater/manifest";

// After an update, tell the user what changed — once. Notes come from the
// new version's signed manifest; a generic line is shown if they can't load.

const versionFile = () => join(app.getPath("userData"), "last-version.json");

function readLastVersion(): string | null {
  try {
    const { version } = JSON.parse(readFileSync(versionFile(), "utf8"));
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}

export async function showWhatsNewIfUpdated(window: BrowserWindow) {
  const current = app.getVersion();
  const previous = readLastVersion();
  try {
    writeFileSync(versionFile(), JSON.stringify({ version: current }));
  } catch (error) {
    console.warn("Couldn't record app version:", error);
  }
  // First install, same version, or a downgrade: nothing to announce.
  if (!previous || compareVersions(current, previous) <= 0) return;

  let notes: string | undefined;
  if (UPDATES_ENABLED) {
    notes = await fetchVerifiedManifest(current)
      .then((manifest) => manifest.notes)
      .catch(() => undefined);
  }
  logInfo(`Updated ${previous} → ${current}; showing what's new`);
  if (window.isDestroyed()) return;
  await dialog.showMessageBox(window, {
    type: "info",
    message: `Cool Write is now version ${current}`,
    detail: notes?.trim() || "You're on the latest version. Thanks for updating!",
    buttons: ["OK"],
  });
}
