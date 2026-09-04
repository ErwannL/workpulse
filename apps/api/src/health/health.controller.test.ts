import { describe, expect, it, vi } from 'vitest';
import { HealthController, version } from './health.controller';
import type { PrismaService } from '../prisma/prisma.service';

const controller = new HealthController({} as PrismaService);

describe('HealthController', () => {
  it('répond toujours à la sonde de vie', () => {
    expect(controller.live()).toEqual({ status: 'ok' });
  });

  it('signale une base disponible', async () => {
    const db = { $queryRawUnsafe: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const result = await controller.ready(db);
    expect(result.status).toBe('ok');
    expect(result.checks.database).toBe('up');
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('se déclare dégradé quand la base ne répond pas', async () => {
    const db = { $queryRawUnsafe: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) };
    const result = await controller.ready(db);
    expect(result.status).toBe('degraded');
    expect(result.checks.database).toBe('down');
  });
});

describe('version exposée', () => {
  it('reprend la version du paquet', () => {
    expect(version({ npm_package_version: '1.2.3' })).toBe('1.2.3');
  });

  it('retombe sur 0.0.0 hors contexte npm', () => {
    expect(version({})).toBe('0.0.0');
  });
});
