import { describe, expect, it } from 'vitest';
import { easterSunday, holidayList, holidayName, isHoliday } from './holidays';

describe('jours fériés français', () => {
  it('calcule Pâques', () => {
    expect(easterSunday(2024)).toBe('2024-03-31');
    expect(easterSunday(2025)).toBe('2025-04-20');
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
  });

  it('déduit les fêtes mobiles de Pâques', () => {
    expect(holidayName('2026-04-06')).toBe('Lundi de Pâques');
    expect(holidayName('2026-05-14')).toBe('Ascension');
    expect(holidayName('2026-05-25')).toBe('Lundi de Pentecôte');
  });

  it('connaît les fêtes fixes', () => {
    expect(holidayName('2026-01-01')).toBe('Jour de l’an');
    expect(holidayName('2026-07-14')).toBe('Fête nationale');
    expect(holidayName('2026-12-25')).toBe('Noël');
    expect(holidayName('2026-09-07')).toBeNull();
    expect(isHoliday('2026-11-11')).toBe(true);
  });

  it('liste onze jours fériés par an, triés', () => {
    const list = holidayList(2026);
    expect(list).toHaveLength(11);
    expect(list.map((h) => h.date)).toEqual([...list.map((h) => h.date)].sort());
  });
});
