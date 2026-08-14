/**
 * Generates the PWA icons in `public/icons/` from the app's own brand mark
 * (the white "+" on a teal rounded square used by `.brand-mark` in the
 * topbar), so the installed app matches the site instead of shipping the
 * unrelated blue squares the starter template came with.
 *
 * Run with: node build/generate-icons.mjs
 *
 * Rasterizes and encodes the PNGs by hand using only Node's built-in
 * `zlib` — the icons are flat geometry (rounded rect + plus), so this
 * avoids adding a native image dependency (sharp/canvas) that would only
 * ever run once. Keeping the generator in the repo means the icons stay
 * reproducible and tweakable, rather than being opaque committed blobs.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

/** var(--teal) in app/globals.css. */
const TEAL = [31, 119, 115];
const WHITE = [255, 255, 255];
/** Sampling grid per pixel; 4x4 is plenty to keep the curves and plus edges smooth. */
const SUPERSAMPLE = 4;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/** RGBA pixel buffer -> PNG file bytes (8-bit, colour type 6, no interlacing). */
function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  // Each scanline is prefixed with its filter type; 0 (None) keeps this
  // simple and still compresses well for flat colour.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function insideRoundedSquare(x, y, size, radius) {
  if (x < 0 || y < 0 || x > size || y > size) return false;
  const nearestX = Math.min(x, size - x);
  const nearestY = Math.min(y, size - y);
  if (nearestX >= radius || nearestY >= radius) return true;
  const dx = radius - nearestX;
  const dy = radius - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

function insidePlus(x, y, size, armLength, armThickness) {
  const fromCentreX = Math.abs(x - size / 2);
  const fromCentreY = Math.abs(y - size / 2);
  const onVerticalBar = fromCentreX <= armThickness / 2 && fromCentreY <= armLength / 2;
  const onHorizontalBar = fromCentreY <= armThickness / 2 && fromCentreX <= armLength / 2;
  return onVerticalBar || onHorizontalBar;
}

/**
 * `maskable` icons are cropped to whatever shape the launcher wants, so
 * they go full-bleed (no rounded corners of our own) and keep the plus
 * inside the ~80% safe zone. Regular icons draw their own rounded square.
 */
function renderIcon(size, { maskable }) {
  const cornerRadius = maskable ? 0 : size * 0.22;
  const armLength = size * (maskable ? 0.4 : 0.52);
  const armThickness = size * (maskable ? 0.1 : 0.13);
  const rgba = Buffer.alloc(size * size * 4);
  const step = 1 / SUPERSAMPLE;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let backgroundHits = 0;
      let plusHits = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const px = x + (sx + 0.5) * step;
          const py = y + (sy + 0.5) * step;
          if (!insideRoundedSquare(px, py, size, cornerRadius)) continue;
          backgroundHits++;
          if (insidePlus(px, py, size, armLength, armThickness)) plusHits++;
        }
      }

      const samples = SUPERSAMPLE * SUPERSAMPLE;
      const offset = (y * size + x) * 4;
      if (backgroundHits === 0) continue; // stays fully transparent

      // Blend the plus over the teal by coverage, then apply the rounded
      // square's own coverage as the alpha — antialiases both edges.
      const plusCoverage = plusHits / backgroundHits;
      for (let channel = 0; channel < 3; channel++) {
        rgba[offset + channel] = Math.round(
          TEAL[channel] * (1 - plusCoverage) + WHITE[channel] * plusCoverage,
        );
      }
      rgba[offset + 3] = Math.round((backgroundHits / samples) * 255);
    }
  }

  return encodePng(size, size, rgba);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const icons = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
  // iOS ignores the manifest icons and uses apple-touch-icon, which is
  // composited on an opaque background — hence a non-maskable, self-rounded one.
  { file: "apple-touch-icon.png", size: 180, maskable: false },
];

for (const { file, size, maskable } of icons) {
  writeFileSync(join(OUTPUT_DIR, file), renderIcon(size, { maskable }));
  console.log(`gerado public/icons/${file} (${size}x${size})`);
}
