/**
 * Aligne le projet Android sur le paquet web : numéro de version, code de
 * version et icônes.
 *
 * Le `.apk` doit annoncer la même version que le panneau d'administration de
 * l'application, sans quoi un utilisateur ne peut pas dire ce qu'il a installé.
 * Le `versionCode`, lui, doit croître à chaque publication : Android refuse
 * d'installer par-dessus une valeur inférieure ou égale.
 *
 * Usage : node scripts/sync-android.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = resolve(RACINE, 'apps/web');
const ANDROID = resolve(WEB, 'android');

const pkg = JSON.parse(readFileSync(resolve(WEB, 'package.json'), 'utf-8'));
const version = pkg.version;

/**
 * `1.4.12` devient `10412` : monotone tant que mineur et correctif restent
 * sous 100, ce qui laisse largement de quoi voir venir.
 */
function versionCode(v) {
  const [majeur = 0, mineur = 0, correctif = 0] = v
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0);
  return majeur * 10000 + mineur * 100 + correctif;
}

// --- build.gradle -----------------------------------------------------------
const gradlePath = resolve(ANDROID, 'app/build.gradle');
let gradle = readFileSync(gradlePath, 'utf-8');
gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode(version)}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
writeFileSync(gradlePath, gradle);

// --- icônes -----------------------------------------------------------------
// Les icônes sont dessinées ici plutôt qu'importées : une seule définition du
// logo, partagée par le favicon, le manifeste web et l'application Android.
const BG = [10, 12, 17];
const ACCENT = [69, 227, 173];
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
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function strokeCoverage(x, y, scale) {
  let d = Infinity;
  for (let i = 0; i < PATH.length - 1; i++)
    d = Math.min(d, distToSegment(x, y, PATH[i], PATH[i + 1]));
  return Math.max(0, Math.min(1, (STROKE / 2 - d) * scale + 0.5));
}

function roundedCoverage(x, y, scale) {
  const cx = Math.min(Math.max(x, RADIUS), 64 - RADIUS);
  const cy = Math.min(Math.max(y, RADIUS), 64 - RADIUS);
  return Math.max(0, Math.min(1, (RADIUS - Math.hypot(x - cx, y - cy)) * scale + 0.5));
}

function circleCoverage(x, y, scale) {
  return Math.max(0, Math.min(1, (30 - Math.hypot(x - 32, y - 32)) * scale + 0.5));
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

/**
 * `forme` vaut 'rounded' (icône classique), 'circle' (icône ronde) ou
 * 'foreground' (calque avant d'une icône adaptative : fond transparent,
 * tracé réduit pour survivre au recadrage du système).
 */
function png(size, forme) {
  const scale = size / 64;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let py = 0; py < size; py++) {
    raw[p++] = 0;
    for (let px = 0; px < size; px++) {
      // Le calque avant est dessiné dans les 72 % centraux, zone que tous les
      // masques Android préservent.
      const marge = forme === 'foreground' ? 0.72 : 1;
      const x = ((px + 0.5) / scale - 32) / marge + 32;
      const y = ((py + 0.5) / scale - 32) / marge + 32;

      const fond =
        forme === 'foreground'
          ? 0
          : forme === 'circle'
            ? circleCoverage(x, y, scale)
            : roundedCoverage(x, y, scale);
      const trace = strokeCoverage(x, y, scale);
      const alpha = forme === 'foreground' ? trace : fond;
      const melange = forme === 'foreground' ? 1 : trace * fond;

      for (let i = 0; i < 3; i++) {
        raw[p++] =
          forme === 'foreground'
            ? ACCENT[i]
            : Math.round(BG[i] * (1 - melange) + ACCENT[i] * melange);
      }
      raw[p++] = Math.round(alpha * 255);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const DENSITES = [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
];

const res = resolve(ANDROID, 'app/src/main/res');
for (const [densite, taille] of DENSITES) {
  const dossier = resolve(res, `mipmap-${densite}`);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(resolve(dossier, 'ic_launcher.png'), png(taille, 'rounded'));
  writeFileSync(resolve(dossier, 'ic_launcher_round.png'), png(taille, 'circle'));
  writeFileSync(resolve(dossier, 'ic_launcher_foreground.png'), png(taille * 2, 'foreground'));

  // Icône monochrome de la barre d'état : Android n'en garde que l'opacité.
  const drawable = resolve(res, `drawable-${densite}`);
  mkdirSync(drawable, { recursive: true });
  writeFileSync(
    resolve(drawable, 'ic_stat_workpulse.png'),
    png(Math.round(taille / 2), 'foreground'),
  );
}

// Fond de l'icône adaptative : une couleur, pas une image.
mkdirSync(resolve(res, 'values'), { recursive: true });
writeFileSync(
  resolve(res, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0A0C11</color>
</resources>
`,
);

for (const nom of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  mkdirSync(resolve(res, 'mipmap-anydpi-v26'), { recursive: true });
  writeFileSync(
    resolve(res, 'mipmap-anydpi-v26', nom),
    `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`,
  );
}

console.log(`Android aligné sur la version ${version} (versionCode ${versionCode(version)})`);
