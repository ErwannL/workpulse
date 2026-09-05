import Dexie, { type Table } from 'dexie';
import type { TimeEntry, WorkDay } from '@workpulse/core';

export interface MetaRow {
  key: string;
  value: unknown;
}

/**
 * Base locale de WorkPulse. Tout reste sur l'appareil : aucune donnée
 * personnelle ne sort de l'application (voir §32 du cahier des charges).
 */
export class WorkPulseDB extends Dexie {
  entries!: Table<TimeEntry, string>;
  days!: Table<WorkDay, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'workpulse') {
    super(name);
    this.version(1).stores({
      entries: 'id, date, type, at',
      days: 'date, status',
      meta: 'key',
    });
  }
}

export const db = new WorkPulseDB();
