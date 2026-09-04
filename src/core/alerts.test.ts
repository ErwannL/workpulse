import { describe, expect, it } from 'vitest';
import { dismiss, dueAlert, emptyMemory, memoryForDay, shouldNotify, snooze } from './alerts';
import { computePulse } from './engine';
import { DEFAULT_SETTINGS } from './settings';
import { atTimeOn, weekDays } from './time';
import { entry, fullDay, makeSource, workDay } from './testing';

const MON = '2026-09-07';
const FRI = '2026-09-11';
const S = DEFAULT_SETTINGS;

function pulseAt(hhmm: string, entries = [], days = [], date = MON) {
  const now = atTimeOn(date, hhmm);
  return computePulse(makeSource({ now, entries, days }));
}

describe('alertes', () => {
  it('rien à signaler avant l’heure de début', () => {
    expect(dueAlert(pulseAt('07:45'), S, emptyMemory(MON))).toBeNull();
  });

  it('réclame le pointage d’arrivée à partir de 08:00', () => {
    const a = dueAlert(pulseAt('08:00'), S, emptyMemory(MON));
    expect(a?.kind).toBe('DAY_START');
    expect(a?.action).toBe('CLOCK_IN');
  });

  it('se tait une fois l’arrivée pointée', () => {
    const p = pulseAt('08:30', [entry(MON, 'CLOCK_IN', '08:02')] as never);
    expect(dueAlert(p, S, emptyMemory(MON))).toBeNull();
  });

  it('reste silencieuse un jour de congé', () => {
    const p = pulseAt('09:00', [] as never, [workDay(MON, { status: 'LEAVE' })] as never);
    expect(dueAlert(p, S, emptyMemory(MON))).toBeNull();
  });

  it('propose la pause déjeuner à midi', () => {
    const p = pulseAt('12:00', [entry(MON, 'CLOCK_IN', '08:00')] as never);
    expect(dueAlert(p, S, emptyMemory(MON))?.kind).toBe('LUNCH_START');
  });

  it('ne propose pas la reprise tant que la pause minimale n’est pas écoulée', () => {
    const entries = [entry(MON, 'CLOCK_IN', '08:00'), entry(MON, 'BREAK_START', '12:50')] as never;
    expect(dueAlert(pulseAt('13:05', entries), S, emptyMemory(MON))).toBeNull();
    expect(dueAlert(pulseAt('13:25', entries), S, emptyMemory(MON))?.kind).toBe('LUNCH_END');
  });

  it('annonce le départ dès que les heures sont faites, avant 17h', () => {
    const entries = [
      entry(MON, 'CLOCK_IN', '08:00'),
      entry(MON, 'BREAK_START', '12:00'),
      entry(MON, 'BREAK_END', '13:00'),
    ] as never;
    const a = dueAlert(pulseAt('16:05', entries), S, emptyMemory(MON));
    expect(a?.kind).toBe('CAN_LEAVE');
    expect(a?.title).toBe('Tu as fait tes heures');
  });

  it('à 17h, dit combien de temps il reste quand l’objectif n’est pas atteint', () => {
    const entries = [
      entry(MON, 'CLOCK_IN', '09:30'),
      entry(MON, 'BREAK_START', '12:00'),
      entry(MON, 'BREAK_END', '13:00'),
    ] as never;
    const a = dueAlert(pulseAt('17:00', entries), S, emptyMemory(MON));
    expect(a?.kind).toBe('DAY_END');
    expect(a?.title).toContain('Il te reste');
  });

  it('à 17h, invite à rentrer quand l’avance couvre la journée', () => {
    // Lundi → jeudi à 8 h : +4 h d'avance. Vendredi, 4 h suffisent.
    const entries = [
      ...weekDays(MON).slice(0, 4).flatMap((d) => fullDay(d, '17:00')),
      entry(FRI, 'CLOCK_IN', '13:00'),
    ] as never;
    const a = dueAlert(pulseAt('17:00', entries, [] as never, FRI), S, emptyMemory(FRI));
    expect(a?.emoji).toBe('🏠');
    expect(a?.action).toBe('CLOCK_OUT');
  });

  it('le dépassement du plafond passe avant tout le reste', () => {
    const entries = [
      ...weekDays(MON).slice(0, 4).flatMap((d) => fullDay(d, '19:00')),
      entry(FRI, 'CLOCK_IN', '08:00'),
    ] as never;
    const a = dueAlert(pulseAt('10:00', entries, [] as never, FRI), S, emptyMemory(FRI));
    expect(a?.kind).toBe('OVERTIME');
    expect(a?.snoozable).toBe(false);
  });

  it('respecte un report de 30 minutes', () => {
    const now = atTimeOn(MON, '08:00');
    const memory = snooze(emptyMemory(MON), 'DAY_START', 30, now);
    expect(dueAlert(pulseAt('08:15'), S, memory, atTimeOn(MON, '08:15'))).toBeNull();
    expect(dueAlert(pulseAt('08:30'), S, memory, atTimeOn(MON, '08:30'))?.kind).toBe('DAY_START');
  });

  it('respecte une alerte ignorée pour la journée', () => {
    const memory = dismiss(emptyMemory(MON), 'DAY_START');
    expect(dueAlert(pulseAt('09:30'), S, memory)).toBeNull();
  });

  it('respecte les interrupteurs des réglages', () => {
    const off = { ...S, notifications: { ...S.notifications, dayStart: false } };
    expect(dueAlert(pulseAt('08:10'), off, emptyMemory(MON))).toBeNull();
    const allOff = { ...S, notifications: { ...S.notifications, enabled: false } };
    expect(dueAlert(pulseAt('08:10'), allOff, emptyMemory(MON))).toBeNull();
  });

  it('repart de zéro à chaque nouvelle journée', () => {
    const memory = dismiss(emptyMemory(MON), 'DAY_START');
    expect(memoryForDay(memory, MON).dismissed).toEqual(['DAY_START']);
    expect(memoryForDay(memory, '2026-09-08').dismissed).toEqual([]);
  });

  it('espace les notifications système du délai de répétition', () => {
    const t = atTimeOn(MON, '08:00');
    expect(shouldNotify(undefined, S, t)).toBe(true);
    expect(shouldNotify(t, S, t + 2 * 60_000)).toBe(false);
    expect(shouldNotify(t, S, t + 5 * 60_000)).toBe(true);
  });
});
