// One-time setup: creates the Ed25519 key pair that signs update manifests.
//
//   npm run keys:generate [-- --out ~/.cool-write/update-signing-key.pem]
//
// - Public key  → desktop/update-public-key.pem (commit it; embedded in every build).
// - Private key → outside the repo (default ~/.cool-write/update-signing-key.pem).
//   Keep a backup somewhere safe. Stage releases with
//   UPDATE_SIGNING_KEY_FILE=<that path> npm run stage -- --promote
// Losing the private key means existing installs can't verify future updates
// (users would have to re-download from the website once).
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({
  options: {
    out: { type: "string", default: join(homedir(), ".cool-write", "update-signing-key.pem") },
    "public-out": { type: "string", default: join(desktopRoot, "update-public-key.pem") },
    force: { type: "boolean", default: false },
  },
});
const privatePath = resolve(values.out.replace(/^~(?=\/)/, homedir()));
const publicPath = resolve(values["public-out"]);

if (!values.force && (existsSync(privatePath) || existsSync(publicPath))) {
  console.error(`Refusing to overwrite an existing key (${existsSync(privatePath) ? privatePath : publicPath}).`);
  console.error("Replacing the key breaks updates for installed apps. Pass --force only if you mean it.");
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
mkdirSync(dirname(privatePath), { recursive: true, mode: 0o700 });
writeFileSync(privatePath, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
writeFileSync(publicPath, publicKey.export({ type: "spki", format: "pem" }));
console.log(`Private key: ${privatePath}  (keep secret, back it up)`);
console.log(`Public key:  ${publicPath}  (commit this file)`);
