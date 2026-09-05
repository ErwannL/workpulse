import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  computePulse,
  DEFAULT_SETTINGS,
  evaluateBreak,
  todayISO,
  type DateISO,
  type EntryType,
  type LedgerSource,
  type TimeEntry,
} from '@workpulse/core';
import { db } from '@/db/db';
import * as repo from '@/db/repo';
import { StoreContext, type PunchResult, type Store } from './context';

/** Cadence de rafraîchissement du moteur de décision. */
const TICK_MS = 15_000;

function groupByDate(entries: TimeEntry[]): Map<DateISO, TimeEntry[]> {
  const map = new Map<DateISO, TimeEntry[]>();
  for (const e of entries) {
    const list = map.get(e.date);
    if (list) list.push(e);
    else map.set(e.date, [e]);
  }
  return map;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);

  // L'horloge du moteur avance seule ; elle se resynchronise au retour au premier plan.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    };
  }, []);

  // Écriture des réglages initiaux hors de tout `liveQuery` : ces derniers
  // s'exécutent dans une transaction en lecture seule.
  useEffect(() => {
    void repo.ensureSettings();
  }, []);

  const settingsRow = useLiveQuery(() => repo.loadSettings(), [], undefined);
  const dayRows = useLiveQuery(() => db.days.toArray(), [], undefined);
  const entryRows = useLiveQuery(() => db.entries.toArray(), [], undefined);

  const ready = settingsRow !== undefined && dayRows !== undefined && entryRows !== undefined;
  const settings = settingsRow ?? DEFAULT_SETTINGS;

  const days = useMemo(() => new Map((dayRows ?? []).map((d) => [d.date, d] as const)), [dayRows]);
  const entries = useMemo(() => groupByDate(entryRows ?? []), [entryRows]);

  const source = useMemo<LedgerSource>(
    () => ({ settings, days, entries, now }),
    [settings, days, entries, now],
  );

  const today = todayISO(now);
  const pulse = useMemo(() => computePulse(source, today), [source, today]);

  const notify = useCallback((message: string) => setToast(message), []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const punch = useCallback(async (type: EntryType): Promise<PunchResult> => {
    const at = Date.now();
    await repo.addEntry({ date: todayISO(at), type, at });
    setNow(at);
    return { ok: true };
  }, []);

  const clockIn = useCallback(() => punch('CLOCK_IN'), [punch]);
  const startBreak = useCallback(() => punch('BREAK_START'), [punch]);
  const clockOut = useCallback(() => punch('CLOCK_OUT'), [punch]);

  /**
   * Reprendre le travail est la seule action qui peut être refusée :
   * la pause déjeuner minimale est une contrainte légale, pas un conseil.
   */
  const endBreak = useCallback(async (): Promise<PunchResult> => {
    const start = pulse.day.computation.openBreakStart;
    if (start !== null) {
      const verdict = evaluateBreak(start, Date.now(), settings);
      if (!verdict.allowed) {
        return { ok: false, title: verdict.title, message: verdict.message };
      }
    }
    return punch('BREAK_END');
  }, [pulse, settings, punch]);

  const value = useMemo<Store>(
    () => ({
      ready,
      now,
      today,
      settings,
      days,
      entries,
      source,
      pulse,
      toast,
      notify,
      clockIn,
      startBreak,
      endBreak,
      clockOut,
      addEntry: async (date, type, at) => {
        await repo.addEntry({ date, type, at, manual: true });
        setNow(Date.now());
      },
      editEntry: async (id, at) => {
        await repo.updateEntryTime(id, at);
        setNow(Date.now());
      },
      removeEntry: async (id) => {
        await repo.deleteEntry(id);
        setNow(Date.now());
      },
      setDay: async (date, patch) => {
        await repo.upsertDay(date, patch);
      },
      resetDay: async (date) => {
        await repo.resetDay(date);
      },
      setRange: async (dates, patch) => {
        await repo.setRangeStatus(dates, patch);
      },
      clearRange: async (dates) => {
        await repo.clearRangeStatus(dates);
      },
      updateSettings: async (patch) => {
        await repo.saveSettings(patch);
      },
    }),
    [
      ready,
      now,
      today,
      settings,
      days,
      entries,
      source,
      pulse,
      toast,
      notify,
      clockIn,
      startBreak,
      endBreak,
      clockOut,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
