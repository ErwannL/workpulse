import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Alert, AlertKind, AlertMemory } from '@/core/alerts';
import { dismiss, dueAlert, emptyMemory, memoryForDay, shouldNotify, snooze } from '@/core/alerts';
import type { Minutes } from '@/core/types';
import { useStore, type PunchResult } from './store';

const STORAGE_KEY = 'workpulse.alerts';

function readMemory(): AlertMemory | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AlertMemory) : null;
  } catch {
    return null;
  }
}

function writeMemory(memory: AlertMemory): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Stockage indisponible (navigation privée) : les alertes restent en mémoire vive.
  }
}

export interface AlertController {
  alert: Alert | null;
  /** Exécute l'action proposée par l'alerte, si elle en a une. */
  accept: () => Promise<PunchResult>;
  snoozeFor: (minutes: Minutes) => void;
  ignore: () => void;
  snoozeOptions: Minutes[];
  notificationsBlocked: boolean;
}

/**
 * Relie le moteur d'alertes à l'interface : mémoire des reports persistée
 * pour la journée, et notification système au rythme choisi tant que
 * l'utilisateur n'a pas répondu.
 */
export function useAlerts(): AlertController {
  const store = useStore();
  const [memory, setMemory] = useState<AlertMemory>(() =>
    memoryForDay(readMemory(), store.today),
  );
  const lastNotified = useRef<Partial<Record<AlertKind, number>>>({});

  // Changement de jour : la mémoire des reports repart de zéro.
  useEffect(() => {
    setMemory((m) => {
      const next = memoryForDay(m, store.today);
      if (next !== m) lastNotified.current = {};
      return next;
    });
  }, [store.today]);

  const update = useCallback((next: AlertMemory) => {
    writeMemory(next);
    setMemory(next);
  }, []);

  const alert = useMemo(
    () => dueAlert(store.pulse, store.settings, memory, store.now),
    [store.pulse, store.settings, memory, store.now],
  );

  // Notification système : seulement si l'utilisateur l'a autorisée.
  useEffect(() => {
    if (!alert) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!shouldNotify(lastNotified.current[alert.kind], store.settings, store.now)) return;
    lastNotified.current[alert.kind] = store.now;
    try {
      new Notification(`${alert.emoji} ${alert.title}`, {
        body: alert.body,
        tag: `workpulse-${alert.kind}`,
        icon: './icons/icon-192.png',
      });
    } catch {
      // Certaines plateformes n'autorisent les notifications que via le service worker.
    }
  }, [alert, store.now, store.settings]);

  const accept = useCallback(async (): Promise<PunchResult> => {
    if (!alert) return { ok: true };
    const runner = {
      CLOCK_IN: store.clockIn,
      BREAK_START: store.startBreak,
      BREAK_END: store.endBreak,
      CLOCK_OUT: store.clockOut,
    };
    const result = alert.action ? await runner[alert.action]() : { ok: true };
    if (result.ok) update(dismiss(memory, alert.kind));
    return result;
  }, [alert, memory, store, update]);

  const snoozeFor = useCallback(
    (minutes: Minutes) => {
      if (!alert) return;
      delete lastNotified.current[alert.kind];
      update(snooze(memory, alert.kind, minutes, Date.now()));
    },
    [alert, memory, update],
  );

  const ignore = useCallback(() => {
    if (!alert) return;
    update(dismiss(memory, alert.kind));
  }, [alert, memory, update]);

  return {
    alert,
    accept,
    snoozeFor,
    ignore,
    snoozeOptions: store.settings.notifications.snoozeOptions,
    notificationsBlocked:
      typeof Notification !== 'undefined' && Notification.permission === 'denied',
  };
}

export { emptyMemory };
