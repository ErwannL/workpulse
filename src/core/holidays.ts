import type { DateISO } from './types';
import { addDays, toISO } from './time';

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher, calendrier grégorien). */
export function easterSunday(year: number): DateISO {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toISO(new Date(year, month - 1, day));
}

/** Jours fériés français (métropole) d'une année, indexés par date ISO. */
export function frenchHolidays(year: number): Record<DateISO, string> {
  const easter = easterSunday(year);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fixed = (m: number, d: number) => `${year}-${pad(m)}-${pad(d)}`;

  return {
    [fixed(1, 1)]: 'Jour de l’an',
    [addDays(easter, 1)]: 'Lundi de Pâques',
    [fixed(5, 1)]: 'Fête du Travail',
    [fixed(5, 8)]: 'Victoire 1945',
    [addDays(easter, 39)]: 'Ascension',
    [addDays(easter, 50)]: 'Lundi de Pentecôte',
    [fixed(7, 14)]: 'Fête nationale',
    [fixed(8, 15)]: 'Assomption',
    [fixed(11, 1)]: 'Toussaint',
    [fixed(11, 11)]: 'Armistice 1918',
    [fixed(12, 25)]: 'Noël',
  };
}

const cache = new Map<number, Record<DateISO, string>>();

/** Nom du jour férié, ou `null`. Résultat mémoïsé par année. */
export function holidayName(iso: DateISO): string | null {
  const year = Number(iso.slice(0, 4));
  let table = cache.get(year);
  if (!table) {
    table = frenchHolidays(year);
    cache.set(year, table);
  }
  return table[iso] ?? null;
}

export function isHoliday(iso: DateISO): boolean {
  return holidayName(iso) !== null;
}

/** Jours fériés d'une année sous forme de liste triée. */
export function holidayList(year: number): { date: DateISO; name: string }[] {
  return Object.entries(frenchHolidays(year))
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
