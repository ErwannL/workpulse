import type { Pulse } from '@/core/engine';

/**
 * Couleur associée à l'état du moteur. Une seule source de vérité pour
 * l'anneau, le bandeau et les pastilles : l'écran change de couleur en même
 * temps que l'état, jamais indépendamment.
 */
export function stateTone(pulse: Pulse): string {
  switch (pulse.state) {
    case 'OVERTIME_LIMIT_REACHED':
      return 'var(--coral)';
    case 'BREAK':
      return 'var(--amber)';
    case 'HOLIDAY':
    case 'ABSENT':
      return 'var(--violet)';
    case 'DAY_COMPLETE':
    case 'WEEK_COMPLETE':
      return 'var(--mint)';
    default:
      return pulse.canLeave ? 'var(--mint)' : 'var(--sky)';
  }
}
