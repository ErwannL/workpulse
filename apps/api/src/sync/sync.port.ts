import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { DayRow, EntryRow } from './sync.mapper';

export interface StoredSettings {
  payload: Record<string, unknown>;
  updatedAt: Date;
}

/**
 * Frontière de persistance de la synchronisation.
 *
 * Le service de synchronisation ne connaît que ce contrat : il se teste donc
 * sans base, et l'implémentation Prisma peut changer (partitionnement,
 * pagination, autre moteur) sans toucher à la logique de fusion.
 */
export interface SyncPort {
  loadEntries(userId: string): Promise<EntryRow[]>;
  loadDays(userId: string): Promise<DayRow[]>;
  loadSettings(userId: string): Promise<StoredSettings | null>;
  persist(input: {
    userId: string;
    entries: EntryRow[];
    days: DayRow[];
    settings: StoredSettings | null;
  }): Promise<void>;
}

/** Forme minimale de Prisma utilisée ici — le reste du client ne nous regarde pas. */
export interface PrismaLike {
  timeEntry: {
    findMany(args: unknown): Promise<EntryRow[]>;
    upsert(args: unknown): Promise<unknown>;
  };
  workDay: {
    findMany(args: unknown): Promise<DayRow[]>;
    upsert(args: unknown): Promise<unknown>;
  };
  userSettings: {
    findUnique(args: unknown): Promise<StoredSettings | null>;
    upsert(args: unknown): Promise<unknown>;
  };
  $transaction<T>(work: (tx: PrismaLike) => Promise<T>): Promise<T>;
}

const ENTRY_FIELDS = {
  id: true,
  date: true,
  type: true,
  at: true,
  manual: true,
  editedAt: true,
  originalAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

const DAY_FIELDS = {
  date: true,
  status: true,
  worksOnHoliday: true,
  plannedOverride: true,
  notes: true,
  updatedAt: true,
  deletedAt: true,
} as const;

@Injectable()
export class PrismaSyncPort implements SyncPort {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): PrismaLike {
    return this.prisma as unknown as PrismaLike;
  }

  loadEntries(userId: string): Promise<EntryRow[]> {
    return this.db.timeEntry.findMany({ where: { userId }, select: ENTRY_FIELDS });
  }

  loadDays(userId: string): Promise<DayRow[]> {
    return this.db.workDay.findMany({ where: { userId }, select: DAY_FIELDS });
  }

  loadSettings(userId: string): Promise<StoredSettings | null> {
    return this.db.userSettings.findUnique({
      where: { userId },
      select: { payload: true, updatedAt: true },
    });
  }

  /**
   * Une seule transaction pour tout le lot : une synchronisation interrompue
   * ne doit jamais laisser des pointages sans les journées qui vont avec.
   */
  async persist(input: {
    userId: string;
    entries: EntryRow[];
    days: DayRow[];
    settings: StoredSettings | null;
  }): Promise<void> {
    const { userId, entries, days, settings } = input;
    if (entries.length === 0 && days.length === 0 && settings === null) return;

    await this.db.$transaction(async (tx) => {
      for (const entry of entries) {
        await tx.timeEntry.upsert({
          where: { id: entry.id },
          create: { ...entry, userId },
          update: entry,
        });
      }
      for (const day of days) {
        await tx.workDay.upsert({
          where: { userId_date: { userId, date: day.date } },
          create: { ...day, userId },
          update: day,
        });
      }
      if (settings !== null) {
        await tx.userSettings.upsert({
          where: { userId },
          create: { userId, ...settings },
          update: settings,
        });
      }
    });
  }
}
