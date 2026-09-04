import { Injectable } from '@nestjs/common';
import {
  carryInFor,
  mergeSettings,
  summarizeWeek,
  type DateISO,
  type LedgerSource,
  type Settings,
  type TimeEntry,
  type WorkDay,
} from '@workpulse/core';
import type { SyncPort } from '../sync/sync.port';
import { dayRowToDto, entryRowToDto } from '../sync/sync.mapper';

export interface WeekSummaryResponse {
  week: string;
  monday: DateISO;
  sunday: DateISO;
  plannedMinutes: number;
  workedMinutes: number;
  differenceMinutes: number;
  carryInMinutes: number;
  carryOutMinutes: number;
  overtimeMinutes: number;
  overtimeCapMinutes: number;
  overtimeExceeded: boolean;
  days: {
    date: DateISO;
    status: string;
    plannedMinutes: number;
    workedMinutes: number;
    balanceMinutes: number;
  }[];
}

/**
 * Le serveur recalcule le solde avec exactement le même code que le téléphone :
 * `@workpulse/core` est importé ici tel quel. Une divergence entre les deux
 * chiffres est donc impossible par construction — c'est la raison d'être du
 * paquet partagé.
 */
@Injectable()
export class SummaryService {
  constructor(private readonly port: SyncPort) {}

  async week(
    userId: string,
    date: DateISO,
    now: number = Date.now(),
  ): Promise<WeekSummaryResponse> {
    const source = await this.buildSource(userId, now);
    const summary = summarizeWeek(source, date, carryInFor(source, date));

    return {
      week: summary.key,
      monday: summary.monday,
      sunday: summary.sunday,
      plannedMinutes: Math.round(summary.planned),
      workedMinutes: Math.round(summary.worked),
      differenceMinutes: Math.round(summary.difference),
      carryInMinutes: Math.round(summary.carryIn),
      carryOutMinutes: Math.round(summary.carryOut),
      overtimeMinutes: Math.round(summary.overtime),
      overtimeCapMinutes: summary.overtimeCap,
      overtimeExceeded: summary.overtimeExceeded,
      days: summary.days.map((d) => ({
        date: d.date,
        status: d.status,
        plannedMinutes: Math.round(d.planned),
        workedMinutes: Math.round(d.worked),
        balanceMinutes: Math.round(d.balance),
      })),
    };
  }

  /** Reconstitue l'entrée du domaine à partir des lignes stockées. */
  private async buildSource(userId: string, now: number): Promise<LedgerSource> {
    const [entryRows, dayRows, storedSettings] = await Promise.all([
      this.port.loadEntries(userId),
      this.port.loadDays(userId),
      this.port.loadSettings(userId),
    ]);

    const entries = new Map<DateISO, TimeEntry[]>();
    for (const row of entryRows) {
      if (row.deletedAt !== null) continue;
      const dto = entryRowToDto(row);
      const entry: TimeEntry = {
        id: dto.id,
        date: dto.date,
        type: dto.type,
        at: dto.at,
        manual: dto.manual,
      };
      const bucket = entries.get(entry.date);
      if (bucket) bucket.push(entry);
      else entries.set(entry.date, [entry]);
    }

    const days = new Map<DateISO, WorkDay>();
    for (const row of dayRows) {
      if (row.deletedAt !== null) continue;
      const dto = dayRowToDto(row);
      days.set(dto.id, {
        date: dto.id,
        status: dto.status,
        worksOnHoliday: dto.worksOnHoliday === true,
        plannedOverride: dto.plannedOverride ?? undefined,
        notes: dto.notes ?? undefined,
        updatedAt: dto.updatedAt,
      });
    }

    const settings: Settings = mergeSettings(
      (storedSettings?.payload ?? null) as Partial<Settings> | null,
    );

    return { settings, days, entries, now };
  }
}
