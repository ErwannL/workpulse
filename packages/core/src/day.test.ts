import { describe, expect, it } from 'vitest';
import { computeDay, plannedMinutes } from './day.js';
import { DEFAULT_SETTINGS } from './settings.js';
import { atTimeOn } from './time.js';
import { entry, fullDay, workDay } from './testing.js';

const D = '2026-09-07'; // un lundi
const at = (hhmm: string) => atTimeOn(D, hhmm);

describe('computeDay', () => {
  it('déduit la pause du temps de présence', () => {
    const r = computeDay(D, fullDay(D), at('18:00'));
    expect(Math.round(r.worked)).toBe(480);
    expect(Math.round(r.breaks)).toBe(60);
    expect(Math.round(r.presence)).toBe(540);
    expect(r.phase).toBe('CLOCKED_OUT');
  });

  it('reprend l’exemple du cahier des charges : 08:07 → 16:58', () => {
    const entries = [
      entry(D, 'CLOCK_IN', '08:07'),
      entry(D, 'BREAK_START', '12:04'),
      entry(D, 'BREAK_END', '13:02'),
      entry(D, 'CLOCK_OUT', '16:58'),
    ];
    const r = computeDay(D, entries, at('18:00'));
    expect(Math.round(r.worked)).toBe(237 + 236); // 3h57 + 3h56
    expect(Math.round(r.worked)).toBe(473); // 7h53
  });

  it('compte le segment ouvert jusqu’à maintenant', () => {
    const r = computeDay(D, [entry(D, 'CLOCK_IN', '08:00')], at('11:30'));
    expect(Math.round(r.worked)).toBe(210);
    expect(r.phase).toBe('WORKING');
    expect(r.openWorkStart).toBe(at('08:00'));
  });

  it('fait courir la pause en cours', () => {
    const entries = [entry(D, 'CLOCK_IN', '08:00'), entry(D, 'BREAK_START', '12:00')];
    const r = computeDay(D, entries, at('12:20'));
    expect(Math.round(r.worked)).toBe(240);
    expect(Math.round(r.breaks)).toBe(20);
    expect(r.phase).toBe('BREAK');
    expect(r.openBreakStart).toBe(at('12:00'));
  });

  it('ignore l’ordre de saisie et trie les pointages', () => {
    const shuffled = [...fullDay(D)].reverse();
    expect(Math.round(computeDay(D, shuffled, at('18:00')).worked)).toBe(480);
  });

  it('signale les séquences incohérentes sans planter', () => {
    const r = computeDay(
      D,
      [entry(D, 'BREAK_END', '09:00'), entry(D, 'CLOCK_OUT', '10:00')],
      at('11:00'),
    );
    expect(r.anomalies.length).toBeGreaterThan(0);
    expect(r.worked).toBe(0);
  });

  it('gère plusieurs pauses dans la journée', () => {
    const entries = [
      entry(D, 'CLOCK_IN', '08:00'),
      entry(D, 'BREAK_START', '10:00'),
      entry(D, 'BREAK_END', '10:15'),
      entry(D, 'BREAK_START', '12:00'),
      entry(D, 'BREAK_END', '13:00'),
      entry(D, 'CLOCK_OUT', '17:00'),
    ];
    const r = computeDay(D, entries, at('18:00'));
    expect(Math.round(r.breaks)).toBe(75);
    expect(Math.round(r.worked)).toBe(465);
    expect(r.breakSpans).toHaveLength(2);
  });
});

describe('plannedMinutes', () => {
  // Suivi démarré très tôt : les dates de test sont toutes postérieures.
  const s = { ...DEFAULT_SETTINGS, trackingStart: '2026-01-01' };

  it('vaut la journée type un jour ouvré', () => {
    expect(plannedMinutes(D, workDay(D), s)).toBe(420);
    expect(plannedMinutes(D, undefined, s)).toBe(420);
  });

  it('est nul le week-end', () => {
    expect(plannedMinutes('2026-09-12', undefined, s)).toBe(0);
  });

  it('est nul un jour férié, sauf si le jour est travaillé', () => {
    expect(plannedMinutes('2026-07-14', undefined, s)).toBe(0);
    expect(
      plannedMinutes(
        '2026-07-14',
        workDay('2026-07-14', { status: 'HOLIDAY', worksOnHoliday: true }),
        s,
      ),
    ).toBe(420);
  });

  it('est nul pour un congé, un RTT ou une maladie', () => {
    for (const status of ['LEAVE', 'RTT', 'SICK'] as const) {
      expect(plannedMinutes(D, workDay(D, { status }), s)).toBe(0);
    }
  });

  it('respecte une demi-journée forcée', () => {
    expect(plannedMinutes(D, workDay(D, { status: 'LEAVE', plannedOverride: 210 }), s)).toBe(210);
  });

  it('ne réclame rien avant le début du suivi', () => {
    expect(plannedMinutes('2026-09-04', undefined, { ...s, trackingStart: D })).toBe(0);
    expect(plannedMinutes(D, undefined, { ...s, trackingStart: D })).toBe(420);
  });

  it('compte normalement le télétravail', () => {
    expect(plannedMinutes(D, workDay(D, { status: 'REMOTE' }), s)).toBe(420);
  });
});

describe('computeDay — séquences dégradées', () => {
  it('ignore une seconde arrivée sans perdre le compteur', () => {
    const entries = [
      entry(D, 'CLOCK_IN', '08:00'),
      entry(D, 'CLOCK_IN', '09:00'),
      entry(D, 'CLOCK_OUT', '12:00'),
    ];
    const r = computeDay(D, entries, at('13:00'));
    expect(r.anomalies).toContain('Arrivée en double');
    expect(Math.round(r.worked)).toBe(240);
  });

  it('traite une arrivée pendant la pause comme une reprise', () => {
    const entries = [
      entry(D, 'CLOCK_IN', '08:00'),
      entry(D, 'BREAK_START', '12:00'),
      entry(D, 'CLOCK_IN', '13:00'),
      entry(D, 'CLOCK_OUT', '17:00'),
    ];
    const r = computeDay(D, entries, at('18:00'));
    expect(Math.round(r.breaks)).toBe(60);
    expect(Math.round(r.worked)).toBe(480);
    expect(r.breakSpans).toHaveLength(1);
  });

  it('refuse une pause sans arrivée', () => {
    const r = computeDay(D, [entry(D, 'BREAK_START', '12:00')], at('13:00'));
    expect(r.anomalies).toContain('Pause sans arrivée');
    expect(r.worked).toBe(0);
    expect(r.phase).toBe('NOT_STARTED');
  });

  it('clôt la pause en cours lorsqu’on pointe le départ', () => {
    const entries = [
      entry(D, 'CLOCK_IN', '08:00'),
      entry(D, 'BREAK_START', '12:00'),
      entry(D, 'CLOCK_OUT', '12:30'),
    ];
    const r = computeDay(D, entries, at('14:00'));
    expect(Math.round(r.breaks)).toBe(30);
    expect(Math.round(r.worked)).toBe(240);
    expect(Math.round(r.presence)).toBe(270);
    expect(r.phase).toBe('CLOCKED_OUT');
  });

  it('ne compte aucune présence sans arrivée', () => {
    expect(computeDay(D, [], at('14:00')).presence).toBe(0);
  });

  it('arrête la présence au départ, pas à l’heure courante', () => {
    const r = computeDay(D, fullDay(D, '17:00'), at('23:00'));
    expect(Math.round(r.presence)).toBe(540);
  });
});
