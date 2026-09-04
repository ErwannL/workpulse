import type { DateISO, DayStatus, Minutes, Settings, TimeEntry, WorkDay } from './types';
import { computeDay, effectiveStatus, plannedMinutes, type DayComputation } from './day';
import { holidayName } from './holidays';
import { addDays, endOfWeek, rangeDays, startOfWeek, todayISO, weekKey, weekDays } from './time';

export interface LedgerSource {
  settings: Settings;
  days: Map<DateISO, WorkDay>;
  entries: Map<DateISO, TimeEntry[]>;
  now: number;
}

export interface DaySummary {
  date: DateISO;
  status: DayStatus;
  holiday: string | null;
  planned: Minutes;
  worked: Minutes;
  /** `worked - planned`, uniquement pour les jours déjà écoulés. */
  balance: Minutes;
  /** Faux pour les jours à venir : ils ne pèsent pas encore sur le solde. */
  elapsed: boolean;
  /** Vrai si des heures ont été pointées sur la journée. */
  hasActivity: boolean;
  computation: DayComputation;
  day?: WorkDay;
}

export interface WeekSummary {
  key: string;
  monday: DateISO;
  sunday: DateISO;
  days: DaySummary[];
  /** Objectif de la semaine, jours fériés et congés déduits. */
  planned: Minutes;
  /** Objectif des seuls jours déjà écoulés. */
  plannedElapsed: Minutes;
  worked: Minutes;
  /** `worked - planned` : le solde reporté en fin de semaine. */
  difference: Minutes;
  /** `worked - plannedElapsed` : l'avance ou le retard à cet instant. */
  pace: Minutes;
  remainingToTarget: Minutes;
  overtime: Minutes;
  overtimeCap: Minutes;
  overtimeExceeded: boolean;
  carryIn: Minutes;
  /** Solde cumulé à la fin de cette semaine, report inclus. */
  carryOut: Minutes;
  complete: boolean;
}

export function summarizeDay(src: LedgerSource, date: DateISO): DaySummary {
  const day = src.days.get(date);
  const entries = src.entries.get(date) ?? [];
  const computation = computeDay(date, entries, src.now);
  const planned = plannedMinutes(date, day, src.settings);
  const today = todayISO(src.now);
  const elapsed = date <= today;
  return {
    date,
    status: effectiveStatus(date, day, src.settings),
    holiday: holidayName(date),
    planned,
    worked: computation.worked,
    balance: elapsed ? computation.worked - planned : 0,
    elapsed,
    hasActivity: entries.length > 0,
    computation,
    day,
  };
}

function emptyIfNaN(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

export function summarizeWeek(src: LedgerSource, anyDayOfWeek: DateISO, carryIn: Minutes): WeekSummary {
  const monday = startOfWeek(anyDayOfWeek);
  const days = weekDays(monday).map((d) => summarizeDay(src, d));
  const today = todayISO(src.now);

  const planned = days.reduce((s, d) => s + d.planned, 0);
  const plannedElapsed = days.reduce((s, d) => s + (d.elapsed ? d.planned : 0), 0);
  const worked = days.reduce((s, d) => s + d.worked, 0);
  const difference = worked - planned;
  const overtime = Math.max(0, difference);
  const cap = src.settings.overtimeCapMinutes;

  return {
    key: weekKey(monday),
    monday,
    sunday: endOfWeek(monday),
    days,
    planned,
    plannedElapsed,
    worked,
    difference: emptyIfNaN(difference),
    pace: emptyIfNaN(worked - plannedElapsed),
    remainingToTarget: Math.max(0, planned - worked),
    overtime,
    overtimeCap: cap,
    overtimeExceeded: overtime > cap,
    carryIn,
    carryOut: carryIn + difference,
    complete: endOfWeek(monday) < today,
  };
}

/**
 * Rejoue toutes les semaines depuis le début du suivi jusqu'à la semaine
 * demandée pour obtenir le report accumulé. Le solde d'une semaine est
 * toujours reporté sur la suivante (règle 4).
 */
export function carryInFor(src: LedgerSource, target: DateISO): Minutes {
  const targetMonday = startOfWeek(target);
  const firstMonday = startOfWeek(src.settings.trackingStart);
  let carry = src.settings.initialBalance;
  let cursor = firstMonday;
  let guard = 0;
  while (cursor < targetMonday && guard++ < 520) {
    const week = summarizeWeek(src, cursor, carry);
    carry = week.carryOut;
    cursor = addDays(cursor, 7);
  }
  return carry;
}

/** Suite continue de semaines, chacune héritant du solde de la précédente. */
export function buildWeeks(src: LedgerSource, from: DateISO, to: DateISO): WeekSummary[] {
  const first = startOfWeek(from);
  let carry = carryInFor(src, first);
  const out: WeekSummary[] = [];
  let cursor = first;
  let guard = 0;
  while (cursor <= to && guard++ < 520) {
    const week = summarizeWeek(src, cursor, carry);
    out.push(week);
    carry = week.carryOut;
    cursor = addDays(cursor, 7);
  }
  return out;
}

export interface PeriodStats {
  from: DateISO;
  to: DateISO;
  plannedDays: number;
  workedDays: number;
  leaveDays: number;
  holidayDays: number;
  absenceDays: number;
  /** Objectif de toute la période, jours à venir compris. */
  plannedMinutes: Minutes;
  /** Objectif des seuls jours déjà écoulés : c'est lui qui fait le solde. */
  plannedMinutesElapsed: Minutes;
  workedMinutes: Minutes;
  balance: Minutes;
}

/** Compteurs de jours et d'heures sur une période arbitraire (mois, année, total). */
export function periodStats(src: LedgerSource, from: DateISO, to: DateISO): PeriodStats {
  const stats: PeriodStats = {
    from,
    to,
    plannedDays: 0,
    workedDays: 0,
    leaveDays: 0,
    holidayDays: 0,
    absenceDays: 0,
    plannedMinutes: 0,
    plannedMinutesElapsed: 0,
    workedMinutes: 0,
    balance: 0,
  };

  for (const date of rangeDays(from, to)) {
    const d = summarizeDay(src, date);
    stats.plannedMinutes += d.planned;
    if (d.elapsed) stats.plannedMinutesElapsed += d.planned;
    stats.workedMinutes += d.worked;
    if (d.elapsed) stats.balance += d.balance;
    if (d.planned > 0) stats.plannedDays += 1;
    if (d.worked > 0) stats.workedDays += 1;
    if (d.status === 'HOLIDAY') stats.holidayDays += 1;
    else if (d.status === 'LEAVE' || d.status === 'RTT') stats.leaveDays += 1;
    else if (d.status === 'SICK' || d.status === 'SPECIAL' || d.status === 'OTHER') {
      // Un week-end sans enregistrement n'est pas une absence : il n'est pas planifié.
      if (d.day) stats.absenceDays += 1;
    }
  }
  return stats;
}
