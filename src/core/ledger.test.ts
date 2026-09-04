import { describe, expect, it } from 'vitest';
import { buildWeeks, carryInFor, periodStats, summarizeWeek } from './ledger';
import { atTimeOn, weekDays } from './time';
import { fullDay, makeSource, workDay } from './testing';

const W1 = '2026-09-07'; // lundi
const W2 = '2026-09-14';
const W3 = '2026-09-21';

/** 5 journées de 7 h du lundi au vendredi de la semaine donnée. */
function normalWeek(monday: string, end = '16:00') {
  return weekDays(monday)
    .slice(0, 5)
    .flatMap((d) => fullDay(d, end));
}

describe('semaine', () => {
  it('atteint pile l’objectif avec cinq journées de 7 h', () => {
    const src = makeSource({ now: atTimeOn(W2, '09:00'), entries: normalWeek(W1) });
    const week = summarizeWeek(src, W1, 0);
    expect(week.planned).toBe(2100);
    expect(Math.round(week.worked)).toBe(2100);
    expect(Math.round(week.difference)).toBe(0);
    expect(week.remainingToTarget).toBe(0);
    expect(week.overtime).toBe(0);
    expect(week.complete).toBe(true);
  });

  it('retire l’objectif d’un jour férié', () => {
    // 14 juillet 2026 : un mardi.
    const src = makeSource({ now: atTimeOn('2026-07-20', '09:00') });
    const week = summarizeWeek(src, '2026-07-13', 0);
    expect(week.planned).toBe(4 * 420);
  });

  it('retire l’objectif des jours de congé', () => {
    const src = makeSource({
      now: atTimeOn(W2, '09:00'),
      days: [workDay('2026-09-10', { status: 'LEAVE' }), workDay('2026-09-11', { status: 'LEAVE' })],
      entries: normalWeek(W1),
    });
    const week = summarizeWeek(src, W1, 0);
    expect(week.planned).toBe(3 * 420);
    expect(Math.round(week.difference)).toBe(2 * 420); // les deux jours ont été travaillés quand même
  });

  it('distingue l’objectif total de l’objectif écoulé', () => {
    // Mercredi 09h : lundi et mardi sont écoulés, aujourd'hui compte, jeudi et vendredi non.
    const src = makeSource({ now: atTimeOn('2026-09-09', '09:00'), entries: normalWeek(W1) });
    const week = summarizeWeek(src, W1, 0);
    expect(week.planned).toBe(2100);
    expect(week.plannedElapsed).toBe(3 * 420);
  });

  it('signale le dépassement du plafond d’heures supplémentaires', () => {
    const src = makeSource({ now: atTimeOn(W2, '09:00'), entries: normalWeek(W1, '17:30') });
    const week = summarizeWeek(src, W1, 0);
    expect(Math.round(week.overtime)).toBe(5 * 90); // +1h30 par jour
    expect(week.overtimeExceeded).toBe(true);
  });
});

describe('report du solde', () => {
  it('reporte le solde de la semaine 1 sur la semaine 2', () => {
    // 4 journées de 7 h + une de 10 h = 38 h, soit +3 h.
    const entries = [
      ...weekDays(W1).slice(0, 4).flatMap((d) => fullDay(d, '16:00')),
      ...fullDay('2026-09-11', '19:00'),
    ];
    const src = makeSource({ now: atTimeOn(W3, '09:00'), settings: { trackingStart: W1 }, entries });
    const w1 = summarizeWeek(src, W1, 0);
    expect(Math.round(w1.difference)).toBe(180);
    expect(Math.round(carryInFor(src, W2))).toBe(180);
  });

  it('reporte aussi un solde négatif', () => {
    const entries = weekDays(W1).slice(0, 5).flatMap((d) => fullDay(d, '15:42'));
    const src = makeSource({ now: atTimeOn(W2, '09:00'), settings: { trackingStart: W1 }, entries });
    expect(Math.round(carryInFor(src, W2))).toBe(-90); // 18 min manquantes × 5
  });

  it('cumule le report sur plusieurs semaines et part du solde initial', () => {
    const entries = [...normalWeek(W1, '17:00'), ...normalWeek(W2, '17:00')]; // 8 h/jour
    const src = makeSource({
      now: atTimeOn(W3, '09:00'),
      settings: { trackingStart: W1, initialBalance: 60 },
      entries,
    });
    // 60 (initial) + 5×60 (S1) + 5×60 (S2)
    expect(Math.round(carryInFor(src, W3))).toBe(60 + 300 + 300);
  });

  it('chaîne les semaines, chacune héritant de la précédente', () => {
    const entries = [...normalWeek(W1, '17:00'), ...normalWeek(W2, '16:00')];
    const src = makeSource({ now: atTimeOn(W3, '09:00'), settings: { trackingStart: W1 }, entries });
    const weeks = buildWeeks(src, W1, W2);
    expect(weeks).toHaveLength(2);
    expect(Math.round(weeks[0].carryIn)).toBe(0);
    expect(Math.round(weeks[0].carryOut)).toBe(300);
    expect(Math.round(weeks[1].carryIn)).toBe(300);
    expect(Math.round(weeks[1].carryOut)).toBe(300);
  });
});

describe('statistiques de période', () => {
  it('compte les jours ouvrés, travaillés, fériés et posés', () => {
    const src = makeSource({
      now: atTimeOn('2026-10-01', '09:00'),
      settings: { trackingStart: '2026-09-01' },
      days: [
        workDay('2026-09-14', { status: 'LEAVE' }),
        workDay('2026-09-15', { status: 'LEAVE' }),
        workDay('2026-09-16', { status: 'SICK' }),
      ],
      entries: [...normalWeek(W1), ...normalWeek(W3)],
    });
    const stats = periodStats(src, '2026-09-01', '2026-09-30');
    expect(stats.workedDays).toBe(10);
    expect(stats.leaveDays).toBe(2);
    expect(stats.absenceDays).toBe(1);
    expect(stats.holidayDays).toBe(0);
    expect(Math.round(stats.workedMinutes)).toBe(10 * 420);
  });
});
