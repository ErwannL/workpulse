import { describe, expect, it } from 'vitest';
import { dismiss, dueAlert, emptyMemory, memoryForDay, shouldNotify, snooze } from './alerts.js';
import { computePulse } from './engine.js';
import { DEFAULT_SETTINGS, mergeSettings } from './settings.js';
import { scheduleFromPattern } from './schedule.js';
import { atTimeOn, weekDays } from './time.js';
import { entry, fullDay, makeSource, workDay } from './testing.js';

const MON = '2026-09-07';
const TUE = '2026-09-08';
const WED = '2026-09-09';
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
      ...weekDays(MON)
        .slice(0, 4)
        .flatMap((d) => fullDay(d, '17:00')),
      entry(FRI, 'CLOCK_IN', '13:00'),
    ] as never;
    const a = dueAlert(pulseAt('17:00', entries, [] as never, FRI), S, emptyMemory(FRI));
    expect(a?.emoji).toBe('🏠');
    expect(a?.action).toBe('CLOCK_OUT');
  });

  it('le dépassement du plafond passe avant tout le reste', () => {
    const entries = [
      ...weekDays(MON)
        .slice(0, 4)
        .flatMap((d) => fullDay(d, '19:00')),
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

describe('alertes — cas restants', () => {
  it('ignorer deux fois ne duplique rien', () => {
    const once = dismiss(emptyMemory(MON), 'DAY_START');
    expect(dismiss(once, 'DAY_START')).toBe(once);
  });

  it('à 17h, dit que l’avance couvre le retard du jour', () => {
    // Lundi → jeudi à 9 h : +8 h d'avance. Vendredi, deux heures suffisent.
    const entries = [
      ...weekDays(MON)
        .slice(0, 4)
        .flatMap((d) => fullDay(d, '18:00')),
      entry(FRI, 'CLOCK_IN', '15:00'),
    ] as never;
    const alert = dueAlert(
      pulseAt('17:00', entries, [] as never, FRI),
      { ...S, notifications: { ...S.notifications, enabled: true } },
      emptyMemory(FRI),
    );
    expect(alert?.body).toBe('Ton avance couvre le retard d’aujourd’hui.');
  });
});

describe('alertes — formulation de fin de journée', () => {
  it('à 17h, rappelle le total du jour quand il n’y a pas d’avance', () => {
    const entries = [
      entry(MON, 'CLOCK_IN', '08:00'),
      entry(MON, 'BREAK_START', '12:00'),
      entry(MON, 'BREAK_END', '13:00'),
    ] as never;
    const alert = dueAlert(pulseAt('17:00', entries), S, emptyMemory(MON));
    expect(alert?.kind).toBe('DAY_END');
    expect(alert?.body).toMatch(/aujourd’hui, solde/);
  });
});

describe('alertes et demi-journées', () => {
  const morningFriday = () => {
    const settings = mergeSettings({ trackingStart: MON });
    settings.week[5] = scheduleFromPattern('MORNING', 420);
    return settings;
  };

  function pulseWith(
    settings: ReturnType<typeof morningFriday>,
    hhmm: string,
    entries: never[],
    date = FRI,
  ) {
    return computePulse(makeSource({ now: atTimeOn(date, hhmm), settings, entries }));
  }

  it('ne propose jamais la pause déjeuner sur une matinée', () => {
    const settings = morningFriday();
    const entries = [entry(FRI, 'CLOCK_IN', '08:00')] as never;
    const alert = dueAlert(pulseWith(settings, '12:30', entries), settings, emptyMemory(FRI));
    expect(alert?.kind).not.toBe('LUNCH_START');
  });

  it('réclame l’arrivée à l’heure de la demi-journée, pas à 08:00', () => {
    const settings = mergeSettings({ trackingStart: MON });
    settings.week[1] = scheduleFromPattern('AFTERNOON', 420);

    expect(
      dueAlert(pulseWith(settings, '09:00', [] as never, MON), settings, emptyMemory(MON)),
    ).toBeNull();

    const alert = dueAlert(
      pulseWith(settings, '13:10', [] as never, MON),
      settings,
      emptyMemory(MON),
    );
    expect(alert?.kind).toBe('DAY_START');
    expect(alert?.body).toContain('13:00');
  });

  it('annonce la fin de journée à midi pour une matinée', () => {
    const settings = morningFriday();
    const entries = [
      ...[MON, TUE, WED, '2026-09-10'].flatMap((d) => fullDay(d, '16:00')),
      entry(FRI, 'CLOCK_IN', '08:00'),
    ] as never;
    const alert = dueAlert(pulseWith(settings, '12:00', entries), settings, emptyMemory(FRI));
    expect(alert?.kind).toBe('DAY_END');
    expect(alert?.emoji).toBe('🏠');
  });
});
