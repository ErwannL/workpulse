import { createContext, useContext } from 'react';
import type {
  DateISO,
  EntryType,
  LedgerSource,
  Pulse,
  Settings,
  TimeEntry,
  WorkDay,
} from '@workpulse/core';

export interface PunchResult {
  ok: boolean;
  message?: string;
  title?: string;
}

export interface Store {
  ready: boolean;
  now: number;
  today: DateISO;
  settings: Settings;
  days: Map<DateISO, WorkDay>;
  entries: Map<DateISO, TimeEntry[]>;
  source: LedgerSource;
  pulse: Pulse;
  toast: string | null;
  notify: (message: string) => void;
  clockIn: () => Promise<PunchResult>;
  startBreak: () => Promise<PunchResult>;
  endBreak: () => Promise<PunchResult>;
  clockOut: () => Promise<PunchResult>;
  addEntry: (date: DateISO, type: EntryType, at: number) => Promise<void>;
  editEntry: (id: string, at: number) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  setDay: (date: DateISO, patch: Partial<Omit<WorkDay, 'date'>>) => Promise<void>;
  resetDay: (date: DateISO) => Promise<void>;
  setRange: (dates: DateISO[], patch: Partial<Omit<WorkDay, 'date'>>) => Promise<void>;
  clearRange: (dates: DateISO[]) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

export const StoreContext = createContext<Store | null>(null);

/** Accès au magasin. Lève si l'arbre n'est pas enveloppé d'un `StoreProvider`. */
export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (ctx === null) throw new Error('useStore doit être utilisé dans un StoreProvider.');
  return ctx;
}
