import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, shell, type MenuItemConstructorOptions } from "electron";
import { join, resolve } from "node:path";
import { APP_ENTRY_URL, APP_ORIGIN, isAppUrl, SESSION_PARTITION } from "./config";
import {
  assertTrustedSender,
  applySecurityPolicies,
  focusedOrFirstWindow,
  isLocalPage,
  localPageUrl,
  openExternalSafely,
} from "./security";
import {
  handleCallbackUrl,
  onAuthStatus,
  onSignedIn,
  restoreSession,
  signOut,
  startSignIn,
  submitCode,
} from "./auth";
import { checkForUpdates, getUpdateStatus, installUpdate, onUpdateStatus, startAutoUpdates } from "./updater";
import { DEFAULT_SIZE, loadWindowState, trackWindowState } from "./windowState";
import { buildContextMenuTemplate } from "./contextMenu";
import { recoverFromRendererCrashes, setupLogging } from "./logging";
import { showWhatsNewIfUpdated } from "./whatsNew";

const isMac = process.platform === "darwin";
const PROTOCOL = "coolwrite";
let mainWindow: BrowserWindow | null = null;
let ready = false;
const queuedUrls: string[] = [];

// Register coolwrite:// so the browser can hand the sign-in back. Unpackaged
// dev runs pass the script path so the OS relaunches this dev build (on macOS
// the scheme only routes to packaged builds; use the paste-code fallback in dev).
if (process.defaultApp && process.argv[1]) {
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

function handleUrl(url: string) {
  if (!url.startsWith(`${PROTOCOL}://`)) return;
  if (!ready) {
    queuedUrls.push(url);
    return;
  }
  focusWindow();
  handleCallbackUrl(url);
}

const urlFromArgv = (argv: string[]) => argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));

// macOS delivers the link via open-url (possibly before ready); Windows/Linux
// start a second instance with the link in argv.
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleUrl(url);
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    focusWindow();
    const url = urlFromArgv(argv);
    if (url) handleUrl(url);
  });
  const initialUrl = urlFromArgv(process.argv);
  if (initialUrl) queuedUrls.push(initialUrl);
  app.whenReady().then(onReady);
}

function focusWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function showSignIn(message?: string) {
  void mainWindow?.loadURL(localPageUrl("signin.html", message ? { message } : {}));
}

function showApp() {
  void mainWindow?.loadURL(APP_ENTRY_URL);
}

const isLoginPage = (url: string) => isAppUrl(url) && new URL(url).pathname === "/login";

// The web app bounces to /login when its session is missing or revoked. In the
// desktop app, sign-in goes through the system browser instead, so try to
// refresh the session first and fall back to the local sign-in screen.
let recovering = false;
async function handleLoginRequired() {
  if (recovering) return;
  recovering = true;
  try {
    const result = await restoreSession();
    if (result === "signed-out") showSignIn();
    else if (result === "offline") void mainWindow?.loadURL(localPageUrl("offline.html", { origin: APP_ORIGIN }));
    else showApp();
  } finally {
    // Don't retry in a tight loop if the fresh cookie is rejected immediately.
    setTimeout(() => {
      recovering = false;
    }, 5_000);
  }
}

