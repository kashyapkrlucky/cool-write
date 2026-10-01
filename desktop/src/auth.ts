import { app, net, safeStorage, session, shell } from "electron";
import { createHash, randomBytes } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { APP_ORIGIN, SESSION_PARTITION } from "./config";

// Desktop sign-in, app side:
//   startSignIn()  → opens /desktop/authorize in the system browser with a PKCE challenge
//   handleCallbackUrl(coolwrite://auth/callback?code&state) or submitCode(code)
//                  → exchanges the code for a refresh token + session cookie
//   restoreSession() on launch → rotates the refresh token, sets a fresh cookie
// The refresh token is encrypted with the OS keychain (safeStorage); the page
// never sees it — only the httpOnly session cookie reaches the web app.

export type AuthStatus =
  | { state: "signed-out"; message?: string }
  | { state: "waiting" }
  | { state: "signing-in" }
  | { state: "signed-in" };

type Grant = {
  refreshToken: string;
  sessionCookie: { name: string; value: string; expiresAt: number; secure: boolean };
};

const PENDING_TTL_MS = 10 * 60_000;
const tokenFile = () => join(app.getPath("userData"), "session.bin");

let pending: { state: string; verifier: string; startedAt: number } | null = null;
let listener: (status: AuthStatus) => void = () => {};
let signedInHandler: () => void = () => {};

export function onAuthStatus(fn: (status: AuthStatus) => void) {
  listener = fn;
}

export function onSignedIn(fn: () => void) {
  signedInHandler = fn;
}

const base64url = (bytes: Buffer) => bytes.toString("base64url");

// ---- refresh token storage (OS keychain via safeStorage) -------------------

async function readRefreshToken(): Promise<string | null> {
  try {
    const data = await readFile(tokenFile());
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(data) : null;
  } catch {
    return null;
  }
}

async function writeRefreshToken(token: string) {
  // Without OS encryption (e.g. Linux without a keyring) the token isn't
  // persisted; the user simply signs in again next launch.
  if (!safeStorage.isEncryptionAvailable()) return;
  await writeFile(tokenFile(), safeStorage.encryptString(token), { mode: 0o600 });
}

async function clearRefreshToken() {
  await rm(tokenFile(), { force: true });
}

// ---- server calls ----------------------------------------------------------

class AuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await net.fetch(`${APP_ORIGIN}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new AuthError(data?.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

async function applyGrant(grant: Grant) {
  await writeRefreshToken(grant.refreshToken);
  const { name, value, expiresAt, secure } = grant.sessionCookie;
  await session.fromPartition(SESSION_PARTITION).cookies.set({
    url: APP_ORIGIN,
    name,
    value,
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "lax",
    expirationDate: expiresAt,
  });
}

// ---- sign in ---------------------------------------------------------------

export async function startSignIn() {
  const verifier = base64url(randomBytes(32));
  pending = { state: base64url(randomBytes(24)), verifier, startedAt: Date.now() };
  const url = new URL("/desktop/authorize", APP_ORIGIN);
  url.searchParams.set("state", pending.state);
  url.searchParams.set("code_challenge", base64url(createHash("sha256").update(verifier).digest()));
  url.searchParams.set("code_challenge_method", "S256");
  await shell.openExternal(url.toString());
  listener({ state: "waiting" });
}

async function exchange(code: string) {
  if (!pending || Date.now() - pending.startedAt > PENDING_TTL_MS) {
    pending = null;
    listener({ state: "signed-out", message: "That sign-in request expired. Click Sign in to try again." });
    return;
  }
  const { verifier } = pending;
  pending = null;
  listener({ state: "signing-in" });
  try {
    const grant = await post<Grant>("/api/v1/desktop/token", {
      code,
      codeVerifier: verifier,
      deviceName: hostname().slice(0, 100),
      platform: process.platform,
      appVersion: app.getVersion(),
    });
    await applyGrant(grant);
    listener({ state: "signed-in" });
    signedInHandler();
  } catch (error) {
    listener({ state: "signed-out", message: error instanceof Error ? error.message : "Sign-in failed." });
  }
}

// coolwrite://auth/callback?code=…&state=… — untrusted input: anything else is ignored.
export function handleCallbackUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return;
  }
  if (url.protocol !== "coolwrite:" || url.hostname !== "auth" || url.pathname !== "/callback") return;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  // The state ties the callback to a sign-in this app started, so a link from
  // somewhere else can't sign the app into another account.
  if (!code || !state || !pending || state !== pending.state) {
    listener({ state: "signed-out", message: "That sign-in link wasn't started from this app. Click Sign in to try again." });
    return;
  }
  void exchange(code);
}

// Fallback when the browser can't open the app: the user pastes the code shown
// on the authorize page. Only valid while a sign-in started here is pending.
export function submitCode(code: string) {
  const trimmed = code.trim();
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(trimmed)) {
    listener({ state: "signed-out", message: "That code doesn't look right. Copy it again from the browser." });
    return;
  }
  if (!pending) {
    listener({ state: "signed-out", message: "Click Sign in first, then paste the code from the browser." });
    return;
  }
  void exchange(trimmed);
}

// ---- session lifecycle -----------------------------------------------------

export type RestoreResult = "restored" | "signed-out" | "offline";

// On launch (and when the web app bounces to /login): rotate the refresh
// token and install a fresh session cookie.
export async function restoreSession(): Promise<RestoreResult> {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) return "signed-out";
  try {
    const grant = await post<Grant>("/api/v1/desktop/session", { refreshToken, appVersion: app.getVersion() });
    await applyGrant(grant);
    return "restored";
  } catch (error) {
    if (error instanceof AuthError && (error.status === 401 || error.status === 400)) {
      await clearRefreshToken();
      await clearCookies();
      return "signed-out";
    }
    // Network trouble: keep the token and let the window try with its cookie.
    return "offline";
  }
}

async function clearCookies() {
  await session.fromPartition(SESSION_PARTITION).clearStorageData({ storages: ["cookies"] });
}

export async function signOut() {
  const refreshToken = await readRefreshToken();
  if (refreshToken) {
    await post("/api/v1/desktop/logout", { refreshToken }).catch(() => {
      // Offline: the local sign-out below still happens; the server session
      // lapses when its refresh token is never used again.
    });
  }
  await clearRefreshToken();
  await clearCookies();
  listener({ state: "signed-out" });
}
