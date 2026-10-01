import { app, screen, type BrowserWindow, type Rectangle } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Remembers window size/position/maximized/full-screen between launches.

interface WindowState {
  bounds?: Rectangle;
  isMaximized?: boolean;
  isFullScreen?: boolean;
}

export const DEFAULT_SIZE = { width: 1280, height: 820 };
const stateFile = () => join(app.getPath("userData"), "window-state.json");

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

// A saved position is only reused if enough of the window would land on a
// connected display — otherwise (monitor unplugged, resolution changed) the
// window would open off-screen.
function isVisibleOnSomeDisplay(bounds: Rectangle) {
  return screen.getAllDisplays().some(({ workArea }) => {
    const overlapX = Math.min(bounds.x + bounds.width, workArea.x + workArea.width) - Math.max(bounds.x, workArea.x);
    const overlapY = Math.min(bounds.y + bounds.height, workArea.y + workArea.height) - Math.max(bounds.y, workArea.y);
    return overlapX >= 200 && overlapY >= 100;
  });
}

export function loadWindowState(): WindowState {
  try {
    const saved = JSON.parse(readFileSync(stateFile(), "utf8")) as WindowState;
    const b = saved.bounds;
    const validBounds =
      b && [b.x, b.y, b.width, b.height].every(isFiniteNumber) && b.width >= 400 && b.height >= 300 && isVisibleOnSomeDisplay(b);
    return {
      bounds: validBounds ? b : undefined,
      isMaximized: saved.isMaximized === true,
      isFullScreen: saved.isFullScreen === true,
    };
  } catch {
    return {};
  }
}

export function trackWindowState(window: BrowserWindow) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    if (window.isDestroyed()) return;
    const state: WindowState = {
      // Normal bounds: the size to restore to when un-maximizing.
      bounds: window.getNormalBounds(),
      isMaximized: window.isMaximized(),
      isFullScreen: window.isFullScreen(),
    };
    try {
      writeFileSync(stateFile(), JSON.stringify(state));
    } catch (error) {
      console.warn("Couldn't save window state:", error);
    }
  };
  const saveSoon = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 500);
  };
  for (const event of ["resize", "move", "maximize", "unmaximize", "enter-full-screen", "leave-full-screen"] as const) {
    window.on(event as "resize", saveSoon);
  }
  window.on("close", () => {
    if (timer) clearTimeout(timer);
    save();
  });
}
