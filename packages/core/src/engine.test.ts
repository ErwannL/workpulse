import { describe, expect, it } from 'vitest';
import { computePulse, pulseSentence } from './engine.js';
import { evaluateBreak } from './breakRules.js';
import { DEFAULT_SETTINGS } from './settings.js';
import { atTimeOn, clock, weekDays } from './time.js';
import { entry, fullDay, makeSource, workDay } from './testing.js';

const MON = '2026-09-07';
const TUE = '2026-09-08';
const WED = '2026-09-09';
const FRI = '2026-09-11';

function weekTo(lastDay: string, end = '16:00') {
  return weekDays(MON)
    .filter((d) => d < lastDay)
    .flatMap((d) => fullDay(d, end));
}

describe('moteur de décision', () => {
  it('NOT_STARTED avant le premier pointage', () => {
    const p = computePulse(makeSource({ now: atTimeOn(MON, '08:15') }));
    expect(p.state).toBe('NOT_STARTED');
    expect(p.phase).toBe('NOT_STARTED');
    expect(p.leaveAt).toBeNull();
  });

  it('WORKING et temps restant décroissant', () => {
    const src = makeSource({
      now: atTimeOn(MON, '13:42'),
      entries: [
        entry(MON, 'CLOCK_IN', '08:00'),
        entry(MON, 'BREAK_START', '12:00'),
        entry(MON, 'BREAK_END', '13:00'),
      ],
    });
    const p = computePulse(src);
    expect(p.state).toBe('WORKING');
    expect(Math.round(p.day.worked)).toBe(282); // 4h42
    expect(Math.round(p.remainingToday)).toBe(138); // 2h18
    expect(clock(p.leaveAt!)).toBe('16:00');
  });

  it('BREAK pendant la pause déjeuner', () => {
    const src = makeSource({
      now: atTimeOn(MON, '12:15'),
      entries: [entry(MON, 'CLOCK_IN', '08:00'), entry(MON, 'BREAK_START', '12:00')],
    });
    const p = computePulse(src);
    expect(p.state).toBe('BREAK');
    expect(p.breakVerdict?.allowed).toBe(false);
    expect(Math.round(p.breakVerdict!.remaining)).toBe(15);
    // Le départ recommandé intègre les 15 min de pause encore dues.
    expect(clock(p.leaveAt!)).toBe('15:30');
  });

  it('DAY_COMPLETE quand les heures du jour sont faites', () => {
    const src = makeSource({
      now: atTimeOn(MON, '16:05'),
      entries: [
        entry(MON, 'CLOCK_IN', '08:00'),
        entry(MON, 'BREAK_START', '12:00'),
        entry(MON, 'BREAK_END', '13:00'),
      ],
    });
    const p = computePulse(src);
    expect(p.state).toBe('DAY_COMPLETE');
    expect(p.canLeave).toBe(true);
    expect(p.headline).toBe('Tu as fait tes heures');
  });

  it('l’avance de la semaine couvre la journée : il est 14h et on peut rentrer', () => {
    // Lundi → jeudi à 9 h par jour, soit +2 h par jour = +8 h d'avance.
    const src = makeSource({
      now: atTimeOn(FRI, '14:00'),
      entries: [
        ...weekDays(MON)
          .slice(0, 4)
          .flatMap((d) => fullDay(d, '18:00')),
        entry(FRI, 'CLOCK_IN', '08:00'),
        entry(FRI, 'BREAK_START', '12:00'),
        entry(FRI, 'BREAK_END', '13:00'),
      ],
    });
    const p = computePulse(src);
    expect(Math.round(p.advanceBeforeToday)).toBe(4 * 120);
    expect(p.requiredToday).toBe(0);
    expect(p.remainingToday).toBe(0);
    expect(p.canLeave).toBe(true);
    expect(['DAY_COMPLETE', 'WEEK_COMPLETE', 'OVERTIME_LIMIT_REACHED']).toContain(p.state);
  });

  it('le retard de la semaine alourdit l’objectif du jour', () => {
    // Lundi et mardi à 6 h : −1 h par jour.
    const src = makeSource({
      now: atTimeOn(WED, '09:00'),
      entries: [
        ...fullDay(MON, '15:00'),
        ...fullDay(TUE, '15:00'),
        entry(WED, 'CLOCK_IN', '08:00'),
      ],
    });
    const p = computePulse(src);
    expect(Math.round(p.advanceBeforeToday)).toBe(-120);
    expect(Math.round(p.requiredToday)).toBe(420 + 120);
    expect(p.trend).toBe('BEHIND');
  });

  it('ne demande jamais plus que le plafond d’heures supplémentaires', () => {
    const src = makeSource({
      now: atTimeOn(MON, '09:00'),
      settings: { initialBalance: -20 * 60, trackingStart: MON },
      entries: [entry(MON, 'CLOCK_IN', '08:00')],
    });
    const p = computePulse(src);
    expect(p.requiredToday).toBe(420 + DEFAULT_SETTINGS.overtimeCapMinutes);
  });

  it('WEEK_COMPLETE quand les 35 h sont atteintes', () => {
    const src = makeSource({
      now: atTimeOn(FRI, '16:12'),
      entries: [
        ...weekTo(FRI, '16:00'), // 4 × 7 h
        entry(FRI, 'CLOCK_IN', '08:00'),
        entry(FRI, 'BREAK_START', '12:00'),
        entry(FRI, 'BREAK_END', '13:00'),
      ],
    });
    const p = computePulse(src);
    expect(Math.round(p.week.worked)).toBe(2112);
    expect(p.state).toBe('WEEK_COMPLETE');
    expect(p.headline).toBe('Objectif de la semaine atteint');
  });

  it('OVERTIME_LIMIT_REACHED au-delà de +4 h', () => {
    const src = makeSource({
      now: atTimeOn(FRI, '18:30'),
      entries: [
        ...weekDays(MON)
          .slice(0, 5)
          .flatMap((d) => fullDay(d, '17:30')),
      ],
    });
    const p = computePulse(src);
    expect(p.state).toBe('OVERTIME_LIMIT_REACHED');
    expect(p.week.overtimeExceeded).toBe(true);
  });

  it('HOLIDAY un jour férié non travaillé', () => {
    const p = computePulse(makeSource({ now: atTimeOn('2026-07-14', '10:00') }));
    expect(p.state).toBe('HOLIDAY');
    expect(p.day.planned).toBe(0);
    expect(p.headline).toBe('Fête nationale');
  });

  it('un jour férié travaillé redevient une journée normale', () => {
    const src = makeSource({
      now: atTimeOn('2026-07-14', '10:00'),
      days: [workDay('2026-07-14', { status: 'HOLIDAY', worksOnHoliday: true })],
      entries: [entry('2026-07-14', 'CLOCK_IN', '08:00')],
    });
    const p = computePulse(src);
    expect(p.day.planned).toBe(420);
    expect(p.state).toBe('WORKING');
  });

  it('ABSENT un jour de congé', () => {
    const src = makeSource({
      now: atTimeOn(FRI, '10:00'),
      days: [workDay(FRI, { status: 'LEAVE' })],
    });
    const p = computePulse(src);
    expect(p.state).toBe('ABSENT');
    expect(p.headline).toBe('Congé');
  });

  it('un congé n’est pas une journée oubliée : le solde reste neutre', () => {
    const src = makeSource({
      now: atTimeOn('2026-09-12', '10:00'),
      days: [workDay(FRI, { status: 'LEAVE' })],
      entries: weekTo(FRI, '16:00'),
    });
    const p = computePulse(src, FRI);
    expect(p.week.planned).toBe(4 * 420);
    expect(Math.round(p.week.difference)).toBe(0);
  });

  it('ne compte pas comme du retard les heures encore faisables aujourd’hui', () => {
    // 09h00, une heure au compteur : il reste 6 h, mais la journée n'est pas finie.
    const src = makeSource({
      now: atTimeOn(MON, '09:00'),
      entries: [entry(MON, 'CLOCK_IN', '08:00')],
    });
    const p = computePulse(src);
    expect(Math.round(p.totalBalance)).toBe(-360);
    expect(Math.round(p.standing)).toBe(0);
    expect(p.trend).toBe('ON_TARGET');
  });

  it('compte immédiatement les heures faites en plus', () => {
    const src = makeSource({
      now: atTimeOn(MON, '16:30'),
      entries: [
        entry(MON, 'CLOCK_IN', '08:00'),
        entry(MON, 'BREAK_START', '12:00'),
        entry(MON, 'BREAK_END', '13:00'),
      ],
    });
    const p = computePulse(src);
    expect(Math.round(p.standing)).toBe(30);
    expect(p.trend).toBe('AHEAD');
  });

  it('une fois la journée pointée, le retard devient réel', () => {
    const src = makeSource({ now: atTimeOn(MON, '14:00'), entries: fullDay(MON, '13:30') });
    const p = computePulse(src);
    expect(Math.round(p.standing)).toBe(Math.round(p.totalBalance));
    expect(p.trend).toBe('BEHIND');
  });

  it('propose une heure de départ tenant compte de la pause à venir', () => {
    // Arrivée 08:00, aucune pause prise : la journée dépassera 6 h de travail.
    const src = makeSource({
      now: atTimeOn(MON, '10:00'),
      entries: [entry(MON, 'CLOCK_IN', '08:00')],
    });
    const p = computePulse(src);
    expect(Math.round(p.pendingBreak)).toBe(30);
    expect(clock(p.leaveAt!)).toBe('15:30'); // 08:00 + 7 h + 30 min de pause
  });
});

