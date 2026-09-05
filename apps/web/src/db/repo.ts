import type { DateISO, EntryType, Settings, TimeEntry, WorkDay } from '@workpulse/core';
import { mergeSettings, PayloadRejeteError, sanitizeJson } from '@workpulse/core';
import { todayISO } from '@workpulse/core';
import { db, type WorkPulseDB } from './db';

const SETTINGS_KEY = 'settings';

function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

/** Lecture seule : utilisable depuis un `liveQuery`. */
export async function loadSettings(base: WorkPulseDB = db): Promise<Settings> {
  const row = await base.meta.get(SETTINGS_KEY);
  return mergeSettings(row?.value as Partial<Settings> | undefined);
}

/**
 * Fige les réglages au premier lancement : sans cela la date de début de
 * suivi glisserait d'un jour à chaque ouverture de l'application.
 */
export async function ensureSettings(base: WorkPulseDB = db): Promise<void> {
  const row = await base.meta.get(SETTINGS_KEY);
  if (!row) await base.meta.put({ key: SETTINGS_KEY, value: mergeSettings(undefined) });
}

export async function saveSettings(
  patch: Partial<Settings>,
  base: WorkPulseDB = db,
): Promise<Settings> {
  const current = await loadSettings(base);
  const next = mergeSettings({ ...current, ...patch });
  await base.meta.put({ key: SETTINGS_KEY, value: next });
  return next;
}

export async function allEntries(base: WorkPulseDB = db): Promise<TimeEntry[]> {
  return base.entries.toArray();
}

export async function allDays(base: WorkPulseDB = db): Promise<WorkDay[]> {
  return base.days.toArray();
}

export async function entriesOf(date: DateISO, base: WorkPulseDB = db): Promise<TimeEntry[]> {
  return base.entries.where('date').equals(date).sortBy('at');
}

/** Ajoute un pointage. `manual` distingue le bouton du formulaire de correction. */
export async function addEntry(
  input: { date?: DateISO; type: EntryType; at?: number; manual?: boolean },
  base: WorkPulseDB = db,
): Promise<TimeEntry> {
  const at = input.at ?? Date.now();
  const entry: TimeEntry = {
    id: newId(),
    date: input.date ?? todayISO(at),
    type: input.type,
    at,
    manual: input.manual ?? false,
  };
  await base.entries.put(entry);
  return entry;
}

/** Corrige l'heure d'un pointage en conservant la valeur d'origine. */
export async function updateEntryTime(
  id: string,
  at: number,
  base: WorkPulseDB = db,
): Promise<void> {
  const existing = await base.entries.get(id);
  if (!existing) return;
  await base.entries.put({
    ...existing,
    at,
    manual: true,
    editedAt: Date.now(),
    originalAt: existing.originalAt ?? existing.at,
  });
}

export async function deleteEntry(id: string, base: WorkPulseDB = db): Promise<void> {
  await base.entries.delete(id);
}

export async function getDay(date: DateISO, base: WorkPulseDB = db): Promise<WorkDay | undefined> {
  return base.days.get(date);
}

export async function upsertDay(
  date: DateISO,
  patch: Partial<Omit<WorkDay, 'date'>>,
  base: WorkPulseDB = db,
): Promise<WorkDay> {
  const existing = await base.days.get(date);
  const next: WorkDay = {
    date,
    status: existing?.status ?? 'WORK',
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  };
  await base.days.put(next);
  return next;
}

/** Supprime la surcharge d'une journée : elle repasse au comportement calendaire. */
export async function resetDay(date: DateISO, base: WorkPulseDB = db): Promise<void> {
  await base.days.delete(date);
}

/** Applique un statut à toutes les journées d'une plage (pose de congés). */
export async function setRangeStatus(
  dates: DateISO[],
  patch: Partial<Omit<WorkDay, 'date'>>,
  base: WorkPulseDB = db,
): Promise<void> {
  const now = Date.now();
  const existing = await base.days.bulkGet(dates);
  const rows: WorkDay[] = dates.map((date, i) => ({
    date,
    status: 'WORK',
    ...(existing[i] ?? {}),
    ...patch,
    updatedAt: now,
  }));
  await base.days.bulkPut(rows);
}

export async function clearRangeStatus(dates: DateISO[], base: WorkPulseDB = db): Promise<void> {
  await base.days.bulkDelete(dates);
}

/** Purge complète — utilisée par le panneau d'administration. */
export async function wipeAll(base: WorkPulseDB = db): Promise<void> {
  await base.transaction('rw', base.entries, base.days, base.meta, async () => {
    await base.entries.clear();
    await base.days.clear();
    await base.meta.clear();
  });
}

