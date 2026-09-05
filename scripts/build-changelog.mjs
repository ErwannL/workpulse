/**
 * Transforme CHANGELOG.md en données exploitables par l'application.
 *
 * Le fichier Markdown reste la source unique : il alimente la release GitHub
 * et l'écran « Nouveautés ». Générer plutôt que dupliquer évite qu'une note
 * apparaisse dans l'un et pas dans l'autre.
 *
 * Usage : node scripts/build-changelog.mjs [--check]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(RACINE, 'CHANGELOG.md');
const SORTIE = resolve(RACINE, 'apps/web/src/generated/changelog.json');

/** `## [0.4.0] — 2026-09-05` ou `## [Non publié]` */
const TITRE_VERSION = /^## \[([^\]]+)\](?:\s*[—-]\s*(\d{4}-\d{2}-\d{2}))?\s*$/;
/** `### Ajouté` */
const TITRE_SECTION = /^### (.+?)\s*$/;

export function parseChangelog(markdown) {
  const versions = [];
  let version = null;
  let section = null;

  for (const ligne of markdown.split('\n')) {
    const titreVersion = TITRE_VERSION.exec(ligne);
    if (titreVersion) {
      const [, nom, date] = titreVersion;
      version = { version: nom, date: date ?? null, sections: [] };
      section = null;
      // La section « Non publié » n'a pas sa place dans une application livrée.
      if (!/non publi/i.test(nom)) versions.push(version);
      continue;
    }

    if (version === null) continue;

    const titreSection = TITRE_SECTION.exec(ligne);
    if (titreSection) {
      section = { titre: titreSection[1], entrees: [] };
      version.sections.push(section);
      continue;
    }

    // Une entrée de liste ; les lignes suivantes indentées la prolongent.
    if (/^- /.test(ligne) && section) {
      section.entrees.push(nettoyer(ligne.slice(2)));
    } else if (/^\s{2,}\S/.test(ligne) && section && section.entrees.length > 0) {
      const dernier = section.entrees.length - 1;
      section.entrees[dernier] = `${section.entrees[dernier]} ${nettoyer(ligne.trim())}`;
    }
  }

  return versions;
}

/** Retire le gras Markdown : l'application applique son propre style. */
function nettoyer(texte) {
  return texte
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim();
}

const versions = parseChangelog(readFileSync(SOURCE, 'utf-8'));
const contenu = `${JSON.stringify(versions, null, 2)}\n`;

if (process.argv.includes('--check')) {
  let actuel;
  try {
    actuel = readFileSync(SORTIE, 'utf-8');
  } catch {
    actuel = '';
  }
  if (actuel !== contenu) {
    console.error('changelog.json est désynchronisé de CHANGELOG.md.');
    console.error('Lancez « npm run changelog » et committez le résultat.');
    process.exit(1);
  }
  console.log('changelog.json est à jour.');
} else {
  mkdirSync(dirname(SORTIE), { recursive: true });
  writeFileSync(SORTIE, contenu);
  console.log(`${versions.length} version(s) écrites dans ${SORTIE}`);
}
