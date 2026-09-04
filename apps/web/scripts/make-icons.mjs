// Génère les icônes PNG du manifeste à partir de la même forme que le favicon.
// Rastérisation maison : pas de dépendance graphique pour un projet de cette taille.
// Usage : node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');

const BG = [10, 12, 17];
const ACCENT = [69, 227, 173];

/** Points du logo, exprimés dans un carré de 64 unités. */
const PATH = [
  [8, 34],
  [16, 34],
  [21, 19],
  [29, 47],
  [35, 30],
  [39, 38],
  [50, 38],
];
const STROKE = 4.5;
const RADIUS = 15;

function distToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Couverture du tracé en un point, avec un dégradé d'un pixel pour l'anticrénelage. */
function strokeCoverage(x, y, scale) {
  let d = Infinity;
  for (let i = 0; i < PATH.length - 1; i++) {
    d = Math.min(d, distToSegment(x, y, PATH[i], PATH[i + 1]));
  }
  const edge = STROKE / 2;
  const soft = 1 / scale;
  return Math.max(0, Math.min(1, (edge - d) / soft + 0.5));
}

/** Couverture du fond arrondi. */
function bgCoverage(x, y, scale) {
  const r = RADIUS;
  const cx = Math.min(Math.max(x, r), 64 - r);
  const cy = Math.min(Math.max(y, r), 64 - r);
  const d = Math.hypot(x - cx, y - cy);
  const soft = 1 / scale;
  return Math.max(0, Math.min(1, (r - d) / soft + 0.5));
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const scale = size / 64;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let py = 0; py < size; py++) {
    raw[p++] = 0; // filtre « none »
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) / scale;
      const y = (py + 0.5) / scale;
      const a = bgCoverage(x, y, scale);
      const s = strokeCoverage(x, y, scale) * a;
      for (let i = 0; i < 3; i++) {
        raw[p++] = Math.round(BG[i] * (1 - s) + ACCENT[i] * s);
      }
      raw[p++] = Math.round(a * 255);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const size of [180, 192, 512]) {
  const file = resolve(OUT, `icon-${size}.png`);
  writeFileSync(file, png(size));
  console.log(`écrit ${file}`);
}
