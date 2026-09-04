import { Injectable, Logger } from '@nestjs/common';
import { changedSince, mergeRecords, nextCursor } from './merge';
import { dayDtoToRow, dayRowToDto, entryDtoToRow, entryRowToDto } from './sync.mapper';
import type { SettingsDto, SyncPushDto, TimeEntryDto, WorkDayDto } from './sync.dto';
import type { StoredSettings, SyncPort } from './sync.port';

export interface SyncResult {
  /** État à appliquer côté client : uniquement ce qui a changé depuis son curseur. */
  entries: TimeEntryDto[];
  days: WorkDayDto[];
  settings: SettingsDto | null;
  /** À renvoyer tel quel à la synchronisation suivante. */
  cursor: number;
  /** Nombre de lignes entrantes écartées au profit du serveur. */
  conflicts: number;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly port: SyncPort) {}

  /** Lecture seule : ce que le client n'a pas encore vu. */
  async pull(userId: string, since: number | null): Promise<SyncResult> {
    const [entryRows, dayRows, settings] = await Promise.all([
      this.port.loadEntries(userId),
      this.port.loadDays(userId),
      this.port.loadSettings(userId),
    ]);

    const entries = entryRows.map(entryRowToDto);
    const days = dayRows.map(dayRowToDto);
    return this.project(entries, days, settings, since, 0);
  }

  /**
   * Applique un lot client puis renvoie ce qui manque au client.
   *
   * L'écriture est minimale : seules les lignes où le client a gagné
   * l'arbitrage sont persistées, ce qui rend l'opération idempotente.
   */
  async push(userId: string, payload: SyncPushDto): Promise<SyncResult> {
    const [entryRows, dayRows, storedSettings] = await Promise.all([
      this.port.loadEntries(userId),
      this.port.loadDays(userId),
      this.port.loadSettings(userId),
    ]);

    const entryMerge = mergeRecords(entryRows.map(entryRowToDto), payload.entries);
    const dayMerge = mergeRecords(dayRows.map(dayRowToDto), payload.days);
    const settings = this.resolveSettings(storedSettings, payload.settings ?? null);

    await this.port.persist({
      userId,
      entries: entryMerge.toPersist.map(entryDtoToRow),
      days: dayMerge.toPersist.map(dayDtoToRow),
      settings: settings.toPersist,
    });

    const conflicts = entryMerge.conflicts + dayMerge.conflicts + settings.conflicts;
    if (conflicts > 0) {
      this.logger.log(`Synchronisation de ${userId} : ${conflicts} conflit(s) arbitré(s)`);
    }

    return this.project(
      entryMerge.merged,
      dayMerge.merged,
      settings.winner,
      payload.since ?? null,
      conflicts,
    );
  }

  /** Les réglages suivent la même règle que le reste : au plus récent. */
  private resolveSettings(
    stored: StoredSettings | null,
    incoming: SettingsDto | null,
  ): { winner: StoredSettings | null; toPersist: StoredSettings | null; conflicts: number } {
    if (incoming === null) return { winner: stored, toPersist: null, conflicts: 0 };
    const candidate: StoredSettings = {
      payload: incoming.payload,
      updatedAt: new Date(incoming.updatedAt),
    };
    if (stored !== null && stored.updatedAt.getTime() >= candidate.updatedAt.getTime()) {
      return { winner: stored, toPersist: null, conflicts: 1 };
    }
    return { winner: candidate, toPersist: candidate, conflicts: 0 };
  }

  private project(
    entries: TimeEntryDto[],
    days: WorkDayDto[],
    settings: StoredSettings | null,
    since: number | null,
    conflicts: number,
  ): SyncResult {
    const freshEntries = changedSince(entries, since);
    const freshDays = changedSince(days, since);
    const settingsUpdatedAt = settings?.updatedAt.getTime() ?? 0;
    const sendSettings = settings !== null && (since === null || settingsUpdatedAt > since);

    const cursor = Math.max(
      nextCursor(freshEntries, since ?? 0),
      nextCursor(freshDays, since ?? 0),
      settingsUpdatedAt,
    );

    return {
      entries: freshEntries,
      days: freshDays,
      settings: sendSettings ? { payload: settings.payload, updatedAt: settingsUpdatedAt } : null,
      cursor,
      conflicts,
    };
  }
}
