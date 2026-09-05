import type { DayPattern, Settings, WeekSchedule } from './types.js';
import { todayISO } from './time.js';
import { defaultWeekSchedule, scheduleFromPattern } from './schedule.js';

const DAILY_MINUTES = 7 * 60;

export const DEFAULT_SETTINGS: Settings = {
  userName: 'Erwann',
  week: defaultWeekSchedule(DAILY_MINUTES),
  dailyMinutes: DAILY_MINUTES,
  overtimeCapMinutes: 4 * 60,
  minBreakMinutes: 30,
  enforceMinBreak: true,
  notifications: {
    enabled: true,
    dayStart: true,
    lunchStart: true,
    lunchEnd: true,
    dayEnd: true,
    repeatMinutes: 5,
    snoozeOptions: [10, 30, 60],
  },
  country: 'FR',
  trackingStart: todayISO(),
  initialBalance: 0,
};

/** Forme héritée des réglages, avant l'introduction de la semaine type. */
interface LegacySettings {
  weeklyMinutes?: number;
  workDays?: number[];
  refStart?: string;
  refBreakStart?: string;
  refBreakEnd?: string;
  refEnd?: string;
}

/**
 * Reconstruit une semaine type à partir des anciens réglages : liste de jours
 * travaillés et horaires uniques. Sans cela, une sauvegarde antérieure
 * repartirait sur la semaine par défaut et fausserait tous les soldes.
 */
function migrateWeek(legacy: LegacySettings, dailyMinutes: number): WeekSchedule {
  const week = defaultWeekSchedule(dailyMinutes);
  const workDays = legacy.workDays ?? [1, 2, 3, 4, 5];
  for (let weekday = 1; weekday <= 7; weekday++) {
    const pattern: DayPattern = workDays.includes(weekday) ? 'FULL' : 'OFF';
    const schedule = scheduleFromPattern(pattern, dailyMinutes);
    if (pattern === 'FULL') {
      if (legacy.refStart) schedule.start = legacy.refStart;
      if (legacy.refEnd) schedule.end = legacy.refEnd;
      if (legacy.refBreakStart) schedule.breakStart = legacy.refBreakStart;
      if (legacy.refBreakEnd) schedule.breakEnd = legacy.refBreakEnd;
    }
    week[weekday] = schedule;
  }
  return week;
}

function normalizeWeek(week: WeekSchedule | undefined, dailyMinutes: number): WeekSchedule | null {
  if (!week) return null;
  const out: WeekSchedule = {};
  let found = false;
  for (let weekday = 1; weekday <= 7; weekday++) {
    const day = week[weekday];
    if (day && typeof day.minutes === 'number' && typeof day.start === 'string') {
      out[weekday] = { ...day };
      found = true;
    } else {
      out[weekday] = scheduleFromPattern('OFF', dailyMinutes);
    }
  }
  return found ? out : null;
}

/**
 * Complète un objet partiel avec les valeurs par défaut, en migrant au passage
 * les réglages enregistrés par une version antérieure de l'application.
 */
export function mergeSettings(
  partial: (Partial<Settings> & LegacySettings) | undefined | null,
): Settings {
  if (!partial) return { ...DEFAULT_SETTINGS, week: defaultWeekSchedule(DAILY_MINUTES) };

  const dailyMinutes = partial.dailyMinutes ?? DEFAULT_SETTINGS.dailyMinutes;
  const week =
    normalizeWeek(partial.week, dailyMinutes) ??
    (partial.workDays || partial.refStart ? migrateWeek(partial, dailyMinutes) : null) ??
    defaultWeekSchedule(dailyMinutes);

  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    dailyMinutes,
    week,
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(partial.notifications ?? {}) },
  };
}
