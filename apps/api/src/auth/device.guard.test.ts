import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { DeviceGuard, type RequestWithDevice } from './device.guard';
import type { AuthService } from './auth.service';

function contextFor(request: RequestWithDevice): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const authWith = (result: unknown) =>
  ({ resolve: vi.fn().mockResolvedValue(result) }) as unknown as AuthService;

describe('DeviceGuard', () => {
  it('laisse passer un jeton valide et attache l’appareil à la requête', async () => {
    const request: RequestWithDevice = { headers: { authorization: 'Bearer tok' } };
    const guard = new DeviceGuard(authWith({ deviceId: 'd1', userId: 'u1' }));
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.device).toEqual({ deviceId: 'd1', userId: 'u1' });
  });

  it('refuse une requête sans en-tête', async () => {
    const guard = new DeviceGuard(authWith(null));
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refuse un en-tête mal formé', async () => {
    const guard = new DeviceGuard(authWith(null));
    const ctx = contextFor({ headers: { authorization: ['Bearer a', 'Bearer b'] } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/absent/);
  });

  it('refuse un jeton inconnu', async () => {
    const guard = new DeviceGuard(authWith(null));
    const ctx = contextFor({ headers: { authorization: 'Bearer tok' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/invalide/);
  });
});
