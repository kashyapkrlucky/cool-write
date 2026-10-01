// Stages electron-builder output into the releases tree the server reads from.
//
//   npm run stage                      copy + hash this version into files/<version>/
//   npm run stage -- --promote         …and make it the live version on "stable"
//   npm run stage -- --promote --channel beta --notes "Fixes sign-in on Windows"
//
// Builds made on different machines (mac on a Mac, win on Windows) merge into
// the same files/<version>/manifest.json, so run it after each platform's build.
//
// Env:
//   DESKTOP_RELEASES_DIR       releases tree (default: <repo>/files)
//   UPDATE_SIGNING_KEY_FILE    Ed25519 private key (PEM). When set, writes
//                              manifest.json.sig, which the app's updater verifies.
import { createHash, createPrivateKey, sign } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const { values: args } = parseArgs({
  options: {
    promote: { type: "boolean", default: false },
    channel: { type: "string", default: "stable" },
    notes: { type: "string" },
    force: { type: "boolean", default: false },
  },
});
if (!["stable", "beta"].includes(args.channel)) throw new Error(`Unknown channel: ${args.channel}`);

const { version } = JSON.parse(readFileSync(join(desktopRoot, "package.json"), "utf8"));
const buildDir = join(desktopRoot, "release");
const releasesRoot = resolve(process.env.DESKTOP_RELEASES_DIR || join(desktopRoot, "..", "files"));
const versionDir = join(releasesRoot, version);

if (!existsSync(buildDir)) throw new Error(`No build output in ${buildDir}. Run npm run dist:mac / dist:win first.`);

// artifactName in electron-builder.yml: CoolWrite-${version}-${os}-${arch}.${ext}
const TARGETS = {
  "mac-arm64": { installer: `CoolWrite-${version}-mac-arm64.dmg`, update: `CoolWrite-${version}-mac-arm64.zip` },
  "mac-x64": { installer: `CoolWrite-${version}-mac-x64.dmg`, update: `CoolWrite-${version}-mac-x64.zip` },
  "win-x64": { installer: `CoolWrite-${version}-win-x64.exe`, update: `CoolWrite-${version}-win-x64.exe` },
};
// Extra files electron-updater (Windows) needs next to the installer.
const isExtra = (name) => name.startsWith(`CoolWrite-${version}-`) && name.endsWith(".blockmap") || name === "latest.yml";

function describe(name) {
  const path = join(buildDir, name);
  const data = readFileSync(path);
  return {
    name,
    size: statSync(path).size,
    sha256: createHash("sha256").update(data).digest("hex"),
    sha512: createHash("sha512").update(data).digest("base64"),
  };
}

const manifestPath = join(versionDir, "manifest.json");
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : { version, releasedAt: new Date().toISOString(), files: {} };
if (args.notes) manifest.notes = args.notes;

const staged = [];
for (const [target, names] of Object.entries(TARGETS)) {
  if (!existsSync(join(buildDir, names.installer))) continue;
  mkdirSync(versionDir, { recursive: true });
  const entry = { installer: describe(names.installer) };
  if (existsSync(join(buildDir, names.update))) entry.update = describe(names.update);
  for (const file of new Set([names.installer, names.update])) {
    if (!existsSync(join(buildDir, file))) continue;
    // Published versions are immutable: browsers and CDNs cache them forever
    // (Cache-Control: immutable). Replacing one would serve stale copies, so a
    // changed build must get a new version number instead.
    const target = join(versionDir, file);
    if (existsSync(target) && !args.force) {
      const same = createHash("sha256").update(readFileSync(target)).digest("hex") === describe(file).sha256;
      if (!same) {
        throw new Error(`${version}/${file} is already staged with different content. Bump the version in package.json (or pass --force for an unpublished version).`);
      }
    }
    copyFileSync(join(buildDir, file), target);
  }
  manifest.files[target] = entry;
  staged.push(target);
}
if (staged.length === 0) throw new Error(`No CoolWrite-${version}-* installers found in ${buildDir}`);
for (const name of readdirSync(buildDir).filter(isExtra)) {
  copyFileSync(join(buildDir, name), join(versionDir, name));
}

function writeSigned(dir) {
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.json"), json);
  const keyFile = process.env.UPDATE_SIGNING_KEY_FILE;
  if (keyFile) {
    const signature = sign(null, Buffer.from(json), createPrivateKey(readFileSync(keyFile)));
    writeFileSync(join(dir, "manifest.json.sig"), signature.toString("base64"));
  }
}

writeSigned(versionDir);
console.log(`Staged ${version} (${staged.join(", ")}) → ${versionDir}`);
if (!process.env.UPDATE_SIGNING_KEY_FILE) {
  console.warn("UPDATE_SIGNING_KEY_FILE not set: manifest is unsigned (fine for local testing, not for real releases).");
}

if (args.promote) {
  writeSigned(join(releasesRoot, args.channel));
  console.log(`Promoted ${version} to "${args.channel}".`);
}
