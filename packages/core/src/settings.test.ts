import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings } from './settings.js';

describe('mergeSettings', () => {
  it('renvoie une copie des valeurs par défaut sans réglage enregistré', () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(undefined)).not.toBe(DEFAULT_SETTINGS);
  });

  it('complète un réglage partiel', () => {
    const merged = mergeSettings({ dailyMinutes: 480 });
    expect(merged.dailyMinutes).toBe(480);
    expect(merged.weeklyMinutes).toBe(DEFAULT_SETTINGS.weeklyMinutes);
    expect(merged.notifications).toEqual(DEFAULT_SETTINGS.notifications);
  });

  it('complète les notifications champ par champ', () => {
    const merged = mergeSettings({ notifications: { enabled: false } as never });
    expect(merged.notifications.enabled).toBe(false);
    expect(merged.notifications.repeatMinutes).toBe(5);
  });

  it('retombe sur les jours par défaut si la liste est vide', () => {
    expect(mergeSettings({ workDays: [] }).workDays).toEqual([1, 2, 3, 4, 5]);
    expect(mergeSettings({ workDays: [1, 3] }).workDays).toEqual([1, 3]);
  });

  it('ne partage jamais le tableau des jours avec les valeurs par défaut', () => {
    const merged = mergeSettings({ workDays: [1] });
    merged.workDays.push(2);
    expect(DEFAULT_SETTINGS.workDays).toEqual([1, 2, 3, 4, 5]);
  });
});
