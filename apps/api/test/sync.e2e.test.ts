import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { generateDeviceToken, hashToken } from '../src/auth/auth.service';

/**
 * Tests de bout en bout : vraie application NestJS, vraie base PostgreSQL.
 *
 * Ils ne servent pas à re-tester les règles de fusion — c'est le rôle des tests
 * unitaires — mais à vérifier ce que seuls eux peuvent voir : le câblage
 * NestJS, la validation des entrées, l'authentification et le schéma Prisma.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb('API de synchronisation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    // La même configuration qu'en production : les protections testées ici
    // sont exactement celles qui tourneront.
    app = configureApp(moduleRef.createNestApplication());
    await app.init();

    const user = await prisma.user.create({
      data: { email: `e2e-${Date.now()}@workpulse.test`, displayName: 'E2E' },
    });
    userId = user.id;
    token = generateDeviceToken();
    await prisma.device.create({
      data: { userId, name: 'Appareil de test', tokenHash: hashToken(token) },
    });
  });

  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await prisma.$disconnect();
    await app?.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

  it('répond à la sonde de vie sans authentification', async () => {
    await request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' });
  });

  it('refuse un accès sans jeton', async () => {
    await request(app.getHttpServer()).get('/v1/sync').expect(401);
  });

  it('refuse un jeton inconnu', async () => {
    await request(app.getHttpServer())
      .get('/v1/sync')
      .set({ Authorization: 'Bearer inexistant' })
      .expect(401);
  });

  it('rejette un lot mal formé plutôt que de l’avaler', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/sync')
      .set(auth())
      .send({ entries: [{ id: 'pas-un-uuid', date: '07/09/2026' }], days: [] })
      .expect(400);
    expect(response.body.message).toMatch(/id|date/i);
  });

  it('rejette un champ inconnu', async () => {
    await request(app.getHttpServer())
      .post('/v1/sync')
      .set(auth())
      .send({ entries: [], days: [], colonneInventee: 1 })
      .expect(400);
  });

  it('accepte un lot, le persiste, puis le restitue', async () => {
    const at = Date.UTC(2026, 8, 7, 6, 0, 0);
    const payload = {
      since: null,
      entries: [
        {
          id: uuid(1),
          date: '2026-09-07',
          type: 'CLOCK_IN',
          at,
          manual: false,
          updatedAt: at,
        },
      ],
      days: [{ id: '2026-09-11', status: 'LEAVE', updatedAt: at }],
      settings: { payload: { dailyMinutes: 420 }, updatedAt: at },
    };

    const pushed = await request(app.getHttpServer())
      .post('/v1/sync')
      .set(auth())
      .send(payload)
      .expect(201);

    expect(pushed.body.conflicts).toBe(0);
    expect(pushed.body.cursor).toBe(at);

    const pulled = await request(app.getHttpServer()).get('/v1/sync').set(auth()).expect(200);
    expect(pulled.body.entries).toHaveLength(1);
    expect(pulled.body.days[0].id).toBe('2026-09-11');
    expect(pulled.body.settings.payload).toEqual({ dailyMinutes: 420 });
  });

  it('est idempotent : le même lot rejoué ne crée pas de doublon', async () => {
    const at = Date.UTC(2026, 8, 7, 6, 0, 0);
    const payload = {
      entries: [
        { id: uuid(1), date: '2026-09-07', type: 'CLOCK_IN', at, manual: false, updatedAt: at },
      ],
      days: [],
    };
    await request(app.getHttpServer()).post('/v1/sync').set(auth()).send(payload).expect(201);
    const count = await prisma.timeEntry.count({ where: { userId } });
    expect(count).toBe(1);
  });

  it('ne renvoie que ce qui a changé depuis le curseur', async () => {
    const at = Date.UTC(2026, 8, 7, 6, 0, 0);
    const pulled = await request(app.getHttpServer())
      .get('/v1/sync')
      .query({ since: at })
      .set(auth())
      .expect(200);
    expect(pulled.body.entries).toHaveLength(0);
  });

  it('recalcule le solde hebdomadaire côté serveur', async () => {
    const day = '2026-09-08';
    const base = Date.UTC(2026, 8, 8, 6, 0, 0);
    await request(app.getHttpServer())
      .post('/v1/sync')
      .set(auth())
      .send({
        entries: [
          { id: uuid(10), date: day, type: 'CLOCK_IN', at: base, manual: false, updatedAt: base },
          {
            id: uuid(11),
            date: day,
            type: 'CLOCK_OUT',
            at: base + 7 * 3_600_000,
            manual: false,
            updatedAt: base,
          },
        ],
        days: [],
      })
      .expect(201);

    const summary = await request(app.getHttpServer())
      .get('/v1/summary/week')
      .query({ date: day })
      .set(auth())
      .expect(200);

    expect(summary.body.week).toBe('2026-W37');
    expect(summary.body.workedMinutes).toBe(420);
    expect(summary.body.days).toHaveLength(7);
  });
});
