import type { ReleaseFile } from "./manifest";
import { releaseFileUrl } from "./manifest";

// Windows updates use electron-updater's NSIS support, which works for
// unsigned apps (no publisher check) and installs silently per-user. Before
// downloading, the update it found must match the file hash in our signed
// manifest; electron-updater re-verifies the SHA-512 after download.

async function updater() {
  const { autoUpdater } = await import("electron-updater");
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  return autoUpdater;
}

export async function prepareWindowsUpdate(version: string, file: ReleaseFile, onProgress: (percent: number) => void) {
  const autoUpdater = await updater();
  // files/<version>/latest.yml, staged next to the installer.
  autoUpdater.setFeedURL({ provider: "generic", url: releaseFileUrl(version) });
  const result = await autoUpdater.checkForUpdates();
  const info = result?.updateInfo;
  const candidate = info?.files?.[0];
  if (!info || info.version !== version || !candidate || candidate.sha512 !== file.sha512) {
    throw new Error("The Windows update doesn't match the signed manifest.");
  }
  const onDownloadProgress = (progress: { percent: number }) => onProgress(Math.floor(progress.percent));
  autoUpdater.on("download-progress", onDownloadProgress);
  try {
    await autoUpdater.downloadUpdate();
  } finally {
    autoUpdater.off("download-progress", onDownloadProgress);
  }
  onProgress(100);
}

export async function installWindowsUpdate() {
  const autoUpdater = await updater();
  // isSilent: no installer UI; isForceRunAfter: relaunch when done.
  autoUpdater.quitAndInstall(true, true);
}
