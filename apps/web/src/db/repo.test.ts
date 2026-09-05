import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { WorkPulseDB } from './db';
import {
  addEntry,
  clearRangeStatus,
  entriesOf,
  exportBackup,
  importBackup,
  loadSettings,
  resetDay,
  saveSettings,
  setRangeStatus,
  updateEntryTime,
  upsertDay,
  wipeAll,
} from './repo';
import { atTimeOn, weeklyMinutes, workingWeekdays } from '@workpulse/core';

const D = '2026-09-07';
let base: WorkPulseDB;
let n = 0;

beforeEach(async () => {
  base = new WorkPulseDB(`workpulse-test-${n++}`);
  await base.open();
});

describe('stockage local', () => {
  it('renvoie les réglages par défaut quand rien n’est enregistré', async () => {
    const s = await loadSettings(base);
    expect(weeklyMinutes(s)).toBe(2100);
    expect(workingWeekdays(s)).toEqual([1, 2, 3, 4, 5]);
    expect(s.minBreakMinutes).toBe(30);
  });

  it('fusionne les réglages partiels avec les valeurs par défaut', async () => {
    await saveSettings({ dailyMinutes: 480 }, base);
    const s = await loadSettings(base);
    expect(s.dailyMinutes).toBe(480);
    expect(s.overtimeCapMinutes).toBe(240);
    expect(s.notifications.repeatMinutes).toBe(5);
  });

  it('enregistre et relit les pointages du jour, triés', async () => {
    await addEntry({ date: D, type: 'CLOCK_OUT', at: atTimeOn(D, '17:00') }, base);
    await addEntry({ date: D, type: 'CLOCK_IN', at: atTimeOn(D, '08:00') }, base);
    const list = await entriesOf(D, base);
    expect(list.map((e) => e.type)).toEqual(['CLOCK_IN', 'CLOCK_OUT']);
  });

  it('garde une trace de l’heure d’origine lors d’une correction', async () => {
    const e = await addEntry({ date: D, type: 'CLOCK_IN', at: atTimeOn(D, '08:30') }, base);
    await updateEntryTime(e.id, atTimeOn(D, '08:02'), base);
    const [saved] = await entriesOf(D, base);
    expect(saved.at).toBe(atTimeOn(D, '08:02'));
    expect(saved.originalAt).toBe(atTimeOn(D, '08:30'));
    expect(saved.manual).toBe(true);
    expect(saved.editedAt).toBeGreaterThan(0);
  });

  it('pose un statut sur une plage de journées puis le retire', async () => {
    const dates = ['2026-09-14', '2026-09-15', '2026-09-16'];
    await setRangeStatus(dates, { status: 'LEAVE' }, base);
    expect((await base.days.toArray()).map((d) => d.status)).toEqual(['LEAVE', 'LEAVE', 'LEAVE']);
    await clearRangeStatus(dates, base);
    expect(await base.days.count()).toBe(0);
  });

  it('met à jour une journée sans écraser les champs existants', async () => {
    await upsertDay(D, { status: 'HOLIDAY' }, base);
    await upsertDay(D, { worksOnHoliday: true }, base);
    const day = await base.days.get(D);
    expect(day?.status).toBe('HOLIDAY');
    expect(day?.worksOnHoliday).toBe(true);
    await resetDay(D, base);
    expect(await base.days.get(D)).toBeUndefined();
  });

  it('exporte puis réimporte une sauvegarde complète', async () => {
    await saveSettings({ userName: 'Erwann' }, base);
    await addEntry({ date: D, type: 'CLOCK_IN', at: atTimeOn(D, '08:00') }, base);
    await upsertDay('2026-09-08', { status: 'RTT' }, base);
    const backup = await exportBackup(base);

    await wipeAll(base);
    expect(await base.entries.count()).toBe(0);

    await importBackup(backup, base);
    expect(await base.entries.count()).toBe(1);
    expect((await loadSettings(base)).userName).toBe('Erwann');
    expect((await base.days.get('2026-09-08'))?.status).toBe('RTT');
  });

  it('refuse un fichier de sauvegarde étranger', async () => {
    await expect(importBackup({ app: 'autre' } as never, base)).rejects.toThrow(/non reconnu/);
  });
});

