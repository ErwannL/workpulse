import type { DateISO, DaySchedule, Minutes, Settings } from './types.js';
import type { Pulse } from './engine.js';
import { formatClockish, formatDuration, formatSigned, minutesOfDay, parseHHMM } from './time.js';
import { hasBreak } from './schedule.js';

export type AlertKind =
  'DAY_START' | 'LUNCH_START' | 'LUNCH_END' | 'DAY_END' | 'CAN_LEAVE' | 'OVERTIME';

export interface Alert {
  kind: AlertKind;
  emoji: string;
  title: string;
  body: string;
  /** Action principale proposée, `null` quand l'alerte est purement informative. */
  action: 'CLOCK_IN' | 'BREAK_START' | 'BREAK_END' | 'CLOCK_OUT' | null;
  actionLabel: string | null;
  /** Une alerte non reportable ne propose que « J'ai compris ». */
  snoozable: boolean;
}

/** Ce que l'application retient des alertes déjà traitées aujourd'hui. */
export interface AlertMemory {
  date: DateISO;
  /** Alerte repoussée jusqu'à cet horodatage. */
  snoozedUntil: Partial<Record<AlertKind, number>>;
  /** Alerte ignorée pour le reste de la journée. */
  dismissed: AlertKind[];
}

export function emptyMemory(date: DateISO): AlertMemory {
  return { date, snoozedUntil: {}, dismissed: [] };
}

/** Remet la mémoire à zéro au passage à une nouvelle journée. */
export function memoryForDay(memory: AlertMemory | null, date: DateISO): AlertMemory {
  return memory && memory.date === date ? memory : emptyMemory(date);
}

export function snooze(
  memory: AlertMemory,
  kind: AlertKind,
  minutes: Minutes,
  now: number,
): AlertMemory {
  return {
    ...memory,
    snoozedUntil: { ...memory.snoozedUntil, [kind]: now + minutes * 60_000 },
  };
}

export function dismiss(memory: AlertMemory, kind: AlertKind): AlertMemory {
  return memory.dismissed.includes(kind)
    ? memory
    : { ...memory, dismissed: [...memory.dismissed, kind] };
}

/** Ordre de priorité : la première alerte due l'emporte. */
const PRIORITY: AlertKind[] = [
  'OVERTIME',
  'CAN_LEAVE',
  'DAY_END',
  'LUNCH_END',
  'LUNCH_START',
  'DAY_START',
];

function enabled(kind: AlertKind, settings: Settings): boolean {
  const n = settings.notifications;
  if (!n.enabled) return false;
  switch (kind) {
    case 'DAY_START':
      return n.dayStart;
    case 'LUNCH_START':
      return n.lunchStart;
    case 'LUNCH_END':
      return n.lunchEnd;
    case 'DAY_END':
      return n.dayEnd;
    // Les alertes issues du compteur suivent l'interrupteur général.
    default:
      return true;
  }
}

/**
 * Une alerte est due si son horaire de référence est passé et si sa condition
 * tient toujours. Les alertes CAN_LEAVE et OVERTIME ne dépendent, elles, que
 * de l'état du compteur : c'est le moteur qui décide, pas l'horloge (règle 7).
 */
function build(kind: AlertKind, pulse: Pulse, now: number): Alert | null {
  const minutes = minutesOfDay(now);
  const past = (hhmm: string) => minutes >= parseHHMM(hhmm);
  const { day, phase, week, schedule } = pulse;
  const isWorkingDay = day.planned > 0;

  switch (kind) {
    case 'DAY_START':
      if (!isWorkingDay || phase !== 'NOT_STARTED' || !past(schedule.start)) return null;
      return {
        kind,
        emoji: '🕗',
        title: 'Tu as commencé à travailler ?',
        body:
          schedule.pattern === 'AFTERNOON'
            ? `Ton après-midi commence à ${schedule.start}.`
            : `Aucun pointage d’arrivée depuis ${schedule.start}.`,
        action: 'CLOCK_IN',
        actionLabel: 'Pointer maintenant',
        snoozable: true,
      };

    case 'LUNCH_START':
      // Une demi-journée n'a pas de coupure : l'alerte n'a pas lieu d'être.
      if (!hasBreak(schedule)) return null;
      if (phase !== 'WORKING' || day.computation.breaks > 0 || !past(schedule.breakStart!)) {
        return null;
      }
      return {
        kind,
        emoji: '🍽️',
        title: 'Pause déjeuner ?',
        body: `${formatClockish(day.worked)} travaillées ce matin.`,
        action: 'BREAK_START',
        actionLabel: 'Commencer ma pause',
        snoozable: true,
      };

    case 'LUNCH_END':
      if (!hasBreak(schedule)) return null;
      if (phase !== 'BREAK' || !past(schedule.breakEnd!)) return null;
      if (pulse.breakVerdict && !pulse.breakVerdict.allowed) return null;
      return {
        kind,
        emoji: '⏱️',
        title: 'Reprise du travail',
        body: `Pause de ${formatDuration(day.computation.breaks)}.`,
        action: 'BREAK_END',
        actionLabel: 'Reprendre',
        snoozable: true,
      };

    case 'DAY_END':
      if ((phase !== 'WORKING' && phase !== 'BREAK') || !past(schedule.end)) return null;
      return pulse.canLeave
        ? {
            kind,
            emoji: '🏠',
            title: 'Fin de journée. Tu peux rentrer.',
            body:
              pulse.advanceBeforeToday > 0 && day.worked < day.planned
                ? 'Ton avance couvre le retard d’aujourd’hui.'
                : `${formatClockish(day.worked)} aujourd’hui, solde ${formatSigned(pulse.standing)}.`,
            action: 'CLOCK_OUT',
            actionLabel: 'Pointer mon départ',
            snoozable: true,
          }
        : {
            kind,
            emoji: '⏱️',
            title: `Il te reste ${formatDuration(Math.ceil(pulse.remainingToday))}`,
            body: 'Pour atteindre ton objectif du jour.',
            action: null,
            actionLabel: null,
            snoozable: true,
          };

    case 'CAN_LEAVE':
      // L'objectif est couvert avant l'heure habituelle : on le dit tout de suite.
      if (phase !== 'WORKING' || !pulse.canLeave || past(schedule.end)) return null;
      return {
        kind,
        emoji: '🏠',
        title: 'Tu as fait tes heures',
        body: `${formatClockish(day.worked)} aujourd’hui, solde ${formatSigned(pulse.standing)}. Tu peux rentrer.`,
        action: 'CLOCK_OUT',
        actionLabel: 'Pointer mon départ',
        snoozable: true,
      };

    case 'OVERTIME':
      if (phase !== 'WORKING' && phase !== 'BREAK') return null;
      if (!week.overtimeExceeded) return null;
      return {
        kind,
        emoji: '⚠️',
        title: 'Plafond d’heures supplémentaires dépassé',
        body: `${formatSigned(week.overtime)} / ${formatSigned(week.overtimeCap)} cette semaine.`,
        action: 'CLOCK_OUT',
        actionLabel: 'Pointer mon départ',
        snoozable: false,
      };
  }
}

