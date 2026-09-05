import { describe, expect, it } from 'vitest';
import { dayDtoToRow, dayRowToDto, entryDtoToRow, entryRowToDto } from './sync.mapper';
import type { TimeEntryDto, WorkDayDto } from './sync.dto';

const T = 1_770_000_000_000;

describe('conversion des pointages', () => {
  const dto: TimeEntryDto = {
    id: '6f1c1c8e-0000-4000-8000-000000000001',
    date: '2026-09-07',
    type: 'CLOCK_IN',
    at: T,
    manual: true,
    editedAt: T + 60,
    originalAt: T - 60,
    updatedAt: T + 120,
    deletedAt: null,
  };

  it('fait l’aller-retour sans perte', () => {
    expect(entryRowToDto(entryDtoToRow(dto))).toEqual(dto);
  });

  it('traduit les absences de valeur dans les deux sens', () => {
    const minimal: TimeEntryDto = { ...dto, editedAt: null, originalAt: null, deletedAt: null };
    const row = entryDtoToRow(minimal);
    expect(row.editedAt).toBeNull();
    expect(row.originalAt).toBeNull();
    expect(row.deletedAt).toBeNull();
    expect(entryRowToDto(row)).toEqual(minimal);
  });

  it('traite un champ absent comme un champ nul', () => {
    const { editedAt: _e, originalAt: _o, deletedAt: _d, ...partial } = dto;
    const row = entryDtoToRow(partial as TimeEntryDto);
    expect(row.editedAt).toBeNull();
    expect(row.originalAt).toBeNull();
    expect(row.deletedAt).toBeNull();
  });

  it('conserve une suppression', () => {
    expect(entryRowToDto(entryDtoToRow({ ...dto, deletedAt: T })).deletedAt).toBe(T);
  });
});

describe('conversion des journées', () => {
  const dto: WorkDayDto = {
    id: '2026-09-07',
    status: 'LEAVE',
    worksOnHoliday: false,
    plannedOverride: 210,
    notes: 'demi-journée',
    updatedAt: T,
    deletedAt: null,
  };

  it('fait l’aller-retour sans perte', () => {
    expect(dayRowToDto(dayDtoToRow(dto))).toEqual(dto);
  });

  it('utilise la date comme identifiant', () => {
    expect(dayDtoToRow(dto).date).toBe('2026-09-07');
    expect(dayRowToDto(dayDtoToRow(dto)).id).toBe('2026-09-07');
  });

  it('applique les valeurs par défaut des champs facultatifs', () => {
    const row = dayDtoToRow({ id: '2026-09-07', status: 'WORK', updatedAt: T });
    expect(row.worksOnHoliday).toBe(false);
    expect(row.plannedOverride).toBeNull();
    expect(row.notes).toBeNull();
    expect(row.deletedAt).toBeNull();
  });
});
