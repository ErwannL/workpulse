import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Alert, AlertKind, AlertMemory, Minutes } from '@workpulse/core';
import {
  dailyAlertPlan,
  dismiss,
  dueAlert,
  emptyMemory,
  fromISO,
  memoryForDay,
  shouldNotify,
  snooze,
} from '@workpulse/core';
import { notifications } from '@/platform/notifications';
import { useStore, type PunchResult } from './context';

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
  const [memory, setMemory] = useState<AlertMemory>(() => memoryForDay(readMemory(), store.today));
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

  // Notification immédiate d'une alerte issue du compteur.
  useEffect(() => {
    if (!alert) return;
    if (!shouldNotify(lastNotified.current[alert.kind], store.settings, store.now)) return;

    let annule = false;
    const port = notifications();
    void port.permission().then((etat) => {
      if (annule || etat !== 'granted') return;
      lastNotified.current[alert.kind] = store.now;
      void port.show(`${alert.emoji} ${alert.title}`, alert.body, `workpulse-${alert.kind}`);
    });
    return () => {
      annule = true;
    };
  }, [alert, store.now, store.settings]);

  /*
   * Rappels programmés de la journée. Ils n'existent que dans l'application
   * installée : un navigateur ne peut rien déclencher une fois fermé. C'est la
   * seule différence fonctionnelle entre les deux enveloppes.
   */
  useEffect(() => {
    const port = notifications();
    if (!port.canSchedule) return;

    let annule = false;
    void port.permission().then((etat) => {
      if (annule || etat !== 'granted') return;
      void port.schedule(
        fromISO(store.today),
        dailyAlertPlan(store.pulse.schedule, store.settings),
      );
    });
    return () => {
      annule = true;
    };
  }, [store.today, store.settings, store.pulse.schedule]);

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
