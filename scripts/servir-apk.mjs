/**
 * Sert un `.apk` sur le réseau local, le temps de l'installer sur un téléphone.
 *
 * Ce script existe à cause d'un symptôme réel : sur certains téléphones, le
 * téléchargement depuis la page des versions atteint 100 % puis se fige, et le
 * fichier n'arrive jamais. Le transfert aboutit pourtant — vérifié : `200`,
 * `Content-Length` exact, ni `chunked` ni `gzip`, empreinte conforme.
 *
 * Deux en-têtes distinguent ce serveur de celui de GitHub, et ce sont
 * précisément ceux qui déclenchent le blocage :
 *
 * - `Connection: close` plutôt que `keep-alive` — un gestionnaire qui attend la
 *   fermeture de la connexion au lieu de s'arrêter à `Content-Length` finit
 *   par la voir arriver ;
 * - `Accept-Ranges: none` — aucune reprise partielle n'est proposée, donc
 *   aucune tentative de reprise ne peut rester en attente.
 *
 * Il sert donc autant de dépannage que de diagnostic : si le téléchargement
 * aboutit ici et pas depuis GitHub, la cause est là. S'il se fige aussi, elle
 * est dans le téléphone — Play Protect qui retient le paquet en analyse — et
 * aucun serveur n'y changera rien.
 *
 * Usage : npm run servir:apk [chemin] [port]
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE_GRADLE = join(RACINE, 'apps/web/android/app/build/outputs/apk/release');

/** À défaut de chemin explicite, le paquet que Gradle vient de produire. */
function paquetParDefaut() {
  if (!existsSync(SORTIE_GRADLE)) return null;
  const apk = readdirSync(SORTIE_GRADLE).find((n) => n.endsWith('.apk'));
  return apk ? join(SORTIE_GRADLE, apk) : null;
}

const FICHIER = process.argv[2] ? resolve(process.argv[2]) : paquetParDefaut();
const PORT = Number(process.argv[3] ?? 8765);

if (!FICHIER || !existsSync(FICHIER)) {
  console.error(
    'Aucun paquet à servir.\n\n' +
      'Indiquez un chemin :  npm run servir:apk -- chemin/vers/workpulse.apk\n' +
      'ou compilez-en un :   npm run android && (cd apps/web/android && ./gradlew assembleRelease)',
  );
  process.exit(1);
}

const NOM = FICHIER.split(/[\\/]/).pop();
const contenu = readFileSync(FICHIER);
const taille = statSync(FICHIER).size;
const empreinte = createHash('sha256').update(contenu).digest('hex');

/** Adresses IPv4 par lesquelles un téléphone du même réseau peut joindre ce poste. */
function adressesLocales() {
  return (
    Object.values(networkInterfaces())
      .flat()
      .filter((i) => i && i.family === 'IPv4' && !i.internal)
      .map((i) => i.address)
      // Les adresses auto-attribuées signalent un réseau absent, pas un réseau local.
      .filter((a) => !a.startsWith('169.254.'))
  );
}

const PAGE = `<!doctype html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>WorkPulse</title>
<style>
 body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0A0C11;color:#E8ECF2;
      font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px}
 main{max-width:22rem;text-align:center}
 h1{font-size:26px;letter-spacing:-.03em;margin:0 0 4px}
 p{color:#8A93A6;margin:0 0 28px}
 a{display:block;background:#45E3AD;color:#06251C;text-decoration:none;font-weight:700;
   padding:18px;border-radius:16px;font-size:18px}
 code{font-size:11px;color:#5C6478;word-break:break-all;display:block;margin-top:24px}
</style></head><body><main>
 <h1>WorkPulse</h1>
 <p>${(taille / 1024 / 1024).toFixed(2)} Mo · servi depuis ton ordinateur</p>
 <a href="/${NOM}" download>Télécharger l’application</a>
 <code>SHA-256 ${empreinte}</code>
</main></body></html>`;

const serveur = createServer((req, res) => {
  if (req.url === `/${NOM}`) {
    console.log(
      `→ ${new Date().toLocaleTimeString('fr-FR')} · demandé par ${req.socket.remoteAddress}`,
    );
    res.writeHead(200, {
      'content-type': 'application/vnd.android.package-archive',
      'content-length': String(taille),
      'content-disposition': `attachment; filename="${NOM}"`,
      'accept-ranges': 'none',
      connection: 'close',
    });
    res.end(contenu);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(PAGE);
});

serveur.listen(PORT, '0.0.0.0', () => {
  const adresses = adressesLocales();
  console.log(`${NOM} — ${(taille / 1024 / 1024).toFixed(2)} Mo`);
  console.log(`SHA-256 ${empreinte}\n`);
  if (adresses.length === 0) {
    console.log(`Aucune adresse locale trouvée. Ce poste est-il sur un réseau ?`);
  } else {
    console.log('Depuis le téléphone, sur le même réseau :');
    for (const a of adresses) console.log(`  http://${a}:${PORT}`);
  }
  console.log('\nAu premier accès, Windows demande d’autoriser Node sur les réseaux privés.');
  console.log('Ctrl+C pour arrêter.');
});
