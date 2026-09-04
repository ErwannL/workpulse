import type { DateISO, EntryType, Settings, TimeEntry, WorkDay } from '@/core/types';
import { mergeSettings } from '@/core/settings';
import { todayISO } from '@/core/time';
import { db, type WorkPulseDB } from './db';

const SETTINGS_KEY = 'settings';

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

export async function saveSettings(patch: Partial<Settings>, base: WorkPulseDB = db): Promise<Settings> {
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
export async function updateEntryTime(id: string, at: number, base: WorkPulseDB = db): Promise<void> {
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

export async function importBackup(backup: Backup, base: WorkPulseDB = db): Promise<void> {
  if (backup?.app !== 'workpulse') throw new Error('Fichier de sauvegarde non reconnu.');
  await base.transaction('rw', base.entries, base.days, base.meta, async () => {
    await base.entries.clear();
    await base.days.clear();
    await base.entries.bulkPut(backup.entries ?? []);
    await base.days.bulkPut(backup.days ?? []);
    await base.meta.put({ key: SETTINGS_KEY, value: mergeSettings(backup.settings) });
  });
}
