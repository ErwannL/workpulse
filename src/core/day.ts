import type { DateISO, DayPhase, Minutes, Settings, TimeEntry, WorkDay } from './types';
import { OFF_STATUSES } from './types';
import { isoWeekday } from './time';
import { holidayName } from './holidays';

export interface BreakSpan {
  start: number;
  end: number | null;
  minutes: Minutes;
}

export interface DayComputation {
  date: DateISO;
  phase: DayPhase;
  /** Temps réellement travaillé, pauses déduites. */
  worked: Minutes;
  /** Temps de pause cumulé. */
  breaks: Minutes;
  /** Temps de présence : de la première arrivée au dernier départ (ou maintenant). */
  presence: Minutes;
  firstIn: number | null;
  lastOut: number | null;
  breakSpans: BreakSpan[];
  /** Début de la pause en cours, si l'on est en pause. */
  openBreakStart: number | null;
  /** Début du segment de travail en cours, si l'on travaille. */
  openWorkStart: number | null;
  /** Pointages incohérents détectés (ordre impossible). */
  anomalies: string[];
}

export function sortEntries(entries: TimeEntry[]): TimeEntry[] {
  return [...entries].sort((a, b) => a.at - b.at);
}

/**
 * Rejoue les pointages d'une journée sous forme d'automate et en déduit
 * temps travaillé, pauses et phase courante. Tolère les journées incomplètes :
 * un segment ouvert est compté jusqu'à `now`.
 */
export function computeDay(date: DateISO, entries: TimeEntry[], now: number): DayComputation {
  const sorted = sortEntries(entries);
  const anomalies: string[] = [];
  const breakSpans: BreakSpan[] = [];

  let phase: DayPhase = 'NOT_STARTED';
  let worked = 0;
  let breaks = 0;
  let firstIn: number | null = null;
  let lastOut: number | null = null;
  let workStart: number | null = null;
  let breakStart: number | null = null;

  const closeWork = (at: number) => {
    if (workStart !== null) {
      worked += Math.max(0, (at - workStart) / 60_000);
      workStart = null;
    }
  };

  for (const e of sorted) {
    switch (e.type) {
      case 'CLOCK_IN':
        if (phase === 'WORKING') {
          anomalies.push('Arrivée en double');
          break;
        }
        if (phase === 'BREAK' && breakStart !== null) {
          // Reprise implicite : une arrivée pendant une pause clôt la pause.
          breaks += Math.max(0, (e.at - breakStart) / 60_000);
          breakSpans.push({ start: breakStart, end: e.at, minutes: (e.at - breakStart) / 60_000 });
          breakStart = null;
        }
        if (firstIn === null) firstIn = e.at;
        workStart = e.at;
        phase = 'WORKING';
        break;

      case 'BREAK_START':
        if (phase !== 'WORKING') {
          anomalies.push('Pause sans arrivée');
          break;
        }
        closeWork(e.at);
        breakStart = e.at;
        phase = 'BREAK';
        break;

      case 'BREAK_END':
        if (phase !== 'BREAK' || breakStart === null) {
          anomalies.push('Reprise sans pause');
          break;
        }
        breaks += Math.max(0, (e.at - breakStart) / 60_000);
        breakSpans.push({ start: breakStart, end: e.at, minutes: (e.at - breakStart) / 60_000 });
        breakStart = null;
        workStart = e.at;
        phase = 'WORKING';
        break;

      case 'CLOCK_OUT':
        if (phase === 'NOT_STARTED') {
          anomalies.push('Départ sans arrivée');
          break;
        }
        if (phase === 'BREAK' && breakStart !== null) {
          breaks += Math.max(0, (e.at - breakStart) / 60_000);
          breakSpans.push({ start: breakStart, end: e.at, minutes: (e.at - breakStart) / 60_000 });
          breakStart = null;
        }
        closeWork(e.at);
        lastOut = e.at;
        phase = 'CLOCKED_OUT';
        break;
    }
  }

  // Segments encore ouverts : on les compte jusqu'à l'instant présent.
  if (phase === 'WORKING' && workStart !== null) worked += Math.max(0, (now - workStart) / 60_000);
  if (phase === 'BREAK' && breakStart !== null) breaks += Math.max(0, (now - breakStart) / 60_000);

  const presenceEnd = phase === 'CLOCKED_OUT' ? (lastOut ?? now) : now;
  const presence = firstIn === null ? 0 : Math.max(0, (presenceEnd - firstIn) / 60_000);

  return {
    date,
    phase,
    worked,
    breaks,
    presence,
    firstIn,
    lastOut,
    breakSpans,
    openBreakStart: phase === 'BREAK' ? breakStart : null,
    openWorkStart: phase === 'WORKING' ? workStart : null,
    anomalies,
  };
}

/** Le jour est-il un jour normalement travaillé selon les réglages ? */
export function isScheduledWorkday(date: DateISO, settings: Settings): boolean {
  return settings.workDays.includes(isoWeekday(date));
}

/**
 * Temps théorique d'une journée, après application des jours fériés,
 * congés, absences et surcharges manuelles.
 */
export function plannedMinutes(
  date: DateISO,
  day: WorkDay | undefined,
  settings: Settings,
): Minutes {
  // Rien n'est dû avant la première journée suivie : l'application ne
  // réclame pas des heures pour une période qu'elle n'a jamais observée.
  if (date < settings.trackingStart) return 0;
  if (day?.plannedOverride !== undefined && day.plannedOverride !== null) {
    return Math.max(0, day.plannedOverride);
  }
  if (!isScheduledWorkday(date, settings)) return 0;

  const status = day?.status ?? (holidayName(date) ? 'HOLIDAY' : 'WORK');
  if (status === 'HOLIDAY') {
    return day?.worksOnHoliday ? settings.dailyMinutes : 0;
  }
  if (OFF_STATUSES.includes(status)) return 0;
  return settings.dailyMinutes;
}

/** Statut effectif d'un jour : celui enregistré, sinon déduit du calendrier. */
export function effectiveStatus(date: DateISO, day: WorkDay | undefined, settings: Settings) {
  if (day) return day.status;
  if (holidayName(date)) return 'HOLIDAY' as const;
  return isScheduledWorkday(date, settings) ? ('WORK' as const) : ('OTHER' as const);
}
