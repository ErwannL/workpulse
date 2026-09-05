import { beforeEach, describe, expect, it } from 'vitest';
import { atTimeOn } from '@workpulse/core';
import { SummaryService } from './summary.service';
import { dayDtoToRow, entryDtoToRow, type DayRow, type EntryRow } from '../sync/sync.mapper';
import type { StoredSettings, SyncPort } from '../sync/sync.port';
import type { TimeEntryDto } from '../sync/sync.dto';

const MON = '2026-09-07';
const FRI = '2026-09-11';

class MemoryPort implements SyncPort {
  entries: EntryRow[] = [];
  days: DayRow[] = [];
  settings: StoredSettings | null = null;
  loadEntries = () => Promise.resolve(this.entries);
  loadDays = () => Promise.resolve(this.days);
  loadSettings = () => Promise.resolve(this.settings);
  persist = () => Promise.resolve();
}

let uid = 0;
function punch(date: string, type: TimeEntryDto['type'], hhmm: string, deleted = false): EntryRow {
  return entryDtoToRow({
    id: `00000000-0000-4000-8000-${String(uid++).padStart(12, '0')}`,
    date,
    type,
    at: atTimeOn(date, hhmm),
    manual: false,
    editedAt: null,
    originalAt: null,
    updatedAt: atTimeOn(date, hhmm),
    deletedAt: deleted ? atTimeOn(date, hhmm) : null,
  });
}

/** Journée de 7 h : 08:00 → 12:00, 13:00 → 16:00. */
function sevenHours(date: string): EntryRow[] {
  return [
    punch(date, 'CLOCK_IN', '08:00'),
    punch(date, 'BREAK_START', '12:00'),
    punch(date, 'BREAK_END', '13:00'),
    punch(date, 'CLOCK_OUT', '16:00'),
  ];
}

let port: MemoryPort;
let service: SummaryService;
const NOW = atTimeOn('2026-09-14', '09:00');

beforeEach(() => {
  port = new MemoryPort();
  port.settings = { payload: { trackingStart: MON }, updatedAt: new Date(0) };
  service = new SummaryService(port);
});

describe('SummaryService.week', () => {
  it('recalcule le même solde que le client', async () => {
    port.entries = [MON, '2026-09-08', '2026-09-09', '2026-09-10', FRI].flatMap(sevenHours);
    const summary = await service.week('u1', MON, NOW);

    expect(summary.week).toBe('2026-W37');
    expect(summary.monday).toBe(MON);
    expect(summary.sunday).toBe('2026-09-13');
    expect(summary.plannedMinutes).toBe(2100);
    expect(summary.workedMinutes).toBe(2100);
    expect(summary.differenceMinutes).toBe(0);
    expect(summary.overtimeExceeded).toBe(false);
    expect(summary.days).toHaveLength(7);
  });

  it('signale le dépassement du plafond d’heures supplémentaires', async () => {
    port.entries = [MON, '2026-09-08', '2026-09-09', '2026-09-10', FRI].flatMap((d) => [
      punch(d, 'CLOCK_IN', '08:00'),
      punch(d, 'CLOCK_OUT', '18:00'),
    ]);
    const summary = await service.week('u1', MON, NOW);
    expect(summary.overtimeMinutes).toBe(5 * 600 - 2100);
    expect(summary.overtimeCapMinutes).toBe(240);
    expect(summary.overtimeExceeded).toBe(true);
  });

  it('ignore les lignes supprimées', async () => {
    port.entries = [punch(MON, 'CLOCK_IN', '08:00', true), punch(MON, 'CLOCK_OUT', '16:00', true)];
    expect((await service.week('u1', MON, NOW)).workedMinutes).toBe(0);
  });

  it('applique le statut d’une journée', async () => {
    port.days = [
      dayDtoToRow({ id: FRI, status: 'LEAVE', updatedAt: 0 }),
      dayDtoToRow({ id: '2026-09-10', status: 'WORK', updatedAt: 0, deletedAt: 1 }),
    ];
    const summary = await service.week('u1', MON, NOW);
    // Le vendredi est neutralisé ; la journée supprimée redevient une journée normale.
    expect(summary.plannedMinutes).toBe(4 * 420);
    expect(summary.days.find((d) => d.date === FRI)?.status).toBe('LEAVE');
  });

  it('reporte le solde de la semaine précédente', async () => {
    port.entries = [MON, '2026-09-08', '2026-09-09', '2026-09-10', FRI].flatMap((d) => [
      punch(d, 'CLOCK_IN', '08:00'),
      punch(d, 'CLOCK_OUT', '16:00'),
    ]);
    const next = await service.week('u1', '2026-09-14', NOW);
    expect(next.carryInMinutes).toBe(5 * 480 - 2100);
    expect(next.carryOutMinutes).toBe(next.carryInMinutes + next.differenceMinutes);
  });

  it('retombe sur les réglages par défaut quand aucun n’est enregistré', async () => {
    port.settings = null;
    const summary = await service.week('u1', MON, NOW);
    expect(summary.overtimeCapMinutes).toBe(240);
  });
});