describe('sauvegardes hostiles', () => {
  const valide = {
    app: 'workpulse',
    version: 1,
    exportedAt: '2026-09-05T00:00:00.000Z',
    settings: {},
    days: [],
    entries: [],
  };

  it('refuse un fichier qui n’est pas une sauvegarde', async () => {
    for (const brut of [null, 42, 'texte', [], { app: 'autre' }, {}]) {
      await expect(importBackup(brut, base)).rejects.toThrow(/non reconnu/);
    }
  });

  it('n’applique pas une pollution de prototype cachée dans les réglages', async () => {
    const hostile = JSON.parse(
      '{"app":"workpulse","settings":{"__proto__":{"pirate":true}},"days":[],"entries":[]}',
    );
    await importBackup(hostile, base);
    expect(({} as Record<string, unknown>).pirate).toBeUndefined();
  });

  it('refuse des réglages démesurés', async () => {
    const settings: Record<string, number> = {};
    for (let i = 0; i < 600; i++) settings[`k${i}`] = i;
    await expect(importBackup({ ...valide, settings }, base)).rejects.toThrow(/illisibles/);
  });

  it('refuse un pointage sans type connu', async () => {
    const entries = [{ id: 'a', date: '2026-09-07', type: 'DROP_TABLE', at: 1 }];
    await expect(importBackup({ ...valide, entries }, base)).rejects.toThrow(/type inconnu/);
  });

  it('refuse une date malformée', async () => {
    const entries = [{ id: 'a', date: "'; DROP TABLE--", type: 'CLOCK_IN', at: 1 }];
    await expect(importBackup({ ...valide, entries }, base)).rejects.toThrow(/date invalide/);
    const days = [{ date: '../../etc/passwd', status: 'LEAVE', updatedAt: 1 }];
    await expect(importBackup({ ...valide, days }, base)).rejects.toThrow(/date invalide/);
  });

  it('refuse un horodatage non numérique', async () => {
    const entries = [{ id: 'a', date: '2026-09-07', type: 'CLOCK_IN', at: 'maintenant' }];
    await expect(importBackup({ ...valide, entries }, base)).rejects.toThrow(/horodatage/);
  });

  it('refuse une structure qui n’est pas une liste', async () => {
    await expect(importBackup({ ...valide, entries: { 0: {} } }, base)).rejects.toThrow(
      /Structure/,
    );
  });

  it('tronque une note démesurée au lieu de la stocker entière', async () => {
    const days = [{ date: '2026-09-07', status: 'LEAVE', notes: 'x'.repeat(9000), updatedAt: 1 }];
    await importBackup({ ...valide, days }, base);
    expect((await base.days.get('2026-09-07'))?.notes).toHaveLength(2000);
  });

  it('ne conserve que les champs qu’elle connaît', async () => {
    const entries = [
      {
        id: 'a',
        date: '2026-09-07',
        type: 'CLOCK_IN',
        at: 1,
        manual: 'oui',
        champInvente: 'ignoré',
      },
    ];
    await importBackup({ ...valide, entries }, base);
    const [enregistre] = await base.entries.toArray();
    expect(enregistre).not.toHaveProperty('champInvente');
    expect(enregistre.manual).toBe(false);
  });

  it('restaure une sauvegarde légitime sans rien perdre', async () => {
    await importBackup(
      {
        ...valide,
        settings: { userName: 'Erwann' },
        entries: [{ id: 'a', date: '2026-09-07', type: 'CLOCK_IN', at: 1, manual: true }],
        days: [{ date: '2026-09-08', status: 'RTT', updatedAt: 2 }],
      },
      base,
    );
    expect((await loadSettings(base)).userName).toBe('Erwann');
    expect(await base.entries.count()).toBe(1);
    expect((await base.days.get('2026-09-08'))?.status).toBe('RTT');
  });
});
