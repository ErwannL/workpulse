/**
 * Engendre les captures d'écran de la documentation.
 *
 * Des captures faites à la main pourrissent : l'interface bouge, les images
 * restent, et la documentation finit par montrer une application qui n'existe
 * plus. Celles-ci se refont en une commande.
 *
 * Deux précautions rendent le résultat reproductible d'une machine à l'autre :
 *
 * - l'horloge est figée avant le premier script de la page, donc « il te reste
 *   2h18 » vaut toujours 2h18 ;
 * - les données sont réécrites à chaque fois dans IndexedDB, à partir d'un
 *   profil Chrome jetable.
 *
 * Aucune dépendance : Chrome est piloté par son protocole de débogage, que
 * Node sait atteindre seul depuis qu'il embarque un client WebSocket.
 *
 * Usage : npm run screenshots        (après `npm run build`)
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RACINE, 'apps/web/dist');
const SORTIE = join(RACINE, 'docs/captures');

// --- le jeu de données mis en scène ------------------------------------------

/**
 * Jeudi et vendredi de la semaine, plus la précédente bouclée en avance.
 * Les horaires sont volontairement imparfaits : personne ne pointe à 8h00 pile,
 * et une capture qui le prétend sonne faux.
 */
const SEMAINES = {
  // Semaine précédente, terminée avec de l'avance.
  '2026-08-24': ['08:00', '12:04', '12:36', '17:06'],
  '2026-08-25': ['07:54', '12:00', '12:32', '17:02'],
  '2026-08-26': ['08:06', '12:10', '12:44', '17:12'],
  '2026-08-27': ['08:02', '12:00', '12:34', '17:04'],
  '2026-08-28': ['07:58', '12:06', '12:38', '16:58'],
  // Semaine en cours, à l'équilibre.
  '2026-08-31': ['08:04', '12:02', '13:04', '16:06'],
  '2026-09-01': ['07:58', '12:10', '13:08', '16:02'],
  '2026-09-02': ['08:12', '12:00', '13:02', '16:14'],
  '2026-09-03': ['08:00', '12:05', '13:05', '16:02'],
};

const JOURS = [
  { date: '2026-09-02', status: 'REMOTE' },
  { date: '2026-08-26', status: 'REMOTE' },
  { date: '2026-09-09', status: 'LEAVE' },
  { date: '2026-09-10', status: 'LEAVE' },
  { date: '2026-09-14', status: 'RTT' },
];

/** Exécuté dans la page : réécrit la base locale de fond en comble. */
function scriptDeSemis(entreesDuJour) {
  return `(async () => {
  const ts = (d, hm) => { const [h,m]=hm.split(':').map(Number); const [Y,M,D]=d.split('-').map(Number); return new Date(Y,M-1,D,h,m,0,0).getTime(); };
  const types = ['CLOCK_IN','BREAK_START','BREAK_END','CLOCK_OUT'];
  const req = indexedDB.open('workpulse');
  await new Promise((r) => { req.onsuccess = r; });
  const db = req.result;
  const tx = db.transaction(['entries','days','meta'],'readwrite');
  const es = tx.objectStore('entries');
  es.clear();
  let i = 0;
  for (const [date, heures] of Object.entries(${JSON.stringify(SEMAINES)}))
    heures.forEach((hm, k) => es.put({ id:'c'+i++, date, type:types[k], at:ts(date,hm), manual:false }));
  for (const [type, hm] of ${JSON.stringify(entreesDuJour)})
    es.put({ id:'c'+i++, date:'2026-09-04', type, at:ts('2026-09-04',hm), manual:false });
  const ds = tx.objectStore('days');
  ds.clear();
  for (const j of ${JSON.stringify(JOURS)}) ds.put({ ...j, updatedAt: Date.now() });
  const ms = tx.objectStore('meta');
  const q = ms.get('settings');
  const cur = await new Promise((r) => { q.onsuccess = () => r(q.result); });
  ms.put({ key:'settings', value: { ...cur.value, userName:'Erwann', trackingStart:'2026-08-24', initialBalance:0 } });
  await new Promise((r) => { tx.oncomplete = r; });
  db.close();
  return 'ok';
})()`;
}

/**
 * Les captures.
 *
 * `heure` fige l'horloge : c'est elle qui décide de l'état affiché, puisque
 * tout le reste en découle. Le vendredi à 16h12, l'avance de la semaine couvre
 * la journée ; à 12h15, la pause de quinze minutes est refusée.
 */