/** L'alerte à présenter maintenant, ou `null` s'il n'y a rien à dire. */
export function dueAlert(
  pulse: Pulse,
  settings: Settings,
  memory: AlertMemory,
  now: number = pulse.now,
): Alert | null {
  for (const kind of PRIORITY) {
    if (!enabled(kind, settings)) continue;
    if (memory.dismissed.includes(kind)) continue;
    const until = memory.snoozedUntil[kind];
    if (until !== undefined && now < until) continue;
    const alert = build(kind, pulse, now);
    if (alert) return alert;
  }
  return null;
}

/**
 * Faut-il pousser une notification système ? L'alerte reste affichée en
 * permanence dans l'application ; la notification, elle, se répète au rythme
 * choisi dans les réglages tant qu'on n'y répond pas.
 */
export function shouldNotify(
  lastNotifiedAt: number | undefined,
  settings: Settings,
  now: number,
): boolean {
  if (lastNotifiedAt === undefined) return true;
  return now - lastNotifiedAt >= settings.notifications.repeatMinutes * 60_000;
}

/** Un rappel programmable à l'avance, exprimé en minutes depuis minuit. */
export interface PlannedAlert {
  kind: AlertKind;
  minutesOfDay: Minutes;
  title: string;
  body: string;
}

/**
 * Rappels d'une journée, connus d'avance à partir de son horaire.
 *
 * Les alertes du moteur (« tu peux rentrer », « plafond dépassé ») dépendent du
 * compteur en temps réel et ne peuvent pas être programmées ; celles-ci, oui.
 * C'est ce qui permet à l'application installée de prévenir même fermée.
 */
export function dailyAlertPlan(schedule: DaySchedule, settings: Settings): PlannedAlert[] {
  const n = settings.notifications;
  if (!n.enabled || schedule.minutes === 0) return [];

  const plan: PlannedAlert[] = [];
  const demiJournee = schedule.pattern === 'MORNING' || schedule.pattern === 'AFTERNOON';

  if (n.dayStart) {
    plan.push({
      kind: 'DAY_START',
      minutesOfDay: parseHHMM(schedule.start),
      title: '🕗 Tu as commencé à travailler ?',
      body: demiJournee
        ? `Ta ${schedule.pattern === 'MORNING' ? 'matinée' : 'après-midi'} commence à ${schedule.start}.`
        : `Pense à pointer ton arrivée.`,
    });
  }

  if (n.lunchStart && schedule.breakStart !== undefined) {
    plan.push({
      kind: 'LUNCH_START',
      minutesOfDay: parseHHMM(schedule.breakStart),
      title: '🍽️ Pause déjeuner ?',
      body: 'Pense à couper le compteur.',
    });
  }

  if (n.lunchEnd && schedule.breakEnd !== undefined) {
    plan.push({
      kind: 'LUNCH_END',
      minutesOfDay: parseHHMM(schedule.breakEnd),
      title: '⏱️ Reprise du travail',
      body: 'La pause est terminée.',
    });
  }

  if (n.dayEnd) {
    plan.push({
      kind: 'DAY_END',
      minutesOfDay: parseHHMM(schedule.end),
      title: '🏠 Fin de journée',
      body: 'Ouvre WorkPulse pour voir où tu en es.',
    });
  }

  return plan.sort((a, b) => a.minutesOfDay - b.minutesOfDay);
}
