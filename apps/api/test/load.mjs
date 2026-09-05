/**
 * Test de charge de l'API de synchronisation.
 *
 * WorkPulse n'a pas vocation à encaisser des milliers de requêtes par seconde :
 * un appareil se synchronise quelques fois par jour. Ce que ce test cherche,
 * c'est autre chose — une régression qui rendrait une synchronisation lente ou
 * instable, typiquement un `N+1` sur la base ou une fuite de connexions.
 *
 * Les seuils sont donc établis sur ce qui compte : aucune erreur, aucun
 * dépassement de délai, et une latitude de latence large mais finie.
 *
 * Usage :
 *   DATABASE_URL=... node apps/api/test/load.mjs [--url http://localhost:3000]
 */
import { randomUUID } from 'node:crypto';
import autocannon from 'autocannon';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

const url = argument('--url') ?? 'http://127.0.0.1:3000';
const duree = Number(argument('--duree') ?? 10);
const connexions = Number(argument('--connexions') ?? 20);

/** Seuils d'échec. Généreux, mais pas infinis. */
const SEUILS = {
  erreurs: 0,
  delaisDepasses: 0,
  reponsesNonAttendues: 0,
  latenceP99Ms: 1500,
  requetesParSecondeMin: 20,
};

function argument(nom) {
  const index = process.argv.indexOf(nom);
  return index === -1 ? undefined : process.argv[index + 1];
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/** Crée un compte jetable et son appareil, puis rend le jeton. */
async function preparerCompte(prisma) {
  const user = await prisma.user.create({
    data: { email: `charge-${Date.now()}@workpulse.test`, displayName: 'Charge' },
  });
  const token = randomBytes(32).toString('base64url');
  await prisma.device.create({
    data: { userId: user.id, name: 'injecteur', tokenHash: hashToken(token) },
  });
  return { userId: user.id, token };
}

/** Une année de pointages : le volume d'un compte déjà bien rempli. */
async function remplir(prisma, userId) {
  const lignes = [];
  const debut = new Date('2025-01-06T00:00:00Z');
  for (let jour = 0; jour < 260; jour++) {
    const date = new Date(debut.getTime() + jour * 86_400_000);
    const iso = date.toISOString().slice(0, 10);
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
    for (const [type, heure] of [
      ['CLOCK_IN', 8],
      ['BREAK_START', 12],
      ['BREAK_END', 13],
      ['CLOCK_OUT', 17],
    ]) {
      lignes.push({
        id: randomUUID(),
        userId,
        date: iso,
        type,
        at: new Date(date.getTime() + heure * 3_600_000),
        manual: false,
        updatedAt: new Date(),
      });
    }
  }
  await prisma.timeEntry.createMany({ data: lignes });
  return lignes.length;
}

function resume(titre, resultat) {
  const l = resultat.latency;
  console.log(`\n### ${titre}`);
  console.log(`  requêtes/s   : ${resultat.requests.average.toFixed(1)}`);
  console.log(`  latence p50  : ${l.p50} ms`);
  console.log(`  latence p99  : ${l.p99} ms`);
  console.log(`  erreurs      : ${resultat.errors}`);
  console.log(`  délais       : ${resultat.timeouts}`);
  console.log(`  non-2xx      : ${resultat.non2xx}`);
}

function verifier(titre, resultat, echecs) {
  const l = resultat.latency;
  if (resultat.errors > SEUILS.erreurs) echecs.push(`${titre} : ${resultat.errors} erreur(s)`);
  if (resultat.timeouts > SEUILS.delaisDepasses) {
    echecs.push(`${titre} : ${resultat.timeouts} délai(s) dépassé(s)`);
  }
  if (resultat.non2xx > SEUILS.reponsesNonAttendues) {
    echecs.push(`${titre} : ${resultat.non2xx} réponse(s) hors 2xx`);
  }
  if (l.p99 > SEUILS.latenceP99Ms) {
    echecs.push(`${titre} : latence p99 de ${l.p99} ms (seuil ${SEUILS.latenceP99Ms} ms)`);
  }
  if (resultat.requests.average < SEUILS.requetesParSecondeMin) {
    echecs.push(
      `${titre} : ${resultat.requests.average.toFixed(1)} req/s (seuil ${SEUILS.requetesParSecondeMin})`,
    );
  }
}

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  const { userId, token } = await preparerCompte(prisma);
  const nombre = await remplir(prisma, userId);
  console.log(`Compte de charge : ${nombre} pointages sur un an.`);

  const entetes = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const echecs = [];

  try {
    // 1. Lecture complète : le cas le plus lourd, tout l'historique renvoyé.
    const lecture = await autocannon({
      url,
      connections: connexions,
      duration: duree,
      headers: entetes,
      requests: [{ method: 'GET', path: '/v1/sync' }],
    });
    resume('Lecture complète (GET /v1/sync)', lecture);
    verifier('Lecture complète', lecture, echecs);

    // 2. Lecture incrémentale : ce que fait réellement un appareil à jour.
    const incrementale = await autocannon({
      url,
      connections: connexions,
      duration: duree,
      headers: entetes,
      requests: [{ method: 'GET', path: `/v1/sync?since=${Date.now()}` }],
    });
    resume('Lecture incrémentale', incrementale);
    verifier('Lecture incrémentale', incrementale, echecs);

    // 3. Calcul de solde : il rejoue tout le domaine à chaque appel.
    const solde = await autocannon({
      url,
      connections: connexions,
      duration: duree,
      headers: entetes,
      requests: [{ method: 'GET', path: '/v1/summary/week?date=2025-06-02' }],
    });
    resume('Solde hebdomadaire', solde);
    verifier('Solde hebdomadaire', solde, echecs);

    // 4. Écriture : un lot d'un pointage, rejoué. Idempotent, donc sans effet
    //    de bord cumulatif — ce qu'on mesure est bien le coût de l'arbitrage.
    const ecriture = await autocannon({
      url,
      connections: Math.max(4, Math.floor(connexions / 4)),
      duration: duree,
      headers: entetes,
      requests: [
        {
          method: 'POST',
          path: '/v1/sync',
          body: JSON.stringify({
            entries: [
              {
                id: '11111111-1111-4111-8111-111111111111',
                date: '2025-06-02',
                type: 'CLOCK_IN',
                at: Date.UTC(2025, 5, 2, 6),
                manual: false,
                updatedAt: 1,
              },
            ],
            days: [],
          }),
        },
      ],
    });
    resume('Écriture (POST /v1/sync)', ecriture);
    verifier('Écriture', ecriture, echecs);
  } finally {
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await prisma.$disconnect();
  }

  if (echecs.length > 0) {
    console.error('\nSeuils dépassés :');
    for (const echec of echecs) console.error(`  - ${echec}`);
    process.exit(1);
  }

  console.log('\nTous les seuils sont tenus.');
}

main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