const CAPTURES = [
  {
    nom: 'accueil',
    legende: 'Le tableau de bord décide à ta place',
    route: 'pulse',
    heure: '16:12',
    jour: [
      ['CLOCK_IN', '08:01'],
      ['BREAK_START', '12:04'],
      ['BREAK_END', '13:03'],
    ],
    hauteur: 812,
  },
  {
    nom: 'pause',
    legende: 'La pause minimale légale ne se contourne pas',
    route: 'pulse',
    heure: '12:19',
    jour: [
      ['CLOCK_IN', '08:01'],
      ['BREAK_START', '12:04'],
    ],
    hauteur: 812,
  },
  {
    nom: 'semaine',
    legende: 'La semaine, jour par jour',
    route: 'semaine',
    heure: '17:34',
    jour: [
      ['CLOCK_IN', '08:01'],
      ['BREAK_START', '12:04'],
      ['BREAK_END', '13:03'],
      ['CLOCK_OUT', '16:13'],
    ],
    hauteur: 980,
  },
  {
    nom: 'calendrier',
    legende: 'Congés, télétravail et jours fériés',
    route: 'calendrier',
    heure: '17:34',
    jour: [
      ['CLOCK_IN', '08:01'],
      ['BREAK_START', '12:04'],
      ['BREAK_END', '13:03'],
      ['CLOCK_OUT', '16:13'],
    ],
    hauteur: 980,
  },
  {
    nom: 'statistiques',
    legende: 'Les tendances, sans rien calculer',
    route: 'stats',
    heure: '17:34',
    jour: [
      ['CLOCK_IN', '08:01'],
      ['BREAK_START', '12:04'],
      ['BREAK_END', '13:03'],
      ['CLOCK_OUT', '16:13'],
    ],
    hauteur: 980,
  },
  {
    nom: 'reglages',
    legende: 'La semaine type, jour par jour',
    route: 'reglages',
    heure: '17:34',
    jour: [
      ['CLOCK_IN', '08:01'],
      ['BREAK_START', '12:04'],
      ['BREAK_END', '13:03'],
      ['CLOCK_OUT', '16:13'],
    ],
    hauteur: 980,
  },
];

// --- serveur statique --------------------------------------------------------

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

/** Segments qu'un chemin d'URL ne doit jamais conserver : remontées et racine. */
const REMONTEES = /^(?:\.\.(?:[/\\]|$))+/;
const RACINE_ABSOLUE = /^[/\\]+/;

/**
 * Sert `apps/web/dist` sur un port éphémère de la boucle locale.
 *
 * Le chemin demandé est normalisé puis débarrassé de ses remontées avant d'être
 * joint à la racine : ce qui en sort est relatif à `DIST`, quoi qu'on demande.
 * Comparer le résultat avec `startsWith(DIST)` ne suffirait pas — `dist` est
 * aussi un préfixe de `distractor`.
 */
function servirDist() {
  const serveur = createServer((req, res) => {
    const demande = decodeURIComponent(req.url.split('?')[0]);
    const relatif = normalize(demande).replace(REMONTEES, '').replace(RACINE_ABSOLUE, '');
    let fichier = join(DIST, relatif || 'index.html');
    // Toute autre URL retombe sur l'application : le routage se fait par
    // fragment, mais un rechargement doit servir la page malgré tout.
    if (!existsSync(fichier)) fichier = join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(fichier)] ?? 'application/octet-stream' });
    res.end(readFileSync(fichier));
  });
  return new Promise((r) => serveur.listen(0, '127.0.0.1', () => r(serveur)));
}

// --- pilotage de Chrome ------------------------------------------------------

function trouverChrome() {
  const candidats = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const trouve = candidats.find((c) => existsSync(c));
  if (!trouve) {
    throw new Error(
      'Chrome introuvable. Indiquez son chemin dans la variable CHROME_PATH.\n' +
        `Cherché : ${candidats.join(', ')}`,
    );
  }
  return trouve;
}

