import { describe, expect, it } from 'vitest';
import {
  addDays,
  atTimeOn,
  formatClockish,
  formatDuration,
  formatSigned,
  isoWeekNumber,
  isoWeekday,
  monthDays,
  rangeDays,
  startOfWeek,
  weekDays,
  weekKey,
} from './time';

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
      '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10',
      '2026-09-11', '2026-09-12', '2026-09-13',
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
      '2026-09-07', '2026-09-08', '2026-09-09',
    ]);
  });
});
