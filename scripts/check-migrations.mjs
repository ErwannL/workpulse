/**
 * Vérifie que les migrations Prisma ne contiennent que du SQL.
 *
 * Ce contrôle existe à cause d'une erreur réelle : la migration initiale a été
 * engendrée avec `2>&1`, ce qui a collé l'encadré décoratif « Update available »
 * de Prisma à la fin du fichier. Le SQL était valide jusqu'à la dernière ligne,
 * et la chaîne ne s'en est aperçue qu'au moment d'appliquer la migration sur
 * une vraie base — après la poussée.
 *
 * Un contrôle statique attrape cela en local, sans base de données.
 *
 * Usage : node scripts/check-migrations.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(RACINE, 'apps/api/prisma/migrations');

/** Une ligne de migration est du SQL, un commentaire, ou rien. */
const LIGNE_VALIDE = /^\s*(--.*)?$|^[\s\w"'`(),.;:*=<>[\]{}$%+/\\|&!?@#^~-]*$/;

/** Caractères que seul un affichage décoratif produit. */
const DECORATION = /[┌┐└┘│├┤┬┴─═║╔╗╚╝]/;

let erreurs = 0;

function verifier(chemin, nom) {
  const contenu = readFileSync(chemin, 'utf-8');
  const lignes = contenu.split('\n');

  lignes.forEach((ligne, index) => {
    const numero = index + 1;
    if (DECORATION.test(ligne)) {
      console.error(
        `${nom}:${numero} — encadré décoratif dans du SQL : ${ligne.trim().slice(0, 60)}`,
      );
      erreurs += 1;
      return;
    }
    if (!LIGNE_VALIDE.test(ligne)) {
      console.error(
        `${nom}:${numero} — ligne qui n'a pas l'air d'être du SQL : ${ligne.trim().slice(0, 60)}`,
      );
      erreurs += 1;
    }
  });

  const instructions = contenu.replace(/--.*$/gm, '').trim();
  if (instructions.length > 0 && !instructions.endsWith(';')) {
    console.error(`${nom} — la dernière instruction ne se termine pas par « ; »`);
    erreurs += 1;
  }
}

let dossiers = [];
try {
  dossiers = readdirSync(MIGRATIONS).filter((nom) => statSync(join(MIGRATIONS, nom)).isDirectory());
} catch {
  console.error(`Aucun dossier de migrations dans ${MIGRATIONS}.`);
  process.exit(1);
}

if (dossiers.length === 0) {
  console.error('Aucune migration trouvée.');
  process.exit(1);
}

for (const dossier of dossiers) {
  verifier(join(MIGRATIONS, dossier, 'migration.sql'), dossier);
}

if (erreurs > 0) {
  console.error(
    `\n${erreurs} problème(s). Régénérez la migration sans rediriger la sortie d'erreur :`,
  );
  console.error(
    '  npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > migration.sql',
  );
  process.exit(1);
}

console.log(`${dossiers.length} migration(s) vérifiée(s) : uniquement du SQL.`);
