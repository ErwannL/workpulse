import type { DateISO, HHMM, Minutes } from './types';

export const MINUTE = 60_000;
export const DAY_MS = 86_400_000;

/** `2026-09-04` pour la date locale donnée. */
export function toISO(d: Date): DateISO {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Minuit local du jour ISO donné. */
export function fromISO(iso: DateISO): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function todayISO(now: number = Date.now()): DateISO {
  return toISO(new Date(now));
}

export function addDays(iso: DateISO, n: number): DateISO {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function addMonths(iso: DateISO, n: number): DateISO {
  const d = fromISO(iso);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}

/** 1 = lundi … 7 = dimanche. */
export function isoWeekday(iso: DateISO): number {
  const wd = fromISO(iso).getDay();
  return wd === 0 ? 7 : wd;
}

/** Lundi de la semaine contenant `iso`. */
export function startOfWeek(iso: DateISO): DateISO {
  return addDays(iso, -(isoWeekday(iso) - 1));
}

export function endOfWeek(iso: DateISO): DateISO {
  return addDays(startOfWeek(iso), 6);
}

/** Les 7 jours ISO de la semaine contenant `iso`, du lundi au dimanche. */
export function weekDays(iso: DateISO): DateISO[] {
  const monday = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Numéro de semaine ISO 8601. */
export function isoWeekNumber(iso: DateISO): number {
  const d = fromISO(iso);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
}

/** Clé stable et triable d'une semaine, ex. `2026-W36`. */
export function weekKey(iso: DateISO): string {
  const monday = startOfWeek(iso);
  const d = fromISO(monday);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3);
  return `${target.getFullYear()}-W${String(isoWeekNumber(iso)).padStart(2, '0')}`;
}

export function monthKey(iso: DateISO): string {
  return iso.slice(0, 7);
}

/** Tous les jours ISO du mois de `iso`. */
export function monthDays(iso: DateISO): DateISO[] {
  const first = `${iso.slice(0, 7)}-01`;
  const d = fromISO(first);
  const month = d.getMonth();
  const out: DateISO[] = [];
  while (d.getMonth() === month) {
    out.push(toISO(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function parseHHMM(v: HHMM): Minutes {
  const [h, m] = v.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function formatHHMM(minutesOfDay: Minutes): HHMM {
  const m = ((Math.round(minutesOfDay) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Minutes écoulées depuis minuit local pour un timestamp. */
export function minutesOfDay(at: number): Minutes {
  const d = new Date(at);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/** Timestamp epoch de `HH:MM` le jour ISO donné. */
export function atTimeOn(iso: DateISO, hhmm: HHMM): number {
  const d = fromISO(iso);
  d.setMinutes(parseHHMM(hhmm));
  return d.getTime();
}

/** Horloge courte d'un timestamp : `08:07`. */
export function clock(at: number): HHMM {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** `7h53`, `53 min`, `0 min`. Toujours positif : voir `formatSigned`. */
export function formatDuration(minutes: Minutes): string {
  const total = Math.round(Math.abs(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/** `+1h41`, `-3h18`, `0h00`. */
export function formatSigned(minutes: Minutes): string {
  const rounded = Math.round(minutes);
  if (rounded === 0) return '0h00';
  const sign = rounded > 0 ? '+' : '−';
  const total = Math.abs(rounded);
  return `${sign}${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`;
}

/** `7h00` — format tableau de bord, toujours avec les minutes. */
export function formatClockish(minutes: Minutes): string {
  const total = Math.round(Math.abs(minutes));
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`;
}

const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function dayName(iso: DateISO): string {
  return DAY_NAMES[isoWeekday(iso) - 1];
}

export function dayShort(iso: DateISO): string {
  return DAY_SHORT[isoWeekday(iso) - 1];
}

export function monthName(iso: DateISO): string {
  return MONTH_NAMES[fromISO(iso).getMonth()];
}

/** `jeudi 4 septembre`. */
export function formatLongDate(iso: DateISO): string {
  return `${dayName(iso)} ${fromISO(iso).getDate()} ${monthName(iso)}`;
}

/** `4 sept.` */
export function formatShortDate(iso: DateISO): string {
  return `${fromISO(iso).getDate()} ${monthName(iso).slice(0, 4)}.`;
}

export function clampRange(a: DateISO, b: DateISO): [DateISO, DateISO] {
  return a <= b ? [a, b] : [b, a];
}

/** Tous les jours ISO de `from` à `to` inclus. */
export function rangeDays(from: DateISO, to: DateISO): DateISO[] {
  const [a, b] = clampRange(from, to);
  const out: DateISO[] = [];
  let cur = a;
  while (cur <= b) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
