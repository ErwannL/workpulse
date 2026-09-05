/**
 * Budget de poids de l'application web.
 *
 * WorkPulse est une application mobile installable : elle doit rester légère
 * même sur une connexion médiocre. Ce garde-fou échoue si un ajout de
 * dépendance fait franchir le seuil, plutôt que de le laisser glisser
 * quelques kilo-octets à la fois.
 *
 * Usage : node scripts/check-bundle-budget.mjs
 */
import { readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RACINE, 'apps/web/dist');

/** Seuils exprimés en kilo-octets une fois compressés. */
const BUDGETS = {
  '.js': 220,
  '.css': 30,
};

function fichiers(dossier) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name);
    return entree.isDirectory() ? fichiers(chemin) : [chemin];
  });
}

function ko(octets) {
  return Math.round((octets / 1024) * 10) / 10;
}

let existe = true;
try {
  statSync(DIST);
} catch {
  existe = false;
}

if (!existe) {
  console.error(`Aucun build trouvé dans ${DIST}. Lancez « npm run build » d'abord.`);
  process.exit(1);
}

const totaux = {};
for (const chemin of fichiers(DIST)) {
  const ext = extname(chemin);
  if (!(ext in BUDGETS)) continue;
  totaux[ext] = (totaux[ext] ?? 0) + gzipSync(readFileSync(chemin)).byteLength;
}

let depassement = false;
console.log('Poids compressé (gzip) de l’application web :\n');
for (const [ext, budget] of Object.entries(BUDGETS)) {
  const poids = ko(totaux[ext] ?? 0);
  const verdict = poids > budget ? 'DÉPASSÉ' : 'ok';
  if (poids > budget) depassement = true;
  console.log(`  ${ext.padEnd(5)} ${String(poids).padStart(7)} ko / ${budget} ko  ${verdict}`);
}

if (depassement) {
  console.error('\nBudget de poids dépassé. Ajoutez la dépendance en connaissance de cause,');
  console.error('ou relevez le seuil dans scripts/check-bundle-budget.mjs en expliquant pourquoi.');
  process.exit(1);
}

console.log('\nBudget respecté.');
