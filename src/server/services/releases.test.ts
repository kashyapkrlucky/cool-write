import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ DESKTOP_RELEASES_DIR: "", DESKTOP_RELEASES_URL: undefined as string | undefined }));
vi.mock("../env", () => ({ getEnv: () => env }));

const { getChannelManifest, isSafeReleasePath, localReleaseFileResponse, releaseFileResponse, releaseFileUrl } =
  await import("./releases");

const root = mkdtempSync(join(tmpdir(), "cool-write-releases-"));
const file = "CoolWrite-1.2.0-mac-arm64.dmg";
const bytes = Buffer.from("0123456789abcdefghij");
const manifest = {
  version: "1.2.0",
  releasedAt: "2026-10-01T00:00:00.000Z",
  files: { "mac-arm64": { installer: { name: file, size: bytes.length, sha256: "x", sha512: "y" } } },
};
mkdirSync(join(root, "1.2.0"), { recursive: true });
mkdirSync(join(root, "stable"), { recursive: true });
writeFileSync(join(root, "1.2.0", file), bytes);
writeFileSync(join(root, "stable", "manifest.json"), JSON.stringify(manifest));
writeFileSync(join(root, "secret.txt"), "do not serve");
afterAll(() => rmSync(root, { recursive: true, force: true }));

beforeEach(() => {
  env.DESKTOP_RELEASES_DIR = root;
  env.DESKTOP_RELEASES_URL = undefined;
});

const get = (segments: string[], headers: Record<string, string> = {}, method = "GET") =>
  localReleaseFileResponse(segments, new Request("http://app.test/x", { method, headers }));

describe("isSafeReleasePath", () => {
  it.each([
    [["1.2.0", file], true],
    [["stable", "manifest.json"], true],
    [["1.2.0-beta.1", "latest.yml"], true],
    [["..", "secret.txt"], false],
    [["1.2.0", ".."], false],
    [["1.2.0", "a..b"], false],
    [["1.2.0", ".hidden"], false],
    [["nightly", "manifest.json"], false],
    [["secret.txt"], false],
    [["1.2.0", "x", "y"], false],
  ])("%j → %s", (segments, expected) => {
    expect(isSafeReleasePath(segments)).toBe(expected);
  });
});

describe("getChannelManifest (local)", () => {
  it("reads and validates the channel manifest", async () => {
    await expect(getChannelManifest("stable")).resolves.toMatchObject({ version: "1.2.0" });
  });

  it("returns null when the channel has no release", async () => {
    await expect(getChannelManifest("beta")).resolves.toBeNull();
  });
});

describe("localReleaseFileResponse", () => {
  it("serves the whole file as an attachment", async () => {
    const res = await get(["1.2.0", file]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain(file);
    expect(res.headers.get("content-length")).toBe(String(bytes.length));
    expect(Buffer.from(await res.arrayBuffer())).toEqual(bytes);
  });

  it("serves byte ranges for resumable downloads", async () => {
    const res = await get(["1.2.0", file], { range: "bytes=5-9" });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes 5-9/${bytes.length}`);
    expect(await res.text()).toBe("56789");
  });

  it("serves suffix ranges and rejects unsatisfiable ones", async () => {
    expect(await (await get(["1.2.0", file], { range: "bytes=-3" })).text()).toBe("hij");
    expect((await get(["1.2.0", file], { range: "bytes=500-" })).status).toBe(416);
  });

  it("answers HEAD without a body", async () => {
    const res = await get(["1.2.0", file], {}, "HEAD");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  it("keeps channel pointers uncached and artifacts immutable", async () => {
    expect((await get(["stable", "manifest.json"])).headers.get("cache-control")).toBe("no-cache");
    expect((await get(["1.2.0", file])).headers.get("cache-control")).toContain("immutable");
  });

  it("never serves files outside the release folders", async () => {
    expect((await get(["..", "secret.txt"])).status).toBe(404);
    expect((await get(["secret.txt"])).status).toBe(404);
    expect((await get(["1.2.0", "missing.dmg"])).status).toBe(404);
  });

  it("is disabled when a remote releases URL is configured", async () => {
    env.DESKTOP_RELEASES_URL = "https://downloads.example.com/releases";
    expect((await get(["1.2.0", file])).status).toBe(404);
  });
});

describe("releaseFileResponse", () => {
  const request = new Request("http://app.test/x");

  it("streams from disk with the local driver", async () => {
    expect((await releaseFileResponse(["1.2.0", file], request)).status).toBe(200);
  });

  it("redirects to the hosted copy with the remote driver", async () => {
    env.DESKTOP_RELEASES_URL = "https://downloads.example.com/releases";
    const res = await releaseFileResponse(["stable", "manifest.json.sig"], request);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://downloads.example.com/releases/stable/manifest.json.sig");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await releaseFileResponse(["..", "secret.txt"], request)).status).toBe(404);
  });
});

describe("releaseFileUrl", () => {
  it("points at the local file route by default", () => {
    expect(releaseFileUrl("1.2.0", file, "https://app.test/api/v1/desktop/download/mac-arm64")).toBe(
      `https://app.test/api/v1/desktop/files/1.2.0/${file}`,
    );
  });

  it("points at the remote copy when configured", () => {
    env.DESKTOP_RELEASES_URL = "https://downloads.example.com/releases/";
    expect(releaseFileUrl("1.2.0", file, "https://app.test/x")).toBe(`https://downloads.example.com/releases/1.2.0/${file}`);
  });
});
