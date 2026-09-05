import { describe, expect, it } from 'vitest';
import { computePulse } from './engine.js';
import { buildWeeks, periodStats, summarizeWeek, carryInFor } from './ledger.js';
import { addDays, atTimeOn, isoWeekday, todayISO } from './time.js';
import { mergeSettings } from './settings.js';
import type { DateISO, TimeEntry } from './types.js';
import type { LedgerSource } from './ledger.js';

/**
 * Budget de temps du moteur.
 *
 * Le report de solde remonte à la première journée suivie : le coût d'un calcul
 * croît donc avec l'ancienneté du compte. Ces tests fixent un plafond sur un
 * historique de cinq ans — au-delà, c'est qu'une boucle est devenue quadratique
 * et qu'un utilisateur de longue date verrait son application ramer.
 *
 * Les seuils sont larges à dessein : ils doivent tenir sur une machine
 * d'intégration chargée sans devenir instables, tout en restant très en deçà
 * de ce qu'un humain perçoit.
 */
const DEBUT: DateISO = '2021-01-04';
const FIN: DateISO = '2025-12-31';

/** Cinq ans de journées complètes, week-ends et jours fériés exclus. */
function historique(): { entries: Map<DateISO, TimeEntry[]>; nombre: number } {
  const entries = new Map<DateISO, TimeEntry[]>();
  let nombre = 0;
  let date = DEBUT;

  while (date <= FIN) {
    if (isoWeekday(date) <= 5) {
      const jour: TimeEntry[] = (
        [
          ['CLOCK_IN', '08:00'],
          ['BREAK_START', '12:00'],
          ['BREAK_END', '13:00'],
          ['CLOCK_OUT', '16:03'],
        ] as const
      ).map(([type, hhmm], index) => ({
        id: `${date}-${index}`,
        date,
        type,
        at: atTimeOn(date, hhmm),
        manual: false,
      }));
      entries.set(date, jour);
      nombre += jour.length;
    }
    date = addDays(date, 1);
  }

  return { entries, nombre };
}

/** Mesure un seul passage, cache vide : le coût réel du calcul complet. */
function mesureFroide(travail: () => void): number {
  const debut = performance.now();
  travail();
  return performance.now() - debut;
}

function chronometre(travail: () => void, tours = 5): number {
  // Un tour à blanc évite de mesurer la compilation à chaud du moteur JS.
  travail();
  const debut = performance.now();
  for (let i = 0; i < tours; i++) travail();
  return (performance.now() - debut) / tours;
}

const { entries, nombre } = historique();
const source: LedgerSource = {
  settings: mergeSettings({ trackingStart: DEBUT }),
  days: new Map(),
  entries,
  now: atTimeOn('2026-01-15', '14:00'),
};

describe('tenue en charge du moteur', () => {
  it('construit un historique de cinq ans', () => {
    expect(nombre).toBeGreaterThan(5000);
  });

  it('calcule l’état du jour en moins de 60 ms sur cinq ans d’historique', () => {
    const duree = chronometre(() => computePulse(source, todayISO(source.now)));
    expect(duree).toBeLessThan(60);
  });

  it('remonte le report de cinq ans en moins de 60 ms', () => {
    const duree = chronometre(() => carryInFor(source, '2026-01-12'));
    expect(duree).toBeLessThan(60);
  });

  it('résume une semaine en moins de 5 ms', () => {
    const duree = chronometre(() => summarizeWeek(source, '2025-06-02', 0));
    expect(duree).toBeLessThan(5);
  });

  it('produit un an de statistiques en moins de 40 ms', () => {
    const duree = chronometre(() => periodStats(source, '2025-01-01', '2025-12-31'));
    expect(duree).toBeLessThan(40);
  });

  it('ne remonte le report qu’une fois tant que les données ne bougent pas', () => {
    // Source neuve : le premier appel paie le trajet complet.
    const neuve: LedgerSource = { ...source, entries: new Map(source.entries) };
    const debut = performance.now();
    carryInFor(neuve, '2026-01-12');
    const premier = performance.now() - debut;

    const suivants = chronometre(() => carryInFor(neuve, '2026-01-12'), 50);

    // Le battement d'horloge de l'application rappelle cette fonction toutes
    // les quinze secondes : elle doit devenir quasi gratuite.
    expect(suivants).toBeLessThan(Math.max(premier, 1) / 5);
  });

  it('enchaîne douze semaines sans coût superlinéaire', () => {
    const uneSemaine = chronometre(() => buildWeeks(source, '2025-10-06', '2025-10-12'), 20);
    const douzeSemaines = chronometre(() => buildWeeks(source, '2025-10-06', '2025-12-28'), 20);
    expect(douzeSemaines).toBeLessThan(Math.max(uneSemaine, 0.05) * 20);
  });

  it('reste linéaire quand l’historique quadruple', () => {
    const court: LedgerSource = {
      ...source,
      entries: new Map(source.entries),
      settings: mergeSettings({ trackingStart: '2024-01-01' }),
    };
    const long: LedgerSource = {
      ...source,
      entries: new Map(source.entries),
      settings: mergeSettings({ trackingStart: '2022-01-03' }),
    };

    const dureeCourte = mesureFroide(() => carryInFor(court, '2026-01-12'));
    const dureeLongue = mesureFroide(() => carryInFor(long, '2026-01-12'));

    // Quatre fois plus de semaines ne doivent pas coûter seize fois plus.
    expect(dureeLongue).toBeLessThan(Math.max(dureeCourte, 0.5) * 8);
  });
});
