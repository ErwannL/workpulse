import type {
  DateISO,
  DayPattern,
  DaySchedule,
  HHMM,
  Minutes,
  Settings,
  WeekSchedule,
  WorkDay,
} from './types.js';
import { isoWeekday, parseHHMM } from './time.js';

/**
 * Horaires de référence par défaut d'une journée complète. Ils servent de
 * gabarit : l'utilisateur peut tout changer, jour par jour.
 */
export const DEFAULT_FULL_DAY = {
  start: '08:00' as HHMM,
  breakStart: '12:00' as HHMM,
  breakEnd: '13:00' as HHMM,
  end: '17:00' as HHMM,
};

/** Journée non travaillée : rien n'est dû, aucune alerte n'est émise. */
export const OFF_DAY: DaySchedule = {
  pattern: 'OFF',
  minutes: 0,
  start: DEFAULT_FULL_DAY.start,
  end: DEFAULT_FULL_DAY.start,
};

/**
 * Fabrique l'horaire d'une journée à partir de sa forme.
 *
 * Une demi-journée n'a délibérément pas de pause : couper une matinée de
 * trois heures et demie n'a pas de sens, et la pause minimale légale ne
 * s'applique pas à une journée aussi courte.
 */
export function scheduleFromPattern(pattern: DayPattern, dailyMinutes: Minutes): DaySchedule {
  const { start, breakStart, breakEnd, end } = DEFAULT_FULL_DAY;
  switch (pattern) {
    case 'OFF':
      return { ...OFF_DAY };
    case 'MORNING':
      return {
        pattern,
        minutes: Math.round(dailyMinutes / 2),
        start,
        end: breakStart,
      };
    case 'AFTERNOON':
      return {
        pattern,
        minutes: Math.round(dailyMinutes / 2),
        start: breakEnd,
        end,
      };
    case 'FULL':
    case 'CUSTOM':
    default:
      return {
        pattern: pattern === 'CUSTOM' ? 'CUSTOM' : 'FULL',
        minutes: dailyMinutes,
        start,
        breakStart,
        breakEnd,
        end,
      };
  }
}

/** Semaine type : lundi au vendredi en journées complètes, week-end non travaillé. */
export function defaultWeekSchedule(dailyMinutes: Minutes): WeekSchedule {
  const week: WeekSchedule = {};
  for (let weekday = 1; weekday <= 7; weekday++) {
    week[weekday] = scheduleFromPattern(weekday <= 5 ? 'FULL' : 'OFF', dailyMinutes);
  }
  return week;
}

/** Horaire théorique d'un jour de la semaine, quel que soit l'état des réglages. */
export function scheduleForWeekday(weekday: number, settings: Settings): DaySchedule {
  return settings.week[weekday] ?? { ...OFF_DAY };
}

/**
 * Horaire effectif d'une date : la semaine type, éventuellement remplacée par
 * la forme déclarée sur cette journée précise.
 */
export function scheduleForDate(
  date: DateISO,
  day: WorkDay | undefined,
  settings: Settings,
): DaySchedule {
  const base = scheduleForWeekday(isoWeekday(date), settings);
  if (day?.pattern === undefined) return base;
  if (day.pattern === base.pattern) return base;
  // Une demi-journée posée sur un jour non travaillé reste une demi-journée.
  return scheduleFromPattern(day.pattern, settings.dailyMinutes);
}

/** Une journée qui comporte une coupure déjeuner. */
export function hasBreak(schedule: DaySchedule): boolean {
  return schedule.breakStart !== undefined && schedule.breakEnd !== undefined;
}

/** Objectif hebdomadaire type : la somme des journées de la semaine. */
export function weeklyMinutes(settings: Settings): Minutes {
  let total = 0;
  for (let weekday = 1; weekday <= 7; weekday++) {
    total += scheduleForWeekday(weekday, settings).minutes;
  }
  return total;
}

/** Jours de la semaine effectivement travaillés, du lundi au dimanche. */
export function workingWeekdays(settings: Settings): number[] {
  const days: number[] = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    if (scheduleForWeekday(weekday, settings).minutes > 0) days.push(weekday);
  }
  return days;
}

/** Fin de la journée exprimée en minutes depuis minuit, pour les alertes. */
export function endMinutes(schedule: DaySchedule): Minutes {
  return parseHHMM(schedule.end);
}

/** Début de la journée exprimé en minutes depuis minuit. */
export function startMinutes(schedule: DaySchedule): Minutes {
  return parseHHMM(schedule.start);
}
