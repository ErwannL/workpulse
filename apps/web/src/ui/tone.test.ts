import { describe, expect, it } from 'vitest';
import type { Pulse } from '@workpulse/core';
import { stateTone } from './tone';

const pulse = (state: Pulse['state'], canLeave = false) => ({ state, canLeave }) as Pulse;

describe('stateTone', () => {
  it('passe au rouge quand le plafond est dépassé', () => {
    expect(stateTone(pulse('OVERTIME_LIMIT_REACHED'))).toBe('var(--coral)');
  });

  it('passe à l’ambre pendant la pause', () => {
    expect(stateTone(pulse('BREAK'))).toBe('var(--amber)');
  });

  it('passe au violet les jours non travaillés', () => {
    expect(stateTone(pulse('HOLIDAY'))).toBe('var(--violet)');
    expect(stateTone(pulse('ABSENT'))).toBe('var(--violet)');
  });

  it('passe au vert quand la journée ou la semaine est bouclée', () => {
    expect(stateTone(pulse('DAY_COMPLETE'))).toBe('var(--mint)');
    expect(stateTone(pulse('WEEK_COMPLETE'))).toBe('var(--mint)');
  });

  it('suit la possibilité de partir dans les autres cas', () => {
    expect(stateTone(pulse('WORKING', false))).toBe('var(--sky)');
    expect(stateTone(pulse('WORKING', true))).toBe('var(--mint)');
    expect(stateTone(pulse('NOT_STARTED', false))).toBe('var(--sky)');
  });
});
