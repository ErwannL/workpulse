import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { generateDeviceToken, hashToken } from '../src/auth/auth.service';

/**
 * Tests d'intrusion.
 *
 * Chacun décrit une attaque plausible sur l'API et l'issue attendue. Ils
 * tournent contre une vraie application et une vraie base : c'est le seul
 * moyen de vérifier que la défense tient dans la chaîne complète — validation,
 * ORM, garde d'authentification — et pas seulement dans une fonction isolée.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb('Intrusion (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  /** Deux comptes distincts : l'isolation se prouve à deux. */
  const alice = { userId: '', token: '' };
  const bob = { userId: '', token: '' };
  let jetonRevoque = '';

  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    // La même configuration qu'en production : les protections testées ici
    // sont exactement celles qui tourneront.
    app = configureApp(moduleRef.createNestApplication());
    await app.init();

    for (const [compte, nom] of [
      [alice, 'alice'],
      [bob, 'bob'],
    ] as const) {
      const user = await prisma.user.create({
        data: { email: `${nom}-${Date.now()}@workpulse.test`, displayName: nom },
      });
      compte.userId = user.id;
      compte.token = generateDeviceToken();
      await prisma.device.create({
        data: { userId: user.id, name: nom, tokenHash: hashToken(compte.token) },
      });
    }

    jetonRevoque = generateDeviceToken();
    await prisma.device.create({
      data: {
        userId: alice.userId,
        name: 'téléphone perdu',
        tokenHash: hashToken(jetonRevoque),
        revokedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    for (const { userId } of [alice, bob]) {
      if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
    await app?.close();
  });

  const auth = (compte: { token: string }) => ({ Authorization: `Bearer ${compte.token}` });
  const api = () => request(app.getHttpServer());

  // -------------------------------------------------------------------------
  describe('authentification', () => {
    it('refuse une requête sans jeton', async () => {
      await api().get('/v1/sync').expect(401);
      await api().post('/v1/sync').send({ entries: [], days: [] }).expect(401);
      await api().get('/v1/summary/week').query({ date: '2026-09-07' }).expect(401);
    });

    it('refuse un jeton révoqué', async () => {
      await api()
        .get('/v1/sync')
        .set({ Authorization: `Bearer ${jetonRevoque}` })
        .expect(401);
    });

    it('refuse un jeton passé en paramètre d’URL', async () => {
      // Un jeton dans l'URL finirait dans les journaux du serveur et du proxy.
      await api().get('/v1/sync').query({ token: alice.token }).expect(401);
    });

    it('refuse un schéma d’autorisation détourné', async () => {
      for (const entete of [
        `Basic ${alice.token}`,
        `Bearer`,
        `Bearer ${alice.token} extra`,
        `bearer  ${alice.token}\nX-Injected: 1`,
      ]) {
        await api().get('/v1/sync').set({ Authorization: entete }).expect(401);
      }
    });

    it('ne divulgue rien sur l’existence d’un jeton', async () => {
      const inconnu = await api().get('/v1/sync').set({ Authorization: 'Bearer inexistant' });
      expect(inconnu.status).toBe(401);
      expect(JSON.stringify(inconnu.body)).not.toMatch(/hash|token|sql|prisma/i);
    });
  });

  // -------------------------------------------------------------------------
  describe('cloisonnement des comptes', () => {
    it('ne laisse jamais voir les données d’un autre compte', async () => {
      await api()
        .post('/v1/sync')
        .set(auth(alice))
        .send({
          entries: [
            {
              id: uuid(900),
              date: '2026-09-07',
              type: 'CLOCK_IN',
              at: Date.UTC(2026, 8, 7, 6),
              manual: false,
              updatedAt: 1,
            },
          ],
          days: [],
        })
        .expect(201);

      const chezBob = await api().get('/v1/sync').set(auth(bob)).expect(200);
      expect(chezBob.body.entries).toHaveLength(0);

      const chezAlice = await api().get('/v1/sync').set(auth(alice)).expect(200);
      expect(chezAlice.body.entries).toHaveLength(1);
    });

    it('ne permet pas d’écrire sur le compte d’un autre en devinant un identifiant', async () => {
      // Le lot ne porte aucun identifiant d'utilisateur : il est déduit du
      // jeton. Envoyer une ligne déjà connue d'Alice crée une ligne chez Bob,
      // elle ne modifie pas celle d'Alice.
      await api()
        .post('/v1/sync')
        .set(auth(bob))
        .send({
          entries: [
            {
              id: uuid(900),
              date: '2026-09-07',
              type: 'CLOCK_OUT',
              at: Date.UTC(2026, 8, 7, 20),
              manual: false,
              updatedAt: 9_999_999,
            },
          ],
          days: [],
        })
        .expect(201);

      const chezAlice = await api().get('/v1/sync').set(auth(alice)).expect(200);
      expect(chezAlice.body.entries[0].type).toBe('CLOCK_IN');
    });
  });

  // -------------------------------------------------------------------------
  describe('injection', () => {
    const CHARGES_SQL = [
      "'; DROP TABLE time_entries; --",
      "' OR '1'='1",
      "1; DELETE FROM users WHERE 't'='t",
      "\\'; SELECT pg_sleep(5); --",
    ];

    it('refuse une charge SQL là où une date est attendue', async () => {
      for (const charge of CHARGES_SQL) {
        await api()
          .post('/v1/sync')
          .set(auth(alice))
          .send({
            entries: [
              {
                id: uuid(901),
                date: charge,
                type: 'CLOCK_IN',
                at: 0,
                manual: false,
                updatedAt: 1,
              },
            ],
            days: [],
          })
          .expect(400);
      }
    });

    it('stocke une charge SQL dans une note sans jamais l’exécuter', async () => {
      const note = "'; DROP TABLE work_days; --";
      await api()
        .post('/v1/sync')
        .set(auth(alice))
        .send({
          entries: [],
          days: [{ id: '2026-09-08', status: 'LEAVE', notes: note, updatedAt: 2 }],
        })
        .expect(201);

      const relu = await api().get('/v1/sync').set(auth(alice)).expect(200);
      expect(relu.body.days.find((d: { id: string }) => d.id === '2026-09-08').notes).toBe(note);

      // La table existe toujours : la requête a été paramétrée, pas concaténée.
      await expect(prisma.workDay.count()).resolves.toBeGreaterThan(0);
    });

    it('refuse un opérateur de requête déguisé en valeur', async () => {
      await api()
        .post('/v1/sync')
        .set(auth(alice))
        .send({ entries: [], days: [{ id: { gt: '' }, status: 'LEAVE', updatedAt: 1 }] })
        .expect(400);
    });

    it('refuse un statut hors de la liste connue', async () => {
      await api()
        .post('/v1/sync')
        .set(auth(alice))
        .send({ entries: [], days: [{ id: '2026-09-09', status: 'ADMIN', updatedAt: 1 }] })
        .expect(400);
    });

    it('refuse une traversée de chemin dans le paramètre de date', async () => {
      await api()
        .get('/v1/summary/week')
        .query({ date: '../../etc/passwd' })
        .set(auth(alice))
        .expect(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('pollution de prototype', () => {
    it('n’applique pas __proto__ envoyé dans les réglages', async () => {
      await api()
        .post('/v1/sync')
        .set(auth(alice))
        .set('Content-Type', 'application/json')
        .send(
          '{"entries":[],"days":[],"settings":{"payload":{"__proto__":{"pirate":true}},"updatedAt":5}}',
        )
        .expect(201);

      expect(({} as Record<string, unknown>).pirate).toBeUndefined();

      const relu = await api().get('/v1/sync').set(auth(alice)).expect(200);
      expect(Object.keys(relu.body.settings.payload)).not.toContain('__proto__');
    });

    it('refuse des réglages démesurés', async () => {
      const payload: Record<string, number> = {};
      for (let i = 0; i < 600; i++) payload[`k${i}`] = i;
      await api()
        .post('/v1/sync')
        .set(auth(alice))
        .send({ entries: [], days: [], settings: { payload, updatedAt: 6 } })
        .expect(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('abus de volume', () => {
    it('refuse un lot au-delà de la borne', async () => {
      const entries = Array.from({ length: 5001 }, (_, i) => ({
        id: uuid(100000 + i),
        date: '2026-09-07',
        type: 'CLOCK_IN',
        at: 0,
        manual: false,
        updatedAt: 1,
      }));
      const reponse = await api().post('/v1/sync').set(auth(alice)).send({ entries, days: [] });
      expect([400, 413]).toContain(reponse.status);
    });

    it('refuse une note démesurée', async () => {
      await api()
        .post('/v1/sync')
        .set(auth(alice))
        .send({
          entries: [],
          days: [{ id: '2026-09-10', status: 'LEAVE', notes: 'x'.repeat(5000), updatedAt: 1 }],
        })
        .expect(400);
    });

    it('refuse un champ inconnu au lieu de l’ignorer', async () => {
      await api()
        .post('/v1/sync')
        .set(auth(alice))
        .send({ entries: [], days: [], isAdmin: true })
        .expect(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('fuites', () => {
    it('ne renvoie ni trace de pile ni détail interne sur erreur', async () => {
      const reponse = await api()
        .post('/v1/sync')
        .set(auth(alice))
        .send({ entries: 'pas un tableau', days: [] })
        .expect(400);

      const corps = JSON.stringify(reponse.body);
      expect(corps).not.toMatch(/at .+\.ts:\d+|node_modules|PrismaClient/);
      expect(reponse.body).toHaveProperty('timestamp');
    });

    it('n’annonce pas la technologie du serveur', async () => {
      const reponse = await api().get('/health').expect(200);
      expect(reponse.headers['x-powered-by']).toBeUndefined();
    });

    it('pose les en-têtes de sécurité usuels', async () => {
      const reponse = await api().get('/health').expect(200);
      expect(reponse.headers['x-content-type-options']).toBe('nosniff');
      expect(reponse.headers['x-frame-options']).toBeDefined();
    });
  });
});
