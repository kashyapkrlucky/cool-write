import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { z } from "zod";
import { getEnv } from "../env";

// Desktop release storage. Builds are staged into a `files/` tree:
//
//   files/<channel>/manifest.json      which version is live on the channel
//   files/<version>/<artifact>         installers and updater files
//
// The local driver serves that tree from disk; the remote driver points at a
// copy hosted elsewhere (needed on Vercel, which has no persistent disk).

export const RELEASE_TARGETS = ["mac-arm64", "mac-x64", "win-x64"] as const;
export type ReleaseTarget = (typeof RELEASE_TARGETS)[number];
export const RELEASE_CHANNELS = ["stable", "beta"] as const;
export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
// Artifact names produced by electron-builder's artifactName (no spaces/slashes).
const FILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;

const releaseFileSchema = z.object({
  name: z.string().regex(FILE_NAME_PATTERN),
  size: z.number().int().nonnegative(),
  sha256: z.string(),
  sha512: z.string(),
});

const releaseManifestSchema = z.object({
  version: z.string().regex(VERSION_PATTERN),
  releasedAt: z.string(),
  notes: z.string().optional(),
  minVersion: z.string().regex(VERSION_PATTERN).optional(),
  files: z.partialRecord(
    z.enum(RELEASE_TARGETS),
    z.object({ installer: releaseFileSchema, update: releaseFileSchema.optional() }),
  ),
});

export type ReleaseFile = z.infer<typeof releaseFileSchema>;
export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;

export function isReleaseTarget(value: string): value is ReleaseTarget {
  return (RELEASE_TARGETS as readonly string[]).includes(value);
}

// Only `<channel>/<file>` and `<version>/<file>` are addressable, so a request
// can never reach outside the releases directory.
export function isSafeReleasePath(segments: string[]): boolean {
  if (segments.length !== 2) return false;
  const [folder, file] = segments as [string, string];
  const folderOk = (RELEASE_CHANNELS as readonly string[]).includes(folder) || VERSION_PATTERN.test(folder);
  return folderOk && FILE_NAME_PATTERN.test(file) && !file.includes("..");
}

function releasesDir() {
  // turbopackIgnore: the releases dir is runtime data, not code — without this,
  // Next traces the whole project into the server bundle (see next.config.js).
  return resolve(/*turbopackIgnore: true*/ getEnv().DESKTOP_RELEASES_DIR || join(/*turbopackIgnore: true*/ process.cwd(), "files"));
}

function remoteBase() {
  return getEnv().DESKTOP_RELEASES_URL?.replace(/\/+$/, "");
}

export function releaseStorageMode(): "local" | "remote" {
  return remoteBase() ? "remote" : "local";
}

function parseManifest(raw: string, source: string): ReleaseManifest | null {
  try {
    return releaseManifestSchema.parse(JSON.parse(raw));
  } catch (error) {
    console.error(`Invalid release manifest at ${source}:`, error);
    return null;
  }
}

export async function getChannelManifest(channel: ReleaseChannel = "stable"): Promise<ReleaseManifest | null> {
  const base = remoteBase();
  if (base) {
    const url = `${base}/${channel}/manifest.json`;
    try {
      const res = await fetch(url, { next: { revalidate: 60 } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseManifest(await res.text(), url);
    } catch (error) {
      console.error(`Failed to fetch release manifest from ${url}:`, error);
      return null;
    }
  }

  const path = join(releasesDir(), channel, "manifest.json");
  try {
    return parseManifest(await readFile(path, "utf8"), path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

// Where a client should download a file from: our own file route (local) or
// the remote copy.
export function releaseFileUrl(version: string, fileName: string, requestUrl: string): string {
  const base = remoteBase();
  const path = `${encodeURIComponent(version)}/${encodeURIComponent(fileName)}`;
  if (base) return `${base}/${path}`;
  return new URL(`/api/v1/desktop/files/${path}`, requestUrl).toString();
}

const CONTENT_TYPES: Record<string, string> = {
  ".dmg": "application/x-apple-diskimage",
  ".zip": "application/zip",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".json": "application/json",
  ".yml": "text/yaml; charset=utf-8",
  ".sig": "text/plain; charset=utf-8",
};

function contentTypeFor(file: string) {
  const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

// Entry point for /api/v1/desktop/files/<folder>/<file>, the single URL the
// desktop app uses for manifests and downloads: streamed from disk (local
// driver) or redirected to the hosted copy (remote driver).
export async function releaseFileResponse(segments: string[], request: Request): Promise<Response> {
  const base = remoteBase();
  if (!base) return localReleaseFileResponse(segments, request);
  if (!isSafeReleasePath(segments)) return Response.json({ error: "Not found" }, { status: 404 });
  const [folder, file] = segments as [string, string];
  const isChannelPointer = (RELEASE_CHANNELS as readonly string[]).includes(folder);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${base}/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`,
      "Cache-Control": isChannelPointer ? "no-store" : "public, max-age=3600",
    },
  });
}

// Streams a file from the local releases directory, honouring single-range
// `Range` requests so interrupted downloads (and delta updates) can resume.
export async function localReleaseFileResponse(segments: string[], request: Request): Promise<Response> {
  const notFound = () => Response.json({ error: "Not found" }, { status: 404 });
  if (releaseStorageMode() !== "local" || !isSafeReleasePath(segments)) return notFound();

  const root = releasesDir();
  const path = resolve(/*turbopackIgnore: true*/ root, ...segments);
  if (!path.startsWith(root + sep)) return notFound();

  let size: number;
  try {
    const info = await stat(path);
    if (!info.isFile()) return notFound();
    size = info.size;
  } catch {
    return notFound();
  }

  const [folder, file] = segments as [string, string];
  const isChannelPointer = (RELEASE_CHANNELS as readonly string[]).includes(folder);
  const headers = new Headers({
    "Content-Type": contentTypeFor(file),
    "Accept-Ranges": "bytes",
    // Versioned artifacts never change; channel pointers must stay fresh.
    "Cache-Control": isChannelPointer ? "no-cache" : "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  if (!file.endsWith(".json") && !file.endsWith(".yml") && !file.endsWith(".sig")) {
    headers.set("Content-Disposition", `attachment; filename="${file}"`);
  }

  let start = 0;
  let end = size - 1;
  let status = 200;
  const range = request.headers.get("range");
  if (range && size > 0) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match || (match[1] === "" && match[2] === "")) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    if (match[1] === "") {
      start = Math.max(0, size - Number(match[2])); // suffix range: last N bytes
    } else {
      start = Number(match[1]);
      if (match[2] !== "") end = Math.min(Number(match[2]), size - 1);
    }
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    status = 206;
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  headers.set("Content-Length", String(size === 0 ? 0 : end - start + 1));

  if (request.method === "HEAD" || size === 0) return new Response(null, { status, headers });

  const stream = createReadStream(path, { start, end });
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status, headers });
}