describe('pause minimale', () => {
  const s = DEFAULT_SETTINGS;

  it('refuse une reprise après 15 minutes', () => {
    const start = atTimeOn(MON, '12:00');
    const v = evaluateBreak(start, atTimeOn(MON, '12:15'), s);
    expect(v.allowed).toBe(false);
    expect(Math.round(v.remaining)).toBe(15);
    expect(v.message).toContain('15 min');
  });

  it('autorise la reprise à partir de 30 minutes', () => {
    const start = atTimeOn(MON, '12:00');
    expect(evaluateBreak(start, atTimeOn(MON, '12:30'), s).allowed).toBe(true);
    expect(evaluateBreak(start, atTimeOn(MON, '13:00'), s).allowed).toBe(true);
  });

  it('peut être désactivée dans les réglages', () => {
    const v = evaluateBreak(atTimeOn(MON, '12:00'), atTimeOn(MON, '12:05'), {
      ...s,
      enforceMinBreak: false,
    });
    expect(v.allowed).toBe(true);
  });
});

describe('formulations du moteur', () => {
  it('annonce l’avance dès avant le premier pointage', () => {
    const src = makeSource({
      now: atTimeOn(WED, '07:30'),
      entries: [...fullDay(MON, '18:00'), ...fullDay(TUE, '18:00')],
    });
    const p = computePulse(src);
    expect(p.state).toBe('NOT_STARTED');
    expect(p.detail).toContain('d’avance');
  });

  it('annonce le retard à rattraper avant le premier pointage', () => {
    const src = makeSource({
      now: atTimeOn(WED, '07:30'),
      entries: [...fullDay(MON, '14:00'), ...fullDay(TUE, '14:00')],
    });
    expect(computePulse(src).detail).toContain('rattraper');
  });

  it('dit explicitement que l’avance couvre la journée', () => {
    // Lundi et mardi à 9 h : +4 h d'avance. Mercredi 11 h, 3 h au compteur —
    // la journée est couverte alors que la semaine, elle, ne l'est pas.
    const src = makeSource({
      now: atTimeOn(WED, '11:00'),
      entries: [
        ...fullDay(MON, '18:00'),
        ...fullDay(TUE, '18:00'),
        entry(WED, 'CLOCK_IN', '08:00'),
      ],
    });
    const p = computePulse(src);
    expect(Math.round(p.advanceBeforeToday)).toBe(240);
    expect(p.state).toBe('DAY_COMPLETE');
    expect(p.headline).toBe('Ton avance couvre ta journée');
  });

  it('nomme chaque motif d’absence', () => {
    const cases = [
      ['RTT', 'RTT'],
      ['SICK', 'Arrêt maladie'],
      ['SPECIAL', 'Événement exceptionnel'],
      ['OTHER', 'Journée non travaillée'],
    ] as const;
    for (const [status, label] of cases) {
      const src = makeSource({
        now: atTimeOn(MON, '10:00'),
        days: [workDay(MON, { status })],
      });
      expect(computePulse(src).headline).toBe(label);
    }
  });

  it('décrit une pause qui a dépassé le minimum légal', () => {
    const src = makeSource({
      now: atTimeOn(MON, '12:45'),
      entries: [entry(MON, 'CLOCK_IN', '08:00'), entry(MON, 'BREAK_START', '12:00')],
    });
    const p = computePulse(src);
    expect(p.breakVerdict?.allowed).toBe(true);
    expect(p.headline).toBe('En pause');
    expect(p.detail).toContain('travaillées');
  });

  it('rend une phrase complète pour le bandeau', () => {
    const src = makeSource({ now: atTimeOn(MON, '08:15') });
    const sentence = pulseSentence(computePulse(src));
    expect(sentence).toMatch(/^08:15 — /);
    expect(sentence).toContain('Journée pas encore commencée');
  });

  it('journée sans objectif et sans pointage : aucun départ recommandé', () => {
    const src = makeSource({ now: atTimeOn('2026-09-12', '10:00') });
    const p = computePulse(src, '2026-09-12');
    expect(p.state).toBe('ABSENT');
    expect(p.leaveAt).toBeNull();
    expect(p.canLeave).toBe(true);
  });
});

describe('messages de pause minimale', () => {
  it('propose une suggestion différente au fil des minutes', () => {
    const start = atTimeOn(MON, '12:00');
    const messages = new Set<string>();
    for (let minute = 0; minute < 30; minute++) {
      const verdict = evaluateBreak(start, start + minute * 60_000, DEFAULT_SETTINGS);
      expect(verdict.allowed).toBe(false);
      messages.add(verdict.title);
    }
    // Six formulations tournent : l'application ne répète pas la même phrase.
    expect(messages.size).toBe(6);
  });
});

describe('jour férié déclaré à la main', () => {
  it('affiche un libellé générique quand la date n’est pas un férié du calendrier', () => {
    const src = makeSource({
      now: atTimeOn(MON, '10:00'),
      days: [workDay(MON, { status: 'HOLIDAY' })],
    });
    const p = computePulse(src);
    expect(p.state).toBe('HOLIDAY');
    expect(p.headline).toBe('Jour férié');
  });
});
