import type { Settings } from './types.js';
import { todayISO } from './time.js';

export const DEFAULT_SETTINGS: Settings = {
  userName: 'Erwann',
  weeklyMinutes: 35 * 60,
  dailyMinutes: 7 * 60,
  workDays: [1, 2, 3, 4, 5],
  overtimeCapMinutes: 4 * 60,
  refStart: '08:00',
  refBreakStart: '12:00',
  refBreakEnd: '13:00',
  refEnd: '17:00',
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

/** Complète un objet partiel avec les valeurs par défaut (migrations douces). */
export function mergeSettings(partial: Partial<Settings> | undefined | null): Settings {
  if (!partial) return { ...DEFAULT_SETTINGS };
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    workDays: partial.workDays?.length ? [...partial.workDays] : [...DEFAULT_SETTINGS.workDays],
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(partial.notifications ?? {}) },
  };
}