export interface Backup {
  app: 'workpulse';
  version: number;
  exportedAt: string;
  settings: Settings;
  days: WorkDay[];
  entries: TimeEntry[];
}

export async function exportBackup(base: WorkPulseDB = db): Promise<Backup> {
  return {
    app: 'workpulse',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: await loadSettings(base),
    days: await allDays(base),
    entries: await allEntries(base),
  };
}

/**
 * Restaure une sauvegarde.
 *
 * Le fichier vient de l'extérieur : il peut avoir été bricolé, tronqué, ou
 * fabriqué pour nuire. Il est donc recopié champ par champ plutôt que gobé
 * tel quel — un objet contenant `__proto__` fusionné dans les réglages
 * modifierait le prototype d'`Object` pour tout le reste de la session.
 */
export async function importBackup(backup: unknown, base: WorkPulseDB = db): Promise<void> {
  const propre = validateBackup(backup);
  await base.transaction('rw', base.entries, base.days, base.meta, async () => {
    await base.entries.clear();
    await base.days.clear();
    await base.entries.bulkPut(propre.entries);
    await base.days.bulkPut(propre.days);
    await base.meta.put({ key: SETTINGS_KEY, value: propre.settings });
  });
}

const TYPES_POINTAGE = new Set(['CLOCK_IN', 'BREAK_START', 'BREAK_END', 'CLOCK_OUT']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class BackupInvalideError extends Error {}

/** Vérifie et recopie une sauvegarde. Lève dès qu'une ligne est inexploitable. */
export function validateBackup(brut: unknown): {
  settings: Settings;
  days: WorkDay[];
  entries: TimeEntry[];
} {
  if (typeof brut !== 'object' || brut === null) {
    throw new BackupInvalideError('Fichier de sauvegarde non reconnu.');
  }
  const backup = brut as Record<string, unknown>;
  if (backup.app !== 'workpulse') {
    throw new BackupInvalideError('Fichier de sauvegarde non reconnu.');
  }

  let settings: Settings;
  try {
    const brutReglages = sanitizeJson(backup.settings ?? {}) as Partial<Settings>;
    settings = mergeSettings(brutReglages);
  } catch (erreur) {
    if (erreur instanceof PayloadRejeteError) {
      throw new BackupInvalideError(`Réglages illisibles : ${erreur.message}`);
    }
    throw erreur;
  }

  const entries = asArray(backup.entries).map((brute, index) => {
    const e = brute as Record<string, unknown>;
    if (typeof e.id !== 'string' || typeof e.date !== 'string' || !ISO_DATE.test(e.date)) {
      throw new BackupInvalideError(`Pointage ${index + 1} : identifiant ou date invalide.`);
    }
    if (typeof e.type !== 'string' || !TYPES_POINTAGE.has(e.type)) {
      throw new BackupInvalideError(`Pointage ${index + 1} : type inconnu.`);
    }
    if (typeof e.at !== 'number' || !Number.isFinite(e.at)) {
      throw new BackupInvalideError(`Pointage ${index + 1} : horodatage invalide.`);
    }
    return {
      id: e.id,
      date: e.date,
      type: e.type as TimeEntry['type'],
      at: e.at,
      manual: e.manual === true,
      ...(typeof e.editedAt === 'number' ? { editedAt: e.editedAt } : {}),
      ...(typeof e.originalAt === 'number' ? { originalAt: e.originalAt } : {}),
    } satisfies TimeEntry;
  });

  const days = asArray(backup.days).map((brute, index) => {
    const d = brute as Record<string, unknown>;
    if (typeof d.date !== 'string' || !ISO_DATE.test(d.date)) {
      throw new BackupInvalideError(`Journée ${index + 1} : date invalide.`);
    }
    return {
      date: d.date,
      status: (typeof d.status === 'string' ? d.status : 'WORK') as WorkDay['status'],
      worksOnHoliday: d.worksOnHoliday === true,
      ...(typeof d.pattern === 'string' ? { pattern: d.pattern as WorkDay['pattern'] } : {}),
      ...(typeof d.plannedOverride === 'number' ? { plannedOverride: d.plannedOverride } : {}),
      ...(typeof d.notes === 'string' ? { notes: d.notes.slice(0, 2000) } : {}),
      updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
    } satisfies WorkDay;
  });

  return { settings, days, entries };
}

function asArray(valeur: unknown): unknown[] {
  if (valeur === undefined || valeur === null) return [];
  if (!Array.isArray(valeur)) throw new BackupInvalideError('Structure de sauvegarde inattendue.');
  return valeur;
}
