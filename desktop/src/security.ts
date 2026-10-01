import { app, BrowserWindow, session, shell, type WebContents } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { APP_ORIGIN, isAppUrl, SESSION_PARTITION } from "./config";

const EXTERNAL_PROTOCOLS = new Set(["https:", "mailto:"]);

export function openExternalSafely(url: string) {
  try {
    if (EXTERNAL_PROTOCOLS.has(new URL(url).protocol)) void shell.openExternal(url);
  } catch {
    // Not a URL — ignore.
  }
}

// Bundled pages (offline screen, sign-in screen) shipped inside the app.
const LOCAL_PAGES_BASE = `${pathToFileURL(join(__dirname, "static")).href}/`;

export function localPageUrl(name: "offline.html" | "signin.html", params: Record<string, string> = {}) {
  const url = new URL(name, LOCAL_PAGES_BASE);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export function isLocalPage(url: string) {
  return url.startsWith(LOCAL_PAGES_BASE) && !url.slice(LOCAL_PAGES_BASE.length).includes("..");
}

// Only our web app (and the bundled offline page) may load inside the window;
// everything else — including Google sign-in, which blocks embedded browsers —
// opens in the user's default browser.
function guardNavigation(contents: WebContents) {
  contents.on("will-navigate", (event, url) => {
    if (isAppUrl(url) || isLocalPage(url)) return;
    event.preventDefault();
    openExternalSafely(url);
  });
  contents.on("will-redirect", (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openExternalSafely(url);
  });
  contents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: "deny" };
  });
  contents.on("will-attach-webview", (event) => event.preventDefault());
}

export function applySecurityPolicies() {
  const appSession = session.fromPartition(SESSION_PARTITION);

  // Deny every permission prompt (camera, mic, notifications, …) except
  // writing to the clipboard, which copy buttons need.
  appSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === "clipboard-sanitized-write" && isAppUrl(webContents.getURL()));
  });
  appSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return permission === "clipboard-sanitized-write" && requestingOrigin === APP_ORIGIN;
  });

  app.on("web-contents-created", (_event, contents) => guardNavigation(contents));
}

export function assertTrustedSender(event: { senderFrame: { url: string } | null }) {
  const url = event.senderFrame?.url ?? "";
  if (!isAppUrl(url) && !isLocalPage(url)) {
    throw new Error(`Blocked IPC from untrusted frame: ${url}`);
  }
}

export function focusedOrFirstWindow() {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}
