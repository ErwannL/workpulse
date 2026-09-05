import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncService } from './sync.service';
import { dayDtoToRow, entryDtoToRow, type DayRow, type EntryRow } from './sync.mapper';
import type { StoredSettings, SyncPort } from './sync.port';
import type { SyncPushDto, TimeEntryDto, WorkDayDto } from './sync.dto';

const T = 1_770_000_000_000;
const USER = 'u1';

function entry(id: string, updatedAt: number, deletedAt: number | null = null): TimeEntryDto {
  return {
    id,
    date: '2026-09-07',
    type: 'CLOCK_IN',
    at: T,
    manual: false,
    editedAt: null,
    originalAt: null,
    updatedAt,
    deletedAt,
  };
}

function day(id: string, updatedAt: number): WorkDayDto {
  return {
    id,
    status: 'LEAVE',
    worksOnHoliday: false,
    plannedOverride: null,
    notes: null,
    updatedAt,
    deletedAt: null,
  };
}

/** Port en mémoire : le service se teste intégralement sans base. */
class MemoryPort implements SyncPort {
  entries: EntryRow[] = [];
  days: DayRow[] = [];
  settings: StoredSettings | null = null;
  persisted = vi.fn();

  loadEntries(): Promise<EntryRow[]> {
    return Promise.resolve(this.entries);
  }
  loadDays(): Promise<DayRow[]> {
    return Promise.resolve(this.days);
  }
  loadSettings(): Promise<StoredSettings | null> {
    return Promise.resolve(this.settings);
  }
  persist(input: Parameters<SyncPort['persist']>[0]): Promise<void> {
    this.persisted(input);
    for (const row of input.entries) {
      this.entries = [...this.entries.filter((e) => e.id !== row.id), row];
    }
    for (const row of input.days) {
      this.days = [...this.days.filter((d) => d.date !== row.date), row];
    }
    if (input.settings !== null) this.settings = input.settings;
    return Promise.resolve();
  }
}

const push = (partial: Partial<SyncPushDto> = {}): SyncPushDto => ({
  since: null,
  entries: [],
  days: [],
  settings: null,
  ...partial,
});

let port: MemoryPort;
let service: SyncService;

beforeEach(() => {
  port = new MemoryPort();
  service = new SyncService(port);
});

describe('pull', () => {
  it('renvoie tout quand le client part de zéro', async () => {
    port.entries = [entryDtoToRow(entry('a', T))];
    port.days = [dayDtoToRow(day('2026-09-07', T))];
    port.settings = { payload: { dailyMinutes: 420 }, updatedAt: new Date(T) };

    const result = await service.pull(USER, null);
    expect(result.entries).toHaveLength(1);
    expect(result.days).toHaveLength(1);
    expect(result.settings?.payload).toEqual({ dailyMinutes: 420 });
    expect(result.cursor).toBe(T);
  });

  it('ne renvoie que ce qui a changé après le curseur', async () => {
    port.entries = [entryDtoToRow(entry('vieux', T)), entryDtoToRow(entry('neuf', T + 1000))];
    const result = await service.pull(USER, T);
    expect(result.entries.map((e) => e.id)).toEqual(['neuf']);
    expect(result.cursor).toBe(T + 1000);
  });

  it('tait des réglages que le client possède déjà', async () => {
    port.settings = { payload: {}, updatedAt: new Date(T) };
    expect((await service.pull(USER, T)).settings).toBeNull();
    expect((await service.pull(USER, T - 1)).settings).not.toBeNull();
  });

  it('ne fait jamais reculer le curseur', async () => {
    const result = await service.pull(USER, T);
    expect(result.cursor).toBe(T);
  });

  it('renvoie un résultat vide sur un compte neuf', async () => {
    const result = await service.pull(USER, null);
    expect(result).toEqual({ entries: [], days: [], settings: null, cursor: 0, conflicts: 0 });
  });
});

