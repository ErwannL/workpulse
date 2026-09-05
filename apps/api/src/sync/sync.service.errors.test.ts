import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncService } from './sync.service';
import type { StoredSettings, SyncPort } from './sync.port';
import type { DayRow, EntryRow } from './sync.mapper';

// Une panne interne de l'assainissement ne doit pas être maquillée en erreur
// de saisie : le client n'y peut rien, et un 400 masquerait le vrai problème.
vi.mock('@workpulse/core', async (original) => {
  const vrai = await original<typeof import('@workpulse/core')>();
  return {
    ...vrai,
    sanitizeJson: () => {
      throw new TypeError('panne interne');
    },
  };
});

class MemoryPort implements SyncPort {
  loadEntries = (): Promise<EntryRow[]> => Promise.resolve([]);
  loadDays = (): Promise<DayRow[]> => Promise.resolve([]);
  loadSettings = (): Promise<StoredSettings | null> => Promise.resolve(null);
  persist = (): Promise<void> => Promise.resolve();
}

let service: SyncService;

beforeEach(() => {
  service = new SyncService(new MemoryPort());
});

describe('erreur inattendue pendant l’assainissement', () => {
  it('remonte telle quelle au lieu d’être traduite en 400', async () => {
    await expect(
      service.push('u1', {
        since: null,
        entries: [],
        days: [],
        settings: { payload: { a: 1 }, updatedAt: 0 },
      }),
    ).rejects.toBeInstanceOf(TypeError);
  });
});
