// Bundles the main and preload processes with esbuild and copies static pages.
//
//   COOL_WRITE_ORIGIN=https://your-domain.example npm run build
//
// The origin is baked into the app at build time; it defaults to the local dev
// server so `npm start` works against `npm run dev` in the repo root.
import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const origin = (process.env.COOL_WRITE_ORIGIN || "http://localhost:3000").replace(/\/+$/, "");

let parsed;
try {
  parsed = new URL(origin);
} catch {
  throw new Error(`COOL_WRITE_ORIGIN is not a valid URL: ${origin}`);
}
const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
if (parsed.protocol !== "https:" && !isLocal) {
  throw new Error(`COOL_WRITE_ORIGIN must use https (got ${origin})`);
}

// Public key that verifies update manifests (see scripts/generate-update-key.mjs).
// Without it the build still works, but auto-update is disabled.
const publicKeyFile = process.env.UPDATE_PUBLIC_KEY_FILE || join(root, "update-public-key.pem");
const updatePublicKey = existsSync(publicKeyFile) ? readFileSync(publicKeyFile, "utf8").trim() : "";
if (!updatePublicKey) console.warn(`No update public key at ${publicKeyFile}: auto-update will be disabled in this build.`);

const outdir = join(root, "dist");
rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

const common = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  // electron-updater ships as a runtime dependency in node_modules (packed by electron-builder).
  external: ["electron", "electron-updater"],
  sourcemap: "linked",
  logLevel: "info",
  define: {
    __APP_ORIGIN__: JSON.stringify(parsed.origin),
    __UPDATE_PUBLIC_KEY__: JSON.stringify(updatePublicKey),
  },
};

await build({ ...common, entryPoints: [join(root, "src/main.ts")], outfile: join(outdir, "main.js") });
// Sandboxed preloads can only `require` a few Electron modules, so bundle everything else in.
await build({ ...common, entryPoints: [join(root, "src/preload.ts")], outfile: join(outdir, "preload.js") });

cpSync(join(root, "static"), join(outdir, "static"), { recursive: true });

console.log(`Built for origin ${parsed.origin}`);
