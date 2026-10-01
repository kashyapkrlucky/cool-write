// Generates every Cool Write logo/icon asset from one design ("Midnight":
// dark tile, glowing gradient C with a text cursor and a sparkle).
//
//   node brand/generate-icons.mjs
//
// Outputs (commit them):
//   brand/logo.svg                 master mark (also copied to the places below)
//   public/logo.svg                in-app/site logo (crisp at any size, both themes)
//   src/app/icon.svg               browser favicon (Next.js file convention)
//   public/favicon.ico             16/32/48px fallback favicon
//   src/app/apple-icon.png         180px iOS home-screen icon (full-bleed; iOS rounds it)
//   desktop/build/icon.png         1024px macOS app icon on Apple's icon grid
//   desktop/build/icon.ico         Windows app/installer icon (16–256px)
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// The glyph, drawn on a 120×120 grid.
const GLYPH = `
    <path d="M74.8 41.2 A27 27 0 1 0 74.8 78.8" fill="none" stroke="url(#cw-ink)" stroke-width="15" stroke-linecap="round"/>
    <rect x="84" y="44" width="8" height="32" rx="4" fill="#22d3ee"/>
    <path d="M95 15 Q96.5 23.5 105 25 Q96.5 26.5 95 35 Q93.5 26.5 85 25 Q93.5 23.5 95 15 Z" fill="#b9a8ff"/>`;

const DEFS = `
  <defs>
    <linearGradient id="cw-ink" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#9b84ff"/>
      <stop offset="1" stop-color="#22d3ee"/>
    </linearGradient>
    <radialGradient id="cw-glow" cx="0.46" cy="0.5" r="0.42">
      <stop offset="0" stop-color="#6d4aff" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#6d4aff" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

// The tile + glyph in 120×120 units. `rounded: false` gives a full-bleed
// square for platforms that apply their own mask (iOS).
function tile({ rounded = true } = {}) {
  const rx = rounded ? 28 : 0;
  return `
    <rect width="120" height="120" rx="${rx}" fill="#13131c"/>
    <rect width="120" height="120" rx="${rx}" fill="url(#cw-glow)"/>
    ${rounded ? `<rect x="1" y="1" width="118" height="118" rx="27" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>` : ""}
    ${GLYPH}`;
}

// Mark scaled into a `size` canvas with `inset` transparent margin on each side.
function svg({ size = 120, inset = 0, rounded = true } = {}) {
  const scale = (size - inset * 2) / 120;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${DEFS}
  <g transform="translate(${inset} ${inset}) scale(${scale})">${tile({ rounded })}
  </g>
</svg>
`;
}

const png = (svgText, size) => sharp(Buffer.from(svgText), { density: 72 }).resize(size, size).png().toBuffer();

// ICO with embedded PNGs (supported since Windows Vista and by all browsers).
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry); // 0 means 256
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2); // palette
    header.writeUInt8(0, entry + 3); // reserved
    header.writeUInt16LE(1, entry + 4); // color planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

function write(relativePath, data) {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log(`  ${relativePath}`);
}

console.log("Generating Cool Write icons:");

const master = svg();
write("brand/logo.svg", master);
write("public/logo.svg", master);
write("src/app/icon.svg", master);

// Favicon: rendered per size so small sizes stay crisp.
write(
  "public/favicon.ico",
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(svg({ size }), size) })))),
);

write("src/app/apple-icon.png", await png(svg({ size: 180, rounded: false }), 180));

// macOS: Apple's grid puts the 824px rounded tile inside a 1024px canvas.
write("desktop/build/icon.png", await png(svg({ size: 1024, inset: 100 }), 1024));

// Windows: icons fill nearly the whole square.
write(
  "desktop/build/icon.ico",
  ico(
    await Promise.all(
      [16, 24, 32, 48, 64, 128, 256].map(async (size) => {
        const inset = Math.max(0, Math.round(size * 0.03));
        return { size, data: await png(svg({ size, inset }), size) };
      }),
    ),
  ),
);

console.log("Done.");
