/**
 * Extrait les notes d'une version depuis CHANGELOG.md.
 *
 * La release GitHub et l'écran « Nouveautés » de l'application décrivent donc
 * exactement la même chose : il n'y a qu'un texte à écrire, et il est écrit au
 * moment du changement, pas au moment de la publication.
 *
 * Usage : node scripts/release-notes.mjs v0.4.0
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function extraireNotes(markdown, version) {
  const cible = version.replace(/^v/, '');
  const lignes = markdown.split('\n');
  const debut = lignes.findIndex((l) => new RegExp(`^## \\[${escape(cible)}\\]`).test(l));
  if (debut === -1) return null;

  const suite = lignes.slice(debut + 1);
  const fin = suite.findIndex((l) => /^## \[/.test(l));
  const corps = (fin === -1 ? suite : suite.slice(0, fin)).join('\n').trim();
  return corps.length > 0 ? corps : null;
}

function escape(v) {
  return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const version = process.argv[2];
if (!version) {
  console.error('Version attendue en argument, par exemple v0.4.0');
  process.exit(1);
}

const notes = extraireNotes(readFileSync(resolve(RACINE, 'CHANGELOG.md'), 'utf-8'), version);

if (notes === null) {
  console.error(`Aucune section « ## [${version.replace(/^v/, '')}] » dans CHANGELOG.md.`);
  console.error('Une version se documente avant de se publier.');
  process.exit(1);
}

process.stdout.write(`${notes}\n`);
