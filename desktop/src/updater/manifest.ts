import { net } from "electron";
import { createPublicKey, verify } from "node:crypto";
import { APP_ORIGIN } from "../config";

declare const __UPDATE_PUBLIC_KEY__: string;

// Written by desktop/scripts/stage-release.mjs and signed with the release
// team's Ed25519 key. The signature is what makes updates tamper-proof while
// the app itself isn't code-signed.
export interface ReleaseFile {
  name: string;
  size: number;
  sha256: string;
  sha512: string; // base64
}

export interface ReleaseManifest {
  version: string;
  releasedAt: string;
  notes?: string;
  files: Partial<Record<UpdateTarget, { installer: ReleaseFile; update?: ReleaseFile }>>;
}

export type UpdateTarget = "mac-arm64" | "mac-x64" | "win-x64";

export const UPDATES_ENABLED = Boolean(__UPDATE_PUBLIC_KEY__);

export function currentTarget(): UpdateTarget | null {
  const os = process.platform === "darwin" ? "mac" : process.platform === "win32" ? "win" : null;
  const target = os && `${os}-${process.arch}`;
  return target === "mac-arm64" || target === "mac-x64" || target === "win-x64" ? target : null;
}

export function releaseFileUrl(path: string) {
  return `${APP_ORIGIN}/api/v1/desktop/files/${path}`;
}

async function fetchText(url: string) {
  const res = await net.fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

// Fetches a manifest — a channel pointer ("stable") or a specific version
// ("0.2.0") — and rejects it unless the signature over the exact bytes
// verifies against the key compiled into this build.
export async function fetchVerifiedManifest(folder = "stable"): Promise<ReleaseManifest> {
  if (!UPDATES_ENABLED) throw new Error("Updates are disabled in this build (no public key).");
  const [text, signature] = await Promise.all([
    fetchText(releaseFileUrl(`${folder}/manifest.json`)),
    fetchText(releaseFileUrl(`${folder}/manifest.json.sig`)),
  ]);
  const ok = verify(null, Buffer.from(text), createPublicKey(__UPDATE_PUBLIC_KEY__), Buffer.from(signature.trim(), "base64"));
  if (!ok) throw new Error("Update manifest signature is invalid.");
  const manifest = JSON.parse(text) as ReleaseManifest;
  if (typeof manifest.version !== "string" || typeof manifest.files !== "object") {
    throw new Error("Update manifest is malformed.");
  }
  return manifest;
}

// Semver-ish comparison: numeric major.minor.patch, and a release beats a
// prerelease of the same version (1.2.0 > 1.2.0-beta.1).
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [core = "", pre] = v.split("-", 2);
    return { parts: core.split(".").map((n) => Number.parseInt(n, 10) || 0), pre };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (x.parts[i] ?? 0) - (y.parts[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}
