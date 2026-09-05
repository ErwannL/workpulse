import { describe, expect, it, vi } from 'vitest';
import { PrismaSyncPort, type PrismaLike } from './sync.port';
import type { PrismaService } from '../prisma/prisma.service';
import type { DayRow, EntryRow } from './sync.mapper';

const T = new Date(1_770_000_000_000);

const entryRow: EntryRow = {
  id: '00000000-0000-4000-8000-000000000001',
  date: '2026-09-07',
  type: 'CLOCK_IN',
  at: T,
  manual: false,
  editedAt: null,
  originalAt: null,
  updatedAt: T,
  deletedAt: null,
};

const dayRow: DayRow = {
  date: '2026-09-11',
  status: 'LEAVE',
  worksOnHoliday: false,
  plannedOverride: null,
  notes: null,
  updatedAt: T,
  deletedAt: null,
};

function fakePrisma() {
  const db: PrismaLike = {
    timeEntry: {
      findMany: vi.fn().mockResolvedValue([entryRow]),
      upsert: vi.fn().mockResolvedValue(undefined),
    },
    workDay: {
      findMany: vi.fn().mockResolvedValue([dayRow]),
      upsert: vi.fn().mockResolvedValue(undefined),
    },
    userSettings: {
      findUnique: vi.fn().mockResolvedValue({ payload: { a: 1 }, updatedAt: T }),
      upsert: vi.fn().mockResolvedValue(undefined),
    },
    $transaction: vi.fn(<T>(work: (tx: PrismaLike) => Promise<T>) =>
      work(db),
    ) as PrismaLike['$transaction'],
  };
  return { db, port: new PrismaSyncPort(db as unknown as PrismaService) };
}

describe('PrismaSyncPort — lecture', () => {
  it('ne lit que les lignes de l’utilisateur demandé', async () => {
    const { db, port } = fakePrisma();
    await expect(port.loadEntries('u1')).resolves.toEqual([entryRow]);
    expect(db.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
  });

  it('lit les journées annotées', async () => {
    const { db, port } = fakePrisma();
    await expect(port.loadDays('u1')).resolves.toEqual([dayRow]);
    expect(db.workDay.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
  });

  it('lit les réglages', async () => {
    const { db, port } = fakePrisma();
    await expect(port.loadSettings('u1')).resolves.toEqual({ payload: { a: 1 }, updatedAt: T });
    expect(db.userSettings.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
  });
});

describe('PrismaSyncPort — écriture', () => {
  it('n’ouvre aucune transaction pour un lot vide', async () => {
    const { db, port } = fakePrisma();
    await port.persist({ userId: 'u1', entries: [], days: [], settings: null });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('écrit tout le lot dans une seule transaction', async () => {
    const { db, port } = fakePrisma();
    await port.persist({
      userId: 'u1',
      entries: [entryRow],
      days: [dayRow],
      settings: { payload: { a: 2 }, updatedAt: T },
    });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.timeEntry.upsert).toHaveBeenCalledWith({
      where: { userId_id: { userId: 'u1', id: entryRow.id } },
      create: { ...entryRow, userId: 'u1' },
      update: entryRow,
    });
    expect(db.workDay.upsert).toHaveBeenCalledWith({
      where: { userId_date: { userId: 'u1', date: dayRow.date } },
      create: { ...dayRow, userId: 'u1' },
      update: dayRow,
    });
    expect(db.userSettings.upsert).toHaveBeenCalledTimes(1);
  });

  it('n’écrit pas les réglages quand le client n’en propose pas', async () => {
    const { db, port } = fakePrisma();
    await port.persist({ userId: 'u1', entries: [entryRow], days: [], settings: null });
    expect(db.userSettings.upsert).not.toHaveBeenCalled();
  });

  it('identifie un pointage par le couple utilisateur et identifiant', async () => {
    const { db, port } = fakePrisma();
    await port.persist({ userId: 'u1', entries: [entryRow], days: [], settings: null });
    const call = vi.mocked(db.timeEntry.upsert).mock.calls[0][0] as {
      where: { userId_id: { userId: string; id: string } };
    };
    // Un identifiant produit par un client n'est unique que pour ce client.
    expect(call.where.userId_id).toEqual({ userId: 'u1', id: entryRow.id });
  });

  it('identifie une journée par le couple utilisateur et date', async () => {
    const { db, port } = fakePrisma();
    await port.persist({ userId: 'u1', entries: [], days: [dayRow], settings: null });
    const call = vi.mocked(db.workDay.upsert).mock.calls[0][0] as {
      where: { userId_date: { userId: string; date: string } };
    };
    expect(call.where.userId_date).toEqual({ userId: 'u1', date: '2026-09-11' });
  });
});