async function attendre(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

/** Client CDP minimal : une connexion, des messages numérotés, des promesses. */
function connecter(url) {
  const ws = new WebSocket(url);
  const attentes = new Map();
  let compteur = 0;
  const pret = new Promise((r, rej) => {
    ws.addEventListener('open', r, { once: true });
    ws.addEventListener('error', () => rej(new Error('connexion CDP refusée')), { once: true });
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    const attente = attentes.get(msg.id);
    if (!attente) return;
    attentes.delete(msg.id);
    if (msg.error) attente.rej(new Error(`${msg.error.message} (${JSON.stringify(msg.error)})`));
    else attente.res(msg.result);
  });
  return {
    pret,
    fermer: () => ws.close(),
    envoyer(method, params = {}, sessionId) {
      const id = ++compteur;
      return new Promise((res, rej) => {
        attentes.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
  };
}

async function versionDeChrome(port, essais = 60) {
  for (let i = 0; i < essais; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return await r.json();
    } catch {
      /* pas encore prêt */
    }
    await attendre(250);
  }
  throw new Error("Chrome n'a pas ouvert son port de débogage.");
}

/**
 * Fige `Date` avant que le moindre script de la page ne s'exécute.
 * `performance.now` est laissé tranquille : React s'en sert pour son
 * ordonnancement, et le figer bloque le rendu.
 */
function scriptHorloge(heure) {
  const [h, m] = heure.split(':');
  return `(() => {
  const FIXE = new Date(2026, 8, 4, ${Number(h)}, ${Number(m)}, 0, 0).getTime();
  const Vraie = Date;
  class Figee extends Vraie {
    constructor(...a) { if (a.length === 0) super(FIXE); else super(...a); }
    static now() { return FIXE; }
  }
  Object.defineProperty(globalThis, 'Date', { value: Figee, writable: true, configurable: true });
  const style = document.createElement('style');
  style.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
})()`;
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    throw new Error(`${DIST} est vide. Lancez d'abord : npm run build`);
  }
  mkdirSync(SORTIE, { recursive: true });

  const serveur = await servirDist();
  const base = `http://127.0.0.1:${serveur.address().port}`;

  const profil = join(tmpdir(), `workpulse-captures-${process.pid}`);
  rmSync(profil, { recursive: true, force: true });
  const port = 9223 + (process.pid % 500);

  const chrome = spawn(
    trouverChrome(),
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profil}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let client;
  try {
    const { webSocketDebuggerUrl } = await versionDeChrome(port);
    client = connecter(webSocketDebuggerUrl);
    await client.pret;

    for (const capture of CAPTURES) {
      const { targetId } = await client.envoyer('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await client.envoyer('Target.attachToTarget', {
        targetId,
        flatten: true,
      });
      const cmd = (m, p) => client.envoyer(m, p, sessionId);

      await cmd('Page.enable');
      await cmd('Runtime.enable');
      await cmd('Emulation.setDeviceMetricsOverride', {
        width: 375,
        height: capture.hauteur,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await cmd('Page.addScriptToEvaluateOnNewDocument', { source: scriptHorloge(capture.heure) });

      // Premier passage : l'application crée la base. Puis on la remplit et on
      // recharge, faute de quoi l'écran affiche l'état d'avant le semis.
      await cmd('Page.navigate', { url: base });
      await attendre(1200);
      const semis = await cmd('Runtime.evaluate', {
        expression: scriptDeSemis(capture.jour),
        awaitPromise: true,
        returnByValue: true,
      });
      if (semis.exceptionDetails) {
        throw new Error(`semis refusé : ${JSON.stringify(semis.exceptionDetails)}`);
      }

      // Les écritures faites ici passent par IndexedDB directement, sans Dexie :
      // ses requêtes vives ne les voient donc pas. Seul un vrai rechargement
      // relit la base.
      //
      // Le fragment est posé et le rechargement demandé dans la même expression.
      // Enchaîner `Page.navigate` puis `Page.reload` laissait les deux se
      // courir après : une navigation qui ne change que le fragment se règle
      // immédiatement, et le rechargement repartait parfois de l'URL d'avant —
      // la capture du calendrier montrait alors le tableau de bord.
      await cmd('Runtime.evaluate', {
        expression: `location.hash = '#/${capture.route}'; location.reload();`,
      });
      await attendre(1800);

      const route = await cmd('Runtime.evaluate', {
        expression: 'location.hash',
        returnByValue: true,
      });
      if (route.result.value !== `#/${capture.route}`) {
        throw new Error(
          `${capture.nom} : l'écran affiché est ${route.result.value || '(aucun)'}, pas #/${capture.route}.`,
        );
      }

      const { data } = await cmd('Page.captureScreenshot', { format: 'png' });
      const fichier = join(SORTIE, `${capture.nom}.png`);
      writeFileSync(fichier, Buffer.from(data, 'base64'));
      console.log(
        `${capture.nom}.png — ${(Buffer.from(data, 'base64').length / 1024).toFixed(0)} ko`,
      );

      await client.envoyer('Target.closeTarget', { targetId });
    }
  } finally {
    client?.fermer();
    chrome.kill();
    serveur.close();
    // Windows garde la main sur le profil une fraction de seconde après la mort
    // du processus. Un profil jetable qui survit n'est pas une raison de faire
    // échouer une génération de captures par ailleurs réussie.
    await attendre(500);
    try {
      rmSync(profil, { recursive: true, force: true });
    } catch {
      /* le dossier temporaire disparaîtra avec la session */
    }
  }

  console.log(`\n${CAPTURES.length} captures dans docs/captures/.`);
}

await main();
