import { describe, expect, it } from 'vitest';
import { buildWeeks, carryInFor, periodStats, summarizeWeek } from './ledger.js';
import { atTimeOn, weekDays } from './time.js';
import { defaultWeekSchedule } from './schedule.js';
import { fullDay, makeSource, workDay } from './testing.js';

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
    const src = makeSource({
      now: atTimeOn('2026-07-20', '09:00'),
      settings: { trackingStart: '2026-07-13' },
    });
    const week = summarizeWeek(src, '2026-07-13', 0);
    expect(week.planned).toBe(4 * 420);
  });

  it('retire l’objectif des jours de congé', () => {
    const src = makeSource({
      now: atTimeOn(W2, '09:00'),
      days: [
        workDay('2026-09-10', { status: 'LEAVE' }),
        workDay('2026-09-11', { status: 'LEAVE' }),
      ],
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
      ...weekDays(W1)
        .slice(0, 4)
        .flatMap((d) => fullDay(d, '16:00')),
      ...fullDay('2026-09-11', '19:00'),
    ];
    const src = makeSource({
      now: atTimeOn(W3, '09:00'),
      settings: { trackingStart: W1 },
      entries,
    });
    const w1 = summarizeWeek(src, W1, 0);
    expect(Math.round(w1.difference)).toBe(180);
    expect(Math.round(carryInFor(src, W2))).toBe(180);
  });

  it('reporte aussi un solde négatif', () => {
    const entries = weekDays(W1)
      .slice(0, 5)
      .flatMap((d) => fullDay(d, '15:42'));
    const src = makeSource({
      now: atTimeOn(W2, '09:00'),
      settings: { trackingStart: W1 },
      entries,
    });
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
    const src = makeSource({
      now: atTimeOn(W3, '09:00'),
      settings: { trackingStart: W1 },
      entries,
    });
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
    // Le mois est entièrement écoulé : objectif total et objectif à ce jour coïncident.
    expect(stats.plannedMinutesElapsed).toBe(stats.plannedMinutes);
  });
});

describe('statistiques — cas restants', () => {
  it('compte séparément fériés, congés et absences déclarées', () => {
    const src = makeSource({
      now: atTimeOn('2026-08-01', '09:00'),
      settings: { trackingStart: '2026-07-01' },
      days: [
        workDay('2026-07-15', { status: 'SPECIAL' }),
        workDay('2026-07-16', { status: 'OTHER' }),
        workDay('2026-07-17', { status: 'REMOTE' }),
      ],
    });
    const stats = periodStats(src, '2026-07-01', '2026-07-31');
    // Le 14 juillet est férié, les deux journées déclarées sont des absences,
    // le télétravail reste une journée de travail.
    expect(stats.holidayDays).toBe(1);
    expect(stats.absenceDays).toBe(2);
    expect(stats.leaveDays).toBe(0);
  });

  it('n’enregistre aucune absence pour un week-end non annoté', () => {
    const src = makeSource({
      now: atTimeOn('2026-09-21', '09:00'),
      settings: { trackingStart: W1 },
    });
    expect(periodStats(src, W1, '2026-09-13').absenceDays).toBe(0);
  });
});

describe('mémoire du report', () => {
  const entriesW1 = weekDays(W1)
    .slice(0, 5)
    .flatMap((d) => fullDay(d, '17:00'));

  it('rend le même résultat au deuxième appel', () => {
    const src = makeSource({
      now: atTimeOn(W3, '09:00'),
      settings: { trackingStart: W1 },
      entries: entriesW1,
    });
    const premier = carryInFor(src, W2);
    expect(carryInFor(src, W2)).toBe(premier);
    // Cinq journées de 8 h contre 35 h dues : +5 h reportées sur la semaine 2.
    expect(Math.round(premier)).toBe(300);
  });

  it('oublie tout dès que les pointages changent', () => {
    const settings = { trackingStart: W1 };
    const avant = makeSource({ now: atTimeOn(W3, '09:00'), settings, entries: entriesW1 });
    // La semaine 2 est restée vide : elle pèse −35 h dans le report.
    expect(Math.round(carryInFor(avant, W3))).toBe(300 - 2100);

    // Nouvelle collection de pointages : le report doit être recalculé.
    const apres = makeSource({
      now: atTimeOn(W3, '09:00'),
      settings,
      entries: [
        ...entriesW1,
        ...weekDays(W2)
          .slice(0, 5)
          .flatMap((d) => fullDay(d, '18:00')),
      ],
    });
    expect(Math.round(carryInFor(apres, W3))).toBe(300 + 5 * 120);
  });

  it('oublie tout dès qu’une journée est annotée', () => {
    const settings = { trackingStart: W1 };
    const avant = makeSource({ now: atTimeOn(W3, '09:00'), settings, entries: entriesW1 });
    const reference = carryInFor(avant, W2);

    const apres: typeof avant = {
      ...avant,
      days: new Map([[W1, workDay(W1, { status: 'LEAVE' })]]),
    };
    // Le lundi devient un congé : son objectif disparaît, le solde monte.
    expect(carryInFor(apres, W2)).toBe(reference + 420);
  });

  it('oublie tout dès que les réglages changent', () => {
    const avant = makeSource({
      now: atTimeOn(W3, '09:00'),
      settings: { trackingStart: W1 },
      entries: entriesW1,
    });
    const apres: typeof avant = {
      ...avant,
      settings: { ...avant.settings, dailyMinutes: 480, week: defaultWeekSchedule(480) },
    };
    expect(carryInFor(apres, W2)).toBeLessThan(carryInFor(avant, W2));
  });

  it('distingue deux semaines cibles', () => {
    const src = makeSource({
      now: atTimeOn(W3, '09:00'),
      settings: { trackingStart: W1 },
      entries: entriesW1,
    });
    expect(carryInFor(src, W1)).toBe(0);
    expect(Math.round(carryInFor(src, W2))).toBe(300);
    expect(Math.round(carryInFor(src, W3))).toBe(300 - 2100);
  });

  it('recalcule au passage de minuit', () => {
    const entries = weekDays(W1)
      .slice(0, 5)
      .flatMap((d) => fullDay(d, '17:00'));
    const settings = { trackingStart: W1 };

    // Mardi : seuls lundi et mardi sont écoulés.
    const mardi = makeSource({ now: atTimeOn('2026-09-08', '20:00'), settings, entries });
    const depuisMardi = summarizeWeek(mardi, W1, carryInFor(mardi, W1)).plannedElapsed;

    // Mercredi : la même source de données, une journée de plus écoulée.
    const mercredi = { ...mardi, now: atTimeOn('2026-09-09', '20:00') };
    const depuisMercredi = summarizeWeek(mercredi, W1, carryInFor(mercredi, W1)).plannedElapsed;

    expect(depuisMercredi).toBe(depuisMardi + 420);
  });
});
