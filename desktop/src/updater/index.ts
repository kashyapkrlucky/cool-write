import { app, shell } from "electron";
import { APP_ORIGIN } from "../config";
import { compareVersions, currentTarget, fetchVerifiedManifest, UPDATES_ENABLED } from "./manifest";
import { installMacUpdate, macInstallBlocker, prepareMacUpdate, removeOldWorkDirs } from "./mac";
import { installWindowsUpdate, prepareWindowsUpdate } from "./win";

// Update lifecycle: check → verify signed manifest → download in
// the background → "ready" (the web app shows an Update button) → install on click.

export type UpdateStatus =
  | { state: "disabled"; reason: string }
  | { state: "idle" }
  | { state: "checking" }
  | { state: "up-to-date"; version: string }
  | { state: "downloading"; version: string; percent: number }
  // mode "manual": this install can't replace itself; the button opens the download page.
  | { state: "ready"; version: string; notes?: string; mode: "install" | "manual"; reason?: string }
  | { state: "error"; message: string };

const FIRST_CHECK_DELAY_MS = 10_000;
const CHECK_INTERVAL_MS = 4 * 60 * 60_000;

let status: UpdateStatus = UPDATES_ENABLED ? { state: "idle" } : { state: "disabled", reason: "no update key in this build" };
let listener: (status: UpdateStatus) => void = () => {};
let stagedMacApp: string | null = null;
let checking: Promise<UpdateStatus> | null = null;

function setStatus(next: UpdateStatus) {
  status = next;
  listener(status);
}

export function getUpdateStatus() {
  return status;
}

export function onUpdateStatus(fn: (status: UpdateStatus) => void) {
  listener = fn;
}

export function checkForUpdates(): Promise<UpdateStatus> {
  if (status.state === "disabled" || status.state === "ready" || status.state === "downloading") {
    return Promise.resolve(status);
  }
  checking ??= runCheck().finally(() => {
    checking = null;
  });
  return checking;
}

async function runCheck(): Promise<UpdateStatus> {
  const target = currentTarget();
  if (!target) {
    setStatus({ state: "disabled", reason: `no builds for ${process.platform}-${process.arch}` });
    return status;
  }
  setStatus({ state: "checking" });
  try {
    const manifest = await fetchVerifiedManifest("stable");
    const entry = manifest.files[target];
    if (compareVersions(manifest.version, app.getVersion()) <= 0 || !entry?.update) {
      setStatus({ state: "up-to-date", version: app.getVersion() });
      return status;
    }
    const { version, notes } = manifest;

    if (process.platform === "darwin") {
      const blocker = await macInstallBlocker();
      if (blocker) {
        setStatus({ state: "ready", version, notes, mode: "manual", reason: blocker });
        return status;
      }
      setStatus({ state: "downloading", version, percent: 0 });
      stagedMacApp = await prepareMacUpdate(version, entry.update, (percent) =>
        setStatus({ state: "downloading", version, percent }),
      );
    } else {
      setStatus({ state: "downloading", version, percent: 0 });
      await prepareWindowsUpdate(version, entry.update, (percent) => setStatus({ state: "downloading", version, percent }));
    }
    setStatus({ state: "ready", version, notes, mode: "install" });
  } catch (error) {
    console.error("Update check failed:", error);
    setStatus({ state: "error", message: error instanceof Error ? error.message : "Update check failed" });
  }
  return status;
}

export function startAutoUpdates() {
  if (!UPDATES_ENABLED || !app.isPackaged) return;
  // Leftovers from an update that was downloaded but never installed.
  if (process.platform === "darwin") void removeOldWorkDirs();
  setTimeout(() => void checkForUpdates(), FIRST_CHECK_DELAY_MS);
  setInterval(() => void checkForUpdates(), CHECK_INTERVAL_MS);
}

// Called when the user clicks "Update". `flushSaves` lets the web app finish
// pending document saves before the app quits.
export async function installUpdate(flushSaves: () => Promise<void>) {
  if (status.state !== "ready") return;
  if (status.mode === "manual") {
    void shell.openExternal(`${APP_ORIGIN}/download`);
    return;
  }
  await flushSaves();
  if (process.platform === "darwin") {
    if (stagedMacApp) await installMacUpdate(stagedMacApp);
  } else {
    await installWindowsUpdate();
  }
}