describe('push', () => {
  it('enregistre des lignes inédites', async () => {
    const result = await service.push(USER, push({ entries: [entry('a', T)] }));
    expect(port.entries).toHaveLength(1);
    expect(result.conflicts).toBe(0);
  });

  it('est idempotent : rejouer le même lot n’écrit rien', async () => {
    await service.push(USER, push({ entries: [entry('a', T)] }));
    port.persisted.mockClear();
    await service.push(USER, push({ entries: [entry('a', T)] }));
    expect(port.persisted).toHaveBeenCalledWith(expect.objectContaining({ entries: [] }));
  });

  it('n’ouvre pas de transaction pour un lot vide', async () => {
    await service.push(USER, push());
    expect(port.persisted).toHaveBeenCalledWith(
      expect.objectContaining({ entries: [], days: [], settings: null }),
    );
  });

  it('garde la version serveur quand elle est plus récente et compte le conflit', async () => {
    port.entries = [entryDtoToRow(entry('a', T + 5000))];
    const result = await service.push(USER, push({ entries: [entry('a', T)] }));
    expect(result.conflicts).toBe(1);
    expect(port.entries[0].updatedAt.getTime()).toBe(T + 5000);
  });

  it('propage une suppression plus récente', async () => {
    port.entries = [entryDtoToRow(entry('a', T))];
    await service.push(USER, push({ entries: [entry('a', T + 10, T + 10)] }));
    expect(port.entries[0].deletedAt?.getTime()).toBe(T + 10);
  });

  it('accepte les journées avec la date pour identifiant', async () => {
    await service.push(USER, push({ days: [day('2026-09-07', T)] }));
    expect(port.days[0].date).toBe('2026-09-07');
  });

  it('accepte des réglages plus récents', async () => {
    port.settings = { payload: { a: 1 }, updatedAt: new Date(T) };
    const result = await service.push(
      USER,
      push({ settings: { payload: { a: 2 }, updatedAt: T + 1 } }),
    );
    expect(port.settings.payload).toEqual({ a: 2 });
    expect(result.conflicts).toBe(0);
  });

  it('refuse des réglages plus anciens et le signale', async () => {
    port.settings = { payload: { a: 1 }, updatedAt: new Date(T + 100) };
    const result = await service.push(
      USER,
      push({ settings: { payload: { a: 2 }, updatedAt: T } }),
    );
    expect(port.settings.payload).toEqual({ a: 1 });
    expect(result.conflicts).toBe(1);
  });

  it('conserve les réglages du serveur quand le client n’en envoie pas', async () => {
    port.settings = { payload: { a: 1 }, updatedAt: new Date(T) };
    const result = await service.push(USER, push({ since: null }));
    expect(result.settings?.payload).toEqual({ a: 1 });
  });

  it('renvoie au client les lignes qu’il ne connaît pas', async () => {
    port.entries = [entryDtoToRow(entry('serveur', T + 10))];
    const result = await service.push(USER, push({ since: T, entries: [entry('client', T + 20)] }));
    expect(result.entries.map((e) => e.id).sort()).toEqual(['client', 'serveur']);
    expect(result.cursor).toBe(T + 20);
  });

  it('additionne les conflits des trois familles de données', async () => {
    port.entries = [entryDtoToRow(entry('a', T + 100))];
    port.days = [dayDtoToRow(day('2026-09-07', T + 100))];
    port.settings = { payload: {}, updatedAt: new Date(T + 100) };
    const result = await service.push(
      USER,
      push({
        entries: [entry('a', T)],
        days: [day('2026-09-07', T)],
        settings: { payload: {}, updatedAt: T },
      }),
    );
    expect(result.conflicts).toBe(3);
  });
});

describe('réglages hostiles', () => {
  it('refuse de propager une pollution de prototype', async () => {
    const hostile = JSON.parse('{"dailyMinutes":420,"__proto__":{"pollue":true}}');
    await service.push(USER, push({ settings: { payload: hostile, updatedAt: T } }));

    expect(port.settings?.payload).toEqual({ dailyMinutes: 420 });
    expect(({} as Record<string, unknown>).pollue).toBeUndefined();
  });

  it('rejette un objet de réglages démesuré', async () => {
    const large: Record<string, number> = {};
    for (let i = 0; i < 600; i++) large[`k${i}`] = i;
    await expect(
      service.push(USER, push({ settings: { payload: large, updatedAt: T } })),
    ).rejects.toThrow(/volumineux/);
  });

  it('rejette un objet de réglages trop imbriqué', async () => {
    let profond: unknown = { fin: true };
    for (let i = 0; i < 20; i++) profond = { suivant: profond };
    await expect(
      service.push(USER, push({ settings: { payload: profond as never, updatedAt: T } })),
    ).rejects.toThrow(/profond/);
  });

  it('accepte des réglages vides', async () => {
    await service.push(USER, push({ settings: { payload: {}, updatedAt: T } }));
    expect(port.settings?.payload).toEqual({});
  });

  it('ne partage aucune référence avec le lot reçu', async () => {
    const payload = { imbrique: { valeur: 1 } };
    await service.push(USER, push({ settings: { payload, updatedAt: T } }));
    payload.imbrique.valeur = 99;
    expect((port.settings?.payload as typeof payload).imbrique.valeur).toBe(1);
  });
});