function createWindow() {
  const saved = loadWindowState();
  const window = new BrowserWindow({
    ...DEFAULT_SIZE,
    ...saved.bounds,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "Cool Write",
    // Matches the web app's --bg so there's no white flash before first paint.
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#08080c" : "#f6f6f9",
    ...(isMac ? { titleBarStyle: "hiddenInset" as const, trafficLightPosition: { x: 14, y: 16 } } : {}),
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      partition: SESSION_PARTITION,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
    },
  });

  if (saved.isMaximized) window.maximize();
  if (saved.isFullScreen) window.setFullScreen(true);
  trackWindowState(window);
  window.once("ready-to-show", () => window.show());

  // Right-click menu (spelling suggestions, cut/copy/paste, links).
  window.webContents.on("context-menu", (_event, params) => {
    const template = buildContextMenuTemplate(params, {
      replaceMisspelling: (word) => window.webContents.replaceMisspelling(word),
      addToDictionary: (word) => window.webContents.session.addWordToSpellCheckerDictionary(word),
      openLink: (url) => openExternalSafely(url),
      copyText: (text) => clipboard.writeText(text),
    });
    if (template.length > 0) Menu.buildFromTemplate(template).popup({ window });
  });

  recoverFromRendererCrashes(window, () => {
    if (!window.isDestroyed()) void window.loadURL(APP_ENTRY_URL);
  });

  const interceptLogin = (event: Electron.Event, url: string) => {
    if (!isLoginPage(url)) return;
    event.preventDefault();
    void handleLoginRequired();
  };
  window.webContents.on("will-navigate", interceptLogin);
  window.webContents.on("will-redirect", interceptLogin);

  // Network errors on the main document (offline, DNS, server down) show a
  // local page with a retry button instead of a blank window.
  window.webContents.on("did-fail-load", (_event, errorCode, _description, validatedURL, isMainFrame) => {
    // -3 = aborted (e.g. a navigation replaced by another); not an error.
    if (!isMainFrame || errorCode === -3 || validatedURL.startsWith("file://")) return;
    void window.loadURL(localPageUrl("offline.html", { origin: APP_ORIGIN }));
  });

  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });

  return window;
}

// Asks the web app to finish pending document saves before the app quits for
// an update. Gives up after a few seconds so a stuck page can't block updates.
let flushCounter = 0;
function flushSaves(): Promise<void> {
  const contents = mainWindow?.webContents;
  if (!contents || !isAppUrl(contents.getURL())) return Promise.resolve();
  const id = ++flushCounter;
  return new Promise((resolveFlush) => {
    const done = (_event: Electron.IpcMainEvent, doneId: number) => {
      if (doneId !== id) return;
      finish();
    };
    const timer = setTimeout(() => finish(), 3_000);
    function finish() {
      clearTimeout(timer);
      ipcMain.removeListener("app:flush-saves-done", done);
      resolveFlush();
    }
    ipcMain.on("app:flush-saves-done", done);
    contents.send("app:flush-saves", id);
  });
}

async function checkForUpdatesFromMenu() {
  const result = await checkForUpdates();
  const options: Electron.MessageBoxOptions =
    result.state === "up-to-date"
      ? { type: "info", message: "You're up to date", detail: `Cool Write ${result.version} is the latest version.` }
      : result.state === "ready" || result.state === "downloading"
        ? { type: "info", message: `Cool Write ${result.version} is available`, detail: result.state === "ready" ? "Click Update in the top bar to install it." : "It's downloading in the background." }
        : result.state === "disabled"
          ? { type: "info", message: "Updates are turned off", detail: `This build can't update itself (${result.reason}).` }
          : { type: "warning", message: "Couldn't check for updates", detail: result.state === "error" ? result.message : "Please try again later." };
  if (mainWindow) void dialog.showMessageBox(mainWindow, options);
}

// App commands the web app executes (it registers via the preload bridge).
// Shortcuts the web app already handles itself (⌘K, ⌘J) are shown without
// registering an accelerator, so a key press doesn't toggle twice.
type MenuCommand = "new-document" | "command-palette" | "toggle-ai" | "toggle-focus" | "toggle-theme";

function sendMenuCommand(command: MenuCommand) {
  const contents = mainWindow?.webContents;
  if (contents && isAppUrl(contents.getURL())) contents.send("menu:command", command);
}

const shownShortcut = (accelerator: string) => ({ accelerator, registerAccelerator: false });

