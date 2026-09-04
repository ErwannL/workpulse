import type { DateISO, EntryType, Settings, TimeEntry, WorkDay } from './types';
import { DEFAULT_SETTINGS } from './settings';
import { atTimeOn, startOfWeek, todayISO } from './time';
import type { LedgerSource } from './ledger';

let seq = 0;

/** Fabrique un pointage à `HH:MM` le jour donné. Réservé aux tests et aux démos. */
export function entry(date: DateISO, type: EntryType, hhmm: string): TimeEntry {
  return { id: `e${seq++}`, date, type, at: atTimeOn(date, hhmm), manual: false };
}

/** Journée complète 08:00 → 12:00 / 13:00 → `end`. */
export function fullDay(date: DateISO, end = '17:00'): TimeEntry[] {
  return [
    entry(date, 'CLOCK_IN', '08:00'),
    entry(date, 'BREAK_START', '12:00'),
    entry(date, 'BREAK_END', '13:00'),
    entry(date, 'CLOCK_OUT', end),
  ];
}

export function makeSource(opts: {
  now: number;
  settings?: Partial<Settings>;
  days?: WorkDay[];
  entries?: TimeEntry[];
}): LedgerSource {
  const entriesByDate = new Map<DateISO, TimeEntry[]>();
  for (const e of opts.entries ?? []) {
    const list = entriesByDate.get(e.date) ?? [];
    list.push(e);
    entriesByDate.set(e.date, list);
  }
  return {
    now: opts.now,
    // Par défaut le suivi démarre au lundi de la semaine testée : sans cela,
    // toutes les semaines antérieures compteraient comme des semaines à zéro heure.
    settings: {
      ...DEFAULT_SETTINGS,
      trackingStart: startOfWeek(todayISO(opts.now)),
      ...opts.settings,
    },
    days: new Map((opts.days ?? []).map((d) => [d.date, d])),
    entries: entriesByDate,
  };
}

export function workDay(date: DateISO, patch: Partial<WorkDay> = {}): WorkDay {
  return { date, status: 'WORK', updatedAt: 0, ...patch };
}
