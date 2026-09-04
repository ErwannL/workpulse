import type { TimeEntryDto, WorkDayDto } from './sync.dto';

/**
 * Traduction entre la base et le protocole de synchronisation.
 *
 * La base stocke des `DateTime`, le protocole des entiers epoch. Isoler la
 * conversion ici évite qu'un fuseau ou un `null` mal géré se glisse dans la
 * logique de fusion, qui ne manipule plus que des nombres.
 */

export interface EntryRow {
  id: string;
  date: string;
  type: TimeEntryDto['type'];
  at: Date;
  manual: boolean;
  editedAt: Date | null;
  originalAt: Date | null;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface DayRow {
  date: string;
  status: WorkDayDto['status'];
  worksOnHoliday: boolean;
  plannedOverride: number | null;
  notes: string | null;
  updatedAt: Date;
  deletedAt: Date | null;
}

const ms = (d: Date | null): number | null => (d === null ? null : d.getTime());
const date = (n: number | null | undefined): Date | null =>
  n === null || n === undefined ? null : new Date(n);

export function entryRowToDto(row: EntryRow): TimeEntryDto {
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    at: row.at.getTime(),
    manual: row.manual,
    editedAt: ms(row.editedAt),
    originalAt: ms(row.originalAt),
    updatedAt: row.updatedAt.getTime(),
    deletedAt: ms(row.deletedAt),
  };
}

export function entryDtoToRow(dto: TimeEntryDto): EntryRow {
  return {
    id: dto.id,
    date: dto.date,
    type: dto.type,
    at: new Date(dto.at),
    manual: dto.manual,
    editedAt: date(dto.editedAt),
    originalAt: date(dto.originalAt),
    updatedAt: new Date(dto.updatedAt),
    deletedAt: date(dto.deletedAt),
  };
}

export function dayRowToDto(row: DayRow): WorkDayDto {
  return {
    id: row.date,
    status: row.status,
    worksOnHoliday: row.worksOnHoliday,
    plannedOverride: row.plannedOverride,
    notes: row.notes,
    updatedAt: row.updatedAt.getTime(),
    deletedAt: ms(row.deletedAt),
  };
}

export function dayDtoToRow(dto: WorkDayDto): DayRow {
  return {
    date: dto.id,
    status: dto.status,
    worksOnHoliday: dto.worksOnHoliday ?? false,
    plannedOverride: dto.plannedOverride ?? null,
    notes: dto.notes ?? null,
    updatedAt: new Date(dto.updatedAt),
    deletedAt: date(dto.deletedAt),
  };
}
