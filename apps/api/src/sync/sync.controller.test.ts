import { describe, expect, it, vi } from 'vitest';
import { SyncController } from './sync.controller';
import type { SyncService } from './sync.service';
import type { RequestWithDevice } from '../auth/device.guard';

const request = { headers: {}, device: { deviceId: 'd1', userId: 'u1' } } as RequestWithDevice;
const empty = { entries: [], days: [], settings: null, cursor: 0, conflicts: 0 };

describe('SyncController', () => {
  it('transmet le curseur au service lors d’une lecture', async () => {
    const service = { pull: vi.fn().mockResolvedValue(empty) } as unknown as SyncService;
    await new SyncController(service).pull(request, { since: 42 });
    expect(service.pull).toHaveBeenCalledWith('u1', 42);
  });

  it('traduit l’absence de curseur en null', async () => {
    const service = { pull: vi.fn().mockResolvedValue(empty) } as unknown as SyncService;
    await new SyncController(service).pull(request, {});
    expect(service.pull).toHaveBeenCalledWith('u1', null);
  });

  it('transmet le lot au service lors d’un envoi', async () => {
    const service = { push: vi.fn().mockResolvedValue(empty) } as unknown as SyncService;
    const body = { since: null, entries: [], days: [], settings: null };
    await expect(new SyncController(service).push(request, body)).resolves.toEqual(empty);
    expect(service.push).toHaveBeenCalledWith('u1', body);
  });
});
