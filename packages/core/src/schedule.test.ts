import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FULL_DAY,
  defaultWeekSchedule,
  endMinutes,
  hasBreak,
  OFF_DAY,
  scheduleForDate,
  scheduleForWeekday,
  scheduleFromPattern,
  startMinutes,
  weeklyMinutes,
  workingWeekdays,
} from './schedule.js';
import { mergeSettings } from './settings.js';
import { workDay } from './testing.js';

const MON = '2026-09-07';
const FRI = '2026-09-11';
const SAT = '2026-09-12';

describe('scheduleFromPattern', () => {
  it('décrit une journée complète avec sa coupure déjeuner', () => {
    const schedule = scheduleFromPattern('FULL', 420);
    expect(schedule).toEqual({
      pattern: 'FULL',
      minutes: 420,
      start: '08:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      end: '17:00',
    });
    expect(hasBreak(schedule)).toBe(true);
  });

  it('décrit une matinée : moitié du temps, aucune coupure', () => {
    const schedule = scheduleFromPattern('MORNING', 420);
    expect(schedule.minutes).toBe(210);
    expect(schedule.start).toBe('08:00');
    expect(schedule.end).toBe('12:00');
    expect(hasBreak(schedule)).toBe(false);
  });

  it('décrit un après-midi qui commence après le déjeuner', () => {
    const schedule = scheduleFromPattern('AFTERNOON', 420);
    expect(schedule.minutes).toBe(210);
    expect(schedule.start).toBe('13:00');
    expect(schedule.end).toBe('17:00');
    expect(hasBreak(schedule)).toBe(false);
  });

  it('arrondit une demi-journée à la minute', () => {
    expect(scheduleFromPattern('MORNING', 455).minutes).toBe(228);
  });

  it('décrit une journée non travaillée', () => {
    expect(scheduleFromPattern('OFF', 420)).toEqual(OFF_DAY);
    expect(scheduleFromPattern('OFF', 420).minutes).toBe(0);
  });

  it('conserve la forme personnalisée', () => {
    expect(scheduleFromPattern('CUSTOM', 480).pattern).toBe('CUSTOM');
    expect(scheduleFromPattern('CUSTOM', 480).minutes).toBe(480);
  });
});

describe('semaine type', () => {
  it('travaille du lundi au vendredi par défaut', () => {
    const week = defaultWeekSchedule(420);
    expect(week[1].pattern).toBe('FULL');
    expect(week[5].pattern).toBe('FULL');
    expect(week[6].pattern).toBe('OFF');
    expect(week[7].pattern).toBe('OFF');
  });

  it('somme les journées pour donner l’objectif hebdomadaire', () => {
    const settings = mergeSettings(undefined);
    expect(weeklyMinutes(settings)).toBe(2100);

    settings.week[5] = scheduleFromPattern('MORNING', 420);
    expect(weeklyMinutes(settings)).toBe(4 * 420 + 210);
    expect(workingWeekdays(settings)).toEqual([1, 2, 3, 4, 5]);
  });

  it('retombe sur une journée non travaillée pour un jour absent des réglages', () => {
    const settings = mergeSettings(undefined);
    delete settings.week[3];
    expect(scheduleForWeekday(3, settings).minutes).toBe(0);
  });

  it('expose les bornes de la journée en minutes', () => {
    const settings = mergeSettings(undefined);
    expect(startMinutes(scheduleForWeekday(1, settings))).toBe(480);
    expect(endMinutes(scheduleForWeekday(1, settings))).toBe(1020);
  });

  it('publie les horaires de référence par défaut', () => {
    expect(DEFAULT_FULL_DAY.start).toBe('08:00');
    expect(DEFAULT_FULL_DAY.end).toBe('17:00');
  });
});

describe('scheduleForDate', () => {
  const settings = mergeSettings(undefined);

  it('suit la semaine type sans indication contraire', () => {
    expect(scheduleForDate(MON, undefined, settings).pattern).toBe('FULL');
    expect(scheduleForDate(SAT, undefined, settings).pattern).toBe('OFF');
  });

  it('accepte une demi-journée posée sur une seule date', () => {
    const schedule = scheduleForDate(FRI, workDay(FRI, { pattern: 'MORNING' }), settings);
    expect(schedule.pattern).toBe('MORNING');
    expect(schedule.minutes).toBe(210);
  });

  it('permet de travailler un samedi exceptionnellement', () => {
    const schedule = scheduleForDate(SAT, workDay(SAT, { pattern: 'AFTERNOON' }), settings);
    expect(schedule.minutes).toBe(210);
    expect(schedule.start).toBe('13:00');
  });

  it('permet de ne pas travailler un jour normalement travaillé', () => {
    expect(scheduleForDate(MON, workDay(MON, { pattern: 'OFF' }), settings).minutes).toBe(0);
  });

  it('garde l’horaire de la semaine quand la forme déclarée est la même', () => {
    const custom = mergeSettings(undefined);
    custom.week[1] = { pattern: 'FULL', minutes: 420, start: '09:00', end: '18:00' };
    const schedule = scheduleForDate(MON, workDay(MON, { pattern: 'FULL' }), custom);
    expect(schedule.start).toBe('09:00');
  });
});
