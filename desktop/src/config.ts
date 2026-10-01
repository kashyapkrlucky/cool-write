import { app } from "electron";

declare const __APP_ORIGIN__: string;

// The web app this shell loads. Baked in at build time (scripts/build.mjs);
// unpackaged dev runs may override it with COOL_WRITE_ORIGIN.
export const APP_ORIGIN = (!app.isPackaged && process.env.COOL_WRITE_ORIGIN
  ? new URL(process.env.COOL_WRITE_ORIGIN).origin
  : __APP_ORIGIN__);

export const APP_ENTRY_URL = `${APP_ORIGIN}/web`;

// Keeps cookies/storage for the app separate from anything else Electron loads.
export const SESSION_PARTITION = "persist:coolwrite";

export function isAppUrl(url: string): boolean {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}
