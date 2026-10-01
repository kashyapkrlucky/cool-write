import { app, type BrowserWindow } from "electron";
import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { format } from "node:util";

// Local, private crash/error logging ($0: no external service). Logs live in
// the OS log folder (macOS: ~/Library/Logs/Cool Write) and rotate at 1 MB;
// Help → Open Logs Folder lets a user attach them to a bug report.

const MAX_BYTES = 1024 * 1024;
let logFile: string | null = null;

function write(level: "info" | "warn" | "error", args: unknown[]) {
  if (!logFile) return;
  try {
    try {
      if (statSync(logFile).size > MAX_BYTES) renameSync(logFile, logFile.replace(/\.log$/, ".old.log"));
    } catch {
      // No log file yet.
    }
    appendFileSync(logFile, `${new Date().toISOString()} [${level}] ${format(...args)}\n`);
  } catch {
    // Logging must never crash the app.
  }
}

export function logInfo(...args: unknown[]) {
  console.info(...args);
  write("info", args);
}

export function setupLogging() {
  const dir = app.getPath("logs");
  mkdirSync(dir, { recursive: true });
  logFile = join(dir, "main.log");

  // Mirror main-process warnings/errors (including the updater's) into the file.
  for (const level of ["warn", "error"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      write(level, args);
    };
  }

  process.on("uncaughtException", (error) => console.error("Uncaught exception:", error));
  process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));
  app.on("child-process-gone", (_event, details) => {
    if (details.reason !== "clean-exit") console.error("Child process gone:", details);
  });

  logInfo(`Cool Write ${app.getVersion()} starting (${process.platform}-${process.arch}, Electron ${process.versions.electron})`);
}

// If the page's renderer crashes, reload it rather than leaving a dead window —
// but at most a few times a minute, so a crash loop doesn't spin forever.
export function recoverFromRendererCrashes(window: BrowserWindow, reload: () => void) {
  const recent: number[] = [];
  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer process gone:", details);
    if (details.reason === "clean-exit") return;
    const now = Date.now();
    while (recent.length && now - recent[0]! > 60_000) recent.shift();
    recent.push(now);
    if (recent.length <= 3) reload();
  });
  window.webContents.on("unresponsive", () => console.warn("Window became unresponsive"));
}
