import { describe, expect, it, vi } from 'vitest';
import {
  AuthService,
  bearerToken,
  generateDeviceToken,
  hashToken,
  tokensMatch,
  type DeviceLookup,
} from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';

function fakeDb(
  device: { id: string; userId: string; revokedAt: Date | null } | null,
): DeviceLookup {
  return {
    device: {
      findUnique: vi.fn().mockResolvedValue(device),
      update: vi.fn().mockResolvedValue(undefined),
    },
  };
}

const service = new AuthService({} as PrismaService);

describe('jetons d’appareil', () => {
  it('produit un jeton à haute entropie, différent à chaque appel', () => {
    const a = generateDeviceToken();
    const b = generateDeviceToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
  });

  it('hache de façon stable et non réversible', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe('abc');
    expect(hashToken('abc')).toHaveLength(64);
  });

  it('compare deux empreintes sans fuite de temps', () => {
    expect(tokensMatch(hashToken('a'), hashToken('a'))).toBe(true);
    expect(tokensMatch(hashToken('a'), hashToken('b'))).toBe(false);
    expect(tokensMatch('court', 'beaucoup plus long')).toBe(false);
  });

  it('extrait le jeton porteur de l’en-tête', () => {
    expect(bearerToken('Bearer xyz')).toBe('xyz');
    expect(bearerToken('  bearer   xyz  ')).toBe('xyz');
    expect(bearerToken('Basic xyz')).toBeNull();
    expect(bearerToken('Bearer')).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });
});

describe('AuthService.resolve', () => {
  it('résout un appareil actif et note son passage', async () => {
    const db = fakeDb({ id: 'd1', userId: 'u1', revokedAt: null });
    await expect(service.resolve('tok', db)).resolves.toEqual({ deviceId: 'd1', userId: 'u1' });
    expect(db.device.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { lastSeenAt: expect.any(Date) },
    });
  });

  it('refuse un jeton inconnu', async () => {
    await expect(service.resolve('tok', fakeDb(null))).resolves.toBeNull();
  });

  it('refuse un appareil révoqué', async () => {
    const db = fakeDb({ id: 'd1', userId: 'u1', revokedAt: new Date() });
    await expect(service.resolve('tok', db)).resolves.toBeNull();
    expect(db.device.update).not.toHaveBeenCalled();
  });
});
