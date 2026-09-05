import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings } from './settings.js';
import { weeklyMinutes, workingWeekdays } from './schedule.js';

describe('mergeSettings', () => {
  it('renvoie une copie des valeurs par défaut sans réglage enregistré', () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(undefined).week).not.toBe(DEFAULT_SETTINGS.week);
  });

  it('propose une semaine de cinq journées complètes', () => {
    const settings = mergeSettings(undefined);
    expect(workingWeekdays(settings)).toEqual([1, 2, 3, 4, 5]);
    expect(weeklyMinutes(settings)).toBe(2100);
  });

  it('complète un réglage partiel', () => {
    const merged = mergeSettings({ overtimeCapMinutes: 120 });
    expect(merged.overtimeCapMinutes).toBe(120);
    expect(merged.dailyMinutes).toBe(420);
    expect(merged.notifications).toEqual(DEFAULT_SETTINGS.notifications);
  });

  it('complète les notifications champ par champ', () => {
    const merged = mergeSettings({ notifications: { enabled: false } as never });
    expect(merged.notifications.enabled).toBe(false);
    expect(merged.notifications.repeatMinutes).toBe(5);
  });

  it('conserve une semaine type déjà enregistrée', () => {
    const base = mergeSettings(undefined);
    base.week[5] = { pattern: 'MORNING', minutes: 210, start: '08:00', end: '12:00' };
    const merged = mergeSettings(base);
    expect(merged.week[5].pattern).toBe('MORNING');
    expect(weeklyMinutes(merged)).toBe(4 * 420 + 210);
  });

  it('complète une semaine incomplète par des journées non travaillées', () => {
    const merged = mergeSettings({
      week: { 1: { pattern: 'FULL', minutes: 420, start: '08:00', end: '17:00' } },
    });
    expect(workingWeekdays(merged)).toEqual([1]);
    expect(merged.week[6].minutes).toBe(0);
  });
});

describe('migration des réglages antérieurs', () => {
  it('reconstruit la semaine type à partir des anciens jours travaillés', () => {
    const merged = mergeSettings({
      workDays: [1, 3, 5],
      refStart: '09:00',
      refEnd: '18:00',
      refBreakStart: '12:30',
      refBreakEnd: '13:30',
    } as never);

    expect(workingWeekdays(merged)).toEqual([1, 3, 5]);
    expect(merged.week[1].start).toBe('09:00');
    expect(merged.week[1].end).toBe('18:00');
    expect(merged.week[1].breakStart).toBe('12:30');
    expect(merged.week[2].minutes).toBe(0);
    expect(weeklyMinutes(merged)).toBe(3 * 420);
  });

  it('conserve les cinq jours ouvrés quand seuls les horaires sont hérités', () => {
    // Une sauvegarde ancienne peut porter les horaires sans la liste des jours.
    const merged = mergeSettings({ refStart: '07:30' } as never);
    expect(workingWeekdays(merged)).toEqual([1, 2, 3, 4, 5]);
    expect(merged.week[1].start).toBe('07:30');
  });

  it('ignore une semaine enregistrée vide et repart de la semaine type', () => {
    expect(workingWeekdays(mergeSettings({ week: {} }))).toEqual([1, 2, 3, 4, 5]);
  });
});
