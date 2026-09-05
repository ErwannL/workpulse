import { describe, expect, it, vi } from 'vitest';
import { SummaryController } from './summary.controller';
import type { SummaryService } from './summary.service';
import type { RequestWithDevice } from '../auth/device.guard';

describe('SummaryController', () => {
  it('demande le résumé de la semaine de l’utilisateur authentifié', async () => {
    const service = {
      week: vi.fn().mockResolvedValue({ week: '2026-W37' }),
    } as unknown as SummaryService;
    const request = { headers: {}, device: { deviceId: 'd1', userId: 'u1' } } as RequestWithDevice;
    const result = await new SummaryController(service).week(request, { date: '2026-09-07' });
    expect(service.week).toHaveBeenCalledWith('u1', '2026-09-07');
    expect(result).toEqual({ week: '2026-W37' });
  });
});
