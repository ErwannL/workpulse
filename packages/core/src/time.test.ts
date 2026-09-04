import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  atTimeOn,
  clock,
  dayName,
  dayShort,
  endOfWeek,
  formatClockish,
  formatDuration,
  formatHHMM,
  formatLongDate,
  formatShortDate,
  formatSigned,
  fromISO,
  isoWeekNumber,
  isoWeekday,
  minutesOfDay,
  monthDays,
  monthKey,
  monthName,
  parseHHMM,
  rangeDays,
  startOfWeek,
  toISO,
  weekDays,
  weekKey,
} from './time.js';

describe('time', () => {
  it('numérote les jours de lundi (1) à dimanche (7)', () => {
    expect(isoWeekday('2026-09-07')).toBe(1);
    expect(isoWeekday('2026-09-13')).toBe(7);
  });

  it('ramène toute date au lundi de sa semaine', () => {
    expect(startOfWeek('2026-09-10')).toBe('2026-09-07');
    expect(startOfWeek('2026-09-07')).toBe('2026-09-07');
    expect(startOfWeek('2026-09-13')).toBe('2026-09-07');
  });

  it('énumère les sept jours de la semaine', () => {
    expect(weekDays('2026-09-10')).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ]);
  });

  it('traverse correctement les changements de mois et d’année', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('calcule le numéro de semaine ISO', () => {
    expect(isoWeekNumber('2026-01-01')).toBe(1);
    expect(isoWeekNumber('2026-09-07')).toBe(37);
    expect(weekKey('2026-09-10')).toBe('2026-W37');
  });

  it('formate les durées à la française', () => {
    expect(formatDuration(473)).toBe('7h53');
    expect(formatDuration(53)).toBe('53 min');
    expect(formatDuration(0)).toBe('0 min');
    expect(formatClockish(420)).toBe('7h00');
    expect(formatSigned(101)).toBe('+1h41');
    expect(formatSigned(-198)).toBe('−3h18');
    expect(formatSigned(0)).toBe('0h00');
  });

  it('construit un horodatage local à partir d’une heure', () => {
    const at = atTimeOn('2026-09-07', '08:30');
    const d = new Date(at);
    expect(d.getHours()).toBe(8);
    expect(d.getMinutes()).toBe(30);
    expect(d.getDate()).toBe(7);
  });

  it('énumère les jours d’un mois et d’un intervalle', () => {
    expect(monthDays('2026-02-15')).toHaveLength(28);
    expect(monthDays('2028-02-15')).toHaveLength(29);
    expect(rangeDays('2026-09-07', '2026-09-09')).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
    ]);
  });
});

describe('temps — formats et navigation restants', () => {
  it('avance et recule de mois en restant sur le premier jour', () => {
    expect(addMonths('2026-09-15', 1)).toBe('2026-10-01');
    expect(addMonths('2026-01-31', -1)).toBe('2025-12-01');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01');
  });

  it('donne le lundi et le dimanche de la semaine', () => {
    expect(startOfWeek('2026-09-10')).toBe('2026-09-07');
    expect(endOfWeek('2026-09-10')).toBe('2026-09-13');
  });

  it('donne la clé du mois', () => {
    expect(monthKey('2026-09-15')).toBe('2026-09');
  });

  it('formate et relit une heure de la journée', () => {
    expect(formatHHMM(0)).toBe('00:00');
    expect(formatHHMM(8 * 60 + 7)).toBe('08:07');
    expect(formatHHMM(-60)).toBe('23:00');
    expect(formatHHMM(25 * 60)).toBe('01:00');
    expect(parseHHMM(formatHHMM(732))).toBe(732);
    expect(parseHHMM('09')).toBe(540);
  });

  it('compte les minutes écoulées depuis minuit', () => {
    expect(Math.round(minutesOfDay(atTimeOn('2026-09-07', '08:30')))).toBe(510);
  });

  it('affiche l’horloge d’un horodatage', () => {
    expect(clock(atTimeOn('2026-09-07', '08:07'))).toBe('08:07');
  });

  it('nomme les jours et les mois en français', () => {
    expect(dayName('2026-09-07')).toBe('lundi');
    expect(dayName('2026-09-13')).toBe('dimanche');
    expect(dayShort('2026-09-07')).toBe('Lun');
    expect(monthName('2026-09-07')).toBe('septembre');
    expect(formatLongDate('2026-09-07')).toBe('lundi 7 septembre');
    expect(formatShortDate('2026-09-07')).toBe('7 sept.');
  });

  it('accepte un intervalle donné à l’envers', () => {
    expect(rangeDays('2026-09-09', '2026-09-07')).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
    ]);
  });

  it('convertit une date en chaîne ISO et inversement', () => {
    expect(toISO(fromISO('2026-09-07'))).toBe('2026-09-07');
  });
});