function buildMenu() {
  const checkForUpdatesItem: MenuItemConstructorOptions = {
    label: "Check for Updates…",
    click: () => void checkForUpdatesFromMenu(),
  };
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              checkForUpdatesItem,
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        { label: "New Document", accelerator: "CmdOrCtrl+N", click: () => sendMenuCommand("new-document") },
        { label: "Command Palette…", ...shownShortcut("CmdOrCtrl+K"), click: () => sendMenuCommand("command-palette") },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { label: "Ask AI Panel", ...shownShortcut("CmdOrCtrl+J"), click: () => sendMenuCommand("toggle-ai") },
        { label: "Focus Mode", accelerator: "CmdOrCtrl+Shift+F", click: () => sendMenuCommand("toggle-focus") },
        { label: "Toggle Light/Dark Theme", accelerator: "CmdOrCtrl+Shift+L", click: () => sendMenuCommand("toggle-theme") },
        { type: "separator" },
        { role: "reload" },
        ...(app.isPackaged ? [] : [{ role: "toggleDevTools" as const }]),
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: "Open Cool Write in Browser", click: () => openExternalSafely(APP_ENTRY_URL) },
        ...(isMac ? [] : [checkForUpdatesItem]),
        { label: "Download Page", click: () => openExternalSafely(`${APP_ORIGIN}/download`) },
        { label: "Open Logs Folder", click: () => void shell.openPath(app.getPath("logs")) },
        { type: "separator" },
        { label: "Sign Out", click: () => void signOut() },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Sign-in actions are only accepted from the bundled sign-in screen, not from
// the web app, so a script on the site can't drive the flow.
function assertLocalSender(event: Electron.IpcMainInvokeEvent) {
  if (!isLocalPage(event.senderFrame?.url ?? "")) throw new Error("Blocked sign-in IPC from a non-local page");
}

function registerIpc() {
  ipcMain.handle("app:version", (event) => {
    assertTrustedSender(event);
    return app.getVersion();
  });
  ipcMain.handle("app:retry", (event) => {
    assertTrustedSender(event);
    void handleLoginRequired().then(() => undefined);
  });
  ipcMain.handle("auth:start", (event) => {
    assertLocalSender(event);
    return startSignIn();
  });
  ipcMain.handle("auth:submitCode", (event, code: unknown) => {
    assertLocalSender(event);
    submitCode(typeof code === "string" ? code : "");
  });
  ipcMain.handle("update:getStatus", (event) => {
    assertTrustedSender(event);
    return getUpdateStatus();
  });
  ipcMain.handle("update:check", (event) => {
    assertTrustedSender(event);
    return checkForUpdates();
  });
  ipcMain.handle("update:install", (event) => {
    assertTrustedSender(event);
    return installUpdate(flushSaves);
  });
  ipcMain.handle("auth:signOut", (event) => {
    assertTrustedSender(event);
    return signOut();
  });
}

async function onReady() {
  setupLogging();
  applySecurityPolicies();
  registerIpc();
  buildMenu();

  onAuthStatus((status) => {
    mainWindow?.webContents.send("auth:status", status);
    if (status.state === "signed-out" && mainWindow && !isLocalPage(mainWindow.webContents.getURL())) {
      showSignIn(status.message);
    }
  });
  onSignedIn(() => {
    focusWindow();
    showApp();
  });

  onUpdateStatus((update) => mainWindow?.webContents.send("update:status", update));

  mainWindow = createWindow();
  const restored = await restoreSession();
  if (restored === "signed-out") showSignIn();
  else showApp(); // "offline" still tries: the cookie may be valid, and the offline page covers the rest.

  ready = true;
  queuedUrls.splice(0).forEach(handleUrl);
  startAutoUpdates();
  const window = mainWindow;
  window.webContents.once("did-finish-load", () => void showWhatsNewIfUpdated(window));

  app.on("activate", () => {
    // macOS: clicking the dock icon with no windows open reopens one.
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
      showApp();
    }
  });
}

app.on("window-all-closed", () => {
  if (!isMac) app.quit();
});
