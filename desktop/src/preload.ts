import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

type AuthStatus = { state: "signed-out" | "waiting" | "signing-in" | "signed-in"; message?: string };
type UpdateStatus = { state: string; version?: string; percent?: number; notes?: string; mode?: "install" | "manual"; reason?: string; message?: string };

function subscribe<T>(channel: string, callback: (value: T) => void) {
  const handler = (_event: IpcRendererEvent, value: T) => callback(value);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

// The only surface the web app gets from the desktop shell. Keep it small:
// every function here is callable by any script running on the app origin.
// The main process re-checks the sender of every call (security.ts).
const bridge = {
  isDesktop: true as const,
  platform: process.platform,
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("app:version"),
  retry: (): Promise<void> => ipcRenderer.invoke("app:retry"),
  // Sign-in screen (static/signin.html)
  startSignIn: (): Promise<void> => ipcRenderer.invoke("auth:start"),
  submitSignInCode: (code: string): Promise<void> => ipcRenderer.invoke("auth:submitCode", String(code)),
  onAuthStatus: (callback: (status: AuthStatus) => void) => subscribe("auth:status", callback),
  // Web app: sign out of this desktop install (revokes its session server-side).
  signOut: (): Promise<void> => ipcRenderer.invoke("auth:signOut"),
  // Updates: the web app shows an "Update" button when status is "ready".
  getUpdateStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke("update:getStatus"),
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => subscribe("update:status", callback),
  checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke("update:check"),
  installUpdate: (): Promise<void> => ipcRenderer.invoke("update:install"),
  // The web app registers how to flush unsaved edits; main calls it before
  // quitting to install an update.
  // Native menu commands (File → New Document, View → Focus Mode, …).
  onMenuCommand: (callback: (command: string) => void) => subscribe("menu:command", callback),
  onFlushSaves: (flush: () => Promise<void>) => {
    return subscribe<number>("app:flush-saves", (id) => {
      void flush()
        .catch(() => {})
        .finally(() => ipcRenderer.send("app:flush-saves-done", id));
    });
  },
};

export type CoolWriteDesktopBridge = typeof bridge;

contextBridge.exposeInMainWorld("coolWrite", bridge);

// Lets the web app's CSS adapt to the desktop window (e.g. leave room for the
// macOS traffic-light buttons in the hidden-inset title bar).
window.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("is-desktop", `platform-${process.platform}`);
});
