import type { DateISO, DayPhase, Minutes, PulseState, PulseTrend } from './types.js';
import { evaluateBreak, type BreakVerdict } from './breakRules.js';
import {
  carryInFor,
  summarizeDay,
  summarizeWeek,
  type DaySummary,
  type LedgerSource,
  type WeekSummary,
} from './ledger.js';
import { clock, formatClockish, formatDuration, formatSigned, todayISO } from './time.js';

/** Tolérance autour de l'objectif avant de parler d'avance ou de retard. */
export const TREND_TOLERANCE: Minutes = 10;

export interface Pulse {
  now: number;
  date: DateISO;
  state: PulseState;
  trend: PulseTrend;
  phase: DayPhase;
  day: DaySummary;
  week: WeekSummary;
  /** Avance ou retard hors journée en cours (report + autres jours de la semaine). */
  advanceBeforeToday: Minutes;
  /** Avance ou retard total, journée en cours incluse. */
  totalBalance: Minutes;
  /**
   * Solde affiché. Tant que la journée court, les heures qu'il reste à faire
   * aujourd'hui ne comptent pas comme du retard — on a encore le temps.
   * Les heures faites en plus, elles, comptent immédiatement.
   */
  standing: Minutes;
  /** Ce qu'il faut réellement faire aujourd'hui compte tenu de l'avance. */
  requiredToday: Minutes;
  /** Ce qu'il reste à faire aujourd'hui. */
  remainingToday: Minutes;
  /** Pause minimale restant à prendre avant de pouvoir partir. */
  pendingBreak: Minutes;
  canLeave: boolean;
  /** Heure de départ recommandée, avance comprise. */
  leaveAt: number | null;
  /** Heure de départ pour boucler les heures du jour, sans compter l'avance. */
  leaveAtDayTarget: number | null;
  breakVerdict: BreakVerdict | null;
  emoji: string;
  headline: string;
  detail: string;
}

function trendOf(balance: Minutes): PulseTrend {
  if (balance > TREND_TOLERANCE) return 'AHEAD';
  if (balance < -TREND_TOLERANCE) return 'BEHIND';
  return 'ON_TARGET';
}

/**
 * Moteur de décision central. Tout ce que l'application affiche ou notifie
 * découle de cet état : aucune règle n'est recodée dans l'interface.
 */
export function computePulse(src: LedgerSource, date: DateISO = todayISO(src.now)): Pulse {
  const day = summarizeDay(src, date);
  const week = summarizeWeek(src, date, carryInFor(src, date));
  const settings = src.settings;

  const otherDaysBalance = week.days
    .filter((d) => d.date !== date && d.elapsed)
    .reduce((s, d) => s + d.balance, 0);
  const advanceBeforeToday = week.carryIn + otherDaysBalance;
  const totalBalance = advanceBeforeToday + day.balance;

  // Objectif du jour ajusté : l'avance l'allège, le retard l'alourdit,
  // sans jamais dépasser le plafond d'heures supplémentaires.
  const maxToday = day.planned + settings.overtimeCapMinutes;
  const requiredToday =
    day.planned === 0 ? 0 : Math.min(maxToday, Math.max(0, day.planned - advanceBeforeToday));
  const remainingToday = Math.max(0, requiredToday - day.worked);

  // Une longue journée impose la pause minimale : elle décale l'heure de départ.
  const willExceedBreakThreshold = day.worked + remainingToday > 6 * 60;
  const pendingBreak = willExceedBreakThreshold
    ? Math.max(0, settings.minBreakMinutes - day.computation.breaks)
    : 0;

  const phase = day.computation.phase;
  const breakVerdict =
    phase === 'BREAK' && day.computation.openBreakStart !== null
      ? evaluateBreak(day.computation.openBreakStart, src.now, settings)
      : null;

  const canLeave = day.planned === 0 || remainingToday <= 0;

  let leaveAt: number | null = null;
  let leaveAtDayTarget: number | null = null;
  if (phase === 'WORKING' || phase === 'BREAK') {
    const breakOffset = breakVerdict && !breakVerdict.allowed ? breakVerdict.remaining : 0;
    const extraBreak = Math.max(pendingBreak - breakOffset, 0);
    const delay = (breakOffset + extraBreak) * 60_000;
    leaveAt = src.now + remainingToday * 60_000 + delay;
    leaveAtDayTarget = src.now + Math.max(0, day.planned - day.worked) * 60_000 + delay;
  }

  const state = resolveState({ day, week, phase, remainingToday });
  const dayOver = phase === 'CLOCKED_OUT' || day.planned === 0;
  const standing = dayOver ? totalBalance : advanceBeforeToday + Math.max(0, day.balance);
  const trend = trendOf(standing);

  const { emoji, headline, detail } = narrate({
    state,
    day,
    week,
    advanceBeforeToday,
    totalBalance: standing,
    remainingToday,
    breakVerdict,
  });

  return {
    now: src.now,
    date,
    state,
    trend,
    phase,
    day,
    week,
    advanceBeforeToday,
    totalBalance,
    standing,
    requiredToday,
    remainingToday,
    pendingBreak,
    canLeave,
    leaveAt,
    leaveAtDayTarget,
    breakVerdict,
    emoji,
    headline,
    detail,
  };
}

