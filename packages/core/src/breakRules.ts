import type { Minutes, Settings } from './types.js';
import { formatDuration } from './time.js';

export interface BreakVerdict {
  allowed: boolean;
  elapsed: Minutes;
  required: Minutes;
  remaining: Minutes;
  title: string;
  message: string;
}

/**
 * Suggestions affichées quand la pause minimale n'est pas encore écoulée.
 * Choisies de façon déterministe pour ne pas changer à chaque rendu.
 */
const NUDGES: { title: string; body: (left: string) => string }[] = [
  { title: 'Pas si vite 🍿', body: (l) => `Tu as encore droit à ${l} de Netflix.` },
  { title: 'Et si tu allais prendre l’air ?', body: (l) => `${l} dehors, ça ne se refuse pas.` },
  {
    title: 'La pause n’est pas finie ☕',
    body: (l) => `Encore ${l}. Le café ne va pas se boire tout seul.`,
  },
  { title: 'Reste assis 🧘', body: (l) => `${l} de plus. Ton écran ne s’enfuira pas.` },
  { title: 'Non. 🙅', body: (l) => `Minimum légal non atteint : il te reste ${l}.` },
  { title: 'Un épisode de plus ? 📺', body: (l) => `Il te reste ${l} avant de pouvoir reprendre.` },
];

/**
 * La pause déjeuner minimale est une contrainte dure : reprendre avant
 * `minBreakMinutes` est refusé tant que la règle est active dans les réglages.
 */
export function evaluateBreak(breakStart: number, now: number, settings: Settings): BreakVerdict {
  const elapsed = Math.max(0, (now - breakStart) / 60_000);
  const required = settings.minBreakMinutes;
  const remaining = Math.max(0, required - elapsed);
  const allowed = !settings.enforceMinBreak || remaining <= 0;

  if (allowed) {
    return {
      allowed: true,
      elapsed,
      required,
      remaining: 0,
      title: 'Reprendre le travail',
      message: `Pause de ${formatDuration(elapsed)}.`,
    };
  }

  const nudge = NUDGES[Math.floor(elapsed) % NUDGES.length];
  const left = formatDuration(Math.ceil(remaining));
  return {
    allowed: false,
    elapsed,
    required,
    remaining,
    title: nudge.title,
    message: nudge.body(left),
  };
}
