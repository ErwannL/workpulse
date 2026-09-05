import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ENTRY_TYPES = ['CLOCK_IN', 'BREAK_START', 'BREAK_END', 'CLOCK_OUT'] as const;
export const DAY_STATUSES = [
  'WORK',
  'REMOTE',
  'HOLIDAY',
  'LEAVE',
  'RTT',
  'SICK',
  'SPECIAL',
  'OTHER',
] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Un lot de synchronisation couvre au pire quelques années de pointages ; au
 * delà, la requête n'est plus une synchronisation mais une tentative
 * d'épuisement. La borne est volontairement large : un utilisateur réel
 * cumule environ mille pointages par an.
 */
const MAX_LOT = 5000;

/** Une note reste une note : pas un vecteur pour stocker un mégaoctet. */
const MAX_NOTE = 2000;

export class TimeEntryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ example: '2026-09-07' })
  @Matches(ISO_DATE, { message: 'date doit être au format AAAA-MM-JJ' })
  date!: string;

  @ApiProperty({ enum: ENTRY_TYPES })
  @IsIn(ENTRY_TYPES)
  type!: (typeof ENTRY_TYPES)[number];

  @ApiProperty({ description: 'Horodatage epoch ms du pointage' })
  @IsInt()
  at!: number;

  @ApiProperty()
  @IsBoolean()
  manual!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  editedAt?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  originalAt?: number | null;

  @ApiProperty({ description: 'Horodatage de dernière écriture, produit par le client' })
  @IsInt()
  updatedAt!: number;

  @ApiPropertyOptional({ description: 'Suppression réversible' })
  @IsOptional()
  @IsInt()
  deletedAt?: number | null;
}

export class WorkDayDto {
  @ApiProperty({ description: 'La date fait office d’identifiant métier', example: '2026-09-07' })
  @Matches(ISO_DATE, { message: 'id doit être au format AAAA-MM-JJ' })
  id!: string;

  @ApiProperty({ enum: DAY_STATUSES })
  @IsIn(DAY_STATUSES)
  status!: (typeof DAY_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  worksOnHoliday?: boolean;

  @ApiPropertyOptional({ description: 'Temps théorique forcé, en minutes' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  plannedOverride?: number | null;

  @ApiPropertyOptional({ maxLength: MAX_NOTE })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE)
  notes?: string | null;

  @ApiProperty()
  @IsInt()
  updatedAt!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  deletedAt?: number | null;
}

export class SettingsDto {
  @ApiProperty({ description: 'Réglages sérialisés, forme définie par @workpulse/core' })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiProperty()
  @IsInt()
  updatedAt!: number;
}

export class SyncPushDto {
  @ApiPropertyOptional({ description: 'Curseur renvoyé par la synchronisation précédente' })
  @IsOptional()
  @IsInt()
  since?: number | null;

  @ApiProperty({ type: [TimeEntryDto], maxItems: MAX_LOT })
  @IsArray()
  @ArrayMaxSize(MAX_LOT)
  @ValidateNested({ each: true })
  @Type(() => TimeEntryDto)
  entries!: TimeEntryDto[];

  @ApiProperty({ type: [WorkDayDto], maxItems: MAX_LOT })
  @IsArray()
  @ArrayMaxSize(MAX_LOT)
  @ValidateNested({ each: true })
  @Type(() => WorkDayDto)
  days!: WorkDayDto[];

  @ApiPropertyOptional({ type: SettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SettingsDto)
  settings?: SettingsDto | null;
}

export class SyncPullQueryDto {
  @ApiPropertyOptional({ description: 'Ne renvoyer que ce qui a changé après ce curseur' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  since?: number;
}

export class SummaryQueryDto {
  @ApiProperty({ example: '2026-09-07' })
  @IsISO8601({ strict: true })
  date!: string;
}