function resolveState(ctx: {
  day: DaySummary;
  week: WeekSummary;
  phase: DayPhase;
  remainingToday: Minutes;
}): PulseState {
  const { day, week, phase, remainingToday } = ctx;

  // Journée neutralisée et aucun pointage : férié ou absence assumée.
  if (day.planned === 0 && day.worked === 0 && phase === 'NOT_STARTED') {
    return day.status === 'HOLIDAY' ? 'HOLIDAY' : 'ABSENT';
  }

  if (phase === 'BREAK') return 'BREAK';
  if (week.overtimeExceeded) return 'OVERTIME_LIMIT_REACHED';
  if (phase === 'NOT_STARTED') return 'NOT_STARTED';
  if (week.planned > 0 && week.worked >= week.planned) return 'WEEK_COMPLETE';
  if (remainingToday <= 0) return 'DAY_COMPLETE';
  return 'WORKING';
}

function narrate(ctx: {
  state: PulseState;
  day: DaySummary;
  week: WeekSummary;
  advanceBeforeToday: Minutes;
  totalBalance: Minutes;
  remainingToday: Minutes;
  breakVerdict: BreakVerdict | null;
}): { emoji: string; headline: string; detail: string } {
  const { state, day, week, remainingToday, totalBalance, advanceBeforeToday, breakVerdict } = ctx;
  const worked = formatClockish(day.worked);

  switch (state) {
    case 'HOLIDAY':
      return {
        emoji: '🎉',
        headline: day.holiday ?? 'Jour férié',
        detail: 'Temps théorique : 0h. Profites-en.',
      };

    case 'ABSENT':
      return {
        emoji: '🌴',
        headline: absenceLabel(day),
        detail: 'Cette journée ne pèse pas sur ton solde.',
      };

    case 'NOT_STARTED':
      return {
        emoji: '🕗',
        headline: 'Journée pas encore commencée',
        detail:
          advanceBeforeToday > TREND_TOLERANCE
            ? `Tu démarres avec ${formatSigned(advanceBeforeToday)} d’avance.`
            : advanceBeforeToday < -TREND_TOLERANCE
              ? `Tu démarres avec ${formatSigned(advanceBeforeToday)} à rattraper.`
              : 'Pointe ton arrivée pour lancer le compteur.',
      };

    case 'BREAK':
      return {
        emoji: '☕',
        headline:
          breakVerdict && !breakVerdict.allowed
            ? `Pause — encore ${formatDuration(Math.ceil(breakVerdict.remaining))}`
            : 'En pause',
        detail:
          breakVerdict && !breakVerdict.allowed
            ? breakVerdict.message
            : `${worked} travaillées aujourd’hui.`,
      };

    case 'OVERTIME_LIMIT_REACHED':
      return {
        emoji: '⚠️',
        headline: 'Plafond d’heures supplémentaires dépassé',
        detail: `${formatSigned(week.overtime)} / ${formatSigned(week.overtimeCap)} cette semaine. Rentre chez toi.`,
      };

    case 'WEEK_COMPLETE':
      return {
        emoji: '🏁',
        headline: 'Objectif de la semaine atteint',
        detail: `${formatClockish(week.worked)} / ${formatClockish(week.planned)} — solde ${formatSigned(week.difference)}. Tu peux partir.`,
      };

    case 'DAY_COMPLETE':
      return {
        emoji: '🏠',
        headline:
          advanceBeforeToday > TREND_TOLERANCE && day.worked < day.planned
            ? 'Ton avance couvre ta journée'
            : 'Tu as fait tes heures',
        detail: `${worked} aujourd’hui, solde semaine ${formatSigned(totalBalance)}. Tu peux rentrer.`,
      };

    case 'WORKING':
    default:
      return {
        emoji: '⏱️',
        headline: `Il te reste ${formatDuration(Math.ceil(remainingToday))}`,
        detail:
          totalBalance < -TREND_TOLERANCE
            ? `${worked} aujourd’hui — ${formatSigned(totalBalance)} sur la semaine.`
            : `${worked} aujourd’hui — objectif ${formatClockish(day.planned)}.`,
      };
  }
}

function absenceLabel(day: DaySummary): string {
  switch (day.status) {
    case 'LEAVE':
      return 'Congé';
    case 'RTT':
      return 'RTT';
    case 'SICK':
      return 'Arrêt maladie';
    case 'SPECIAL':
      return 'Événement exceptionnel';
    default:
      return 'Journée non travaillée';
  }
}

/** Phrase compacte du bandeau principal, façon « 16h12 — … ». */
export function pulseSentence(pulse: Pulse): string {
  return `${clock(pulse.now)} — ${pulse.headline} ${pulse.detail}`;
}
