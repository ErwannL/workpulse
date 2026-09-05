import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressRing } from './ProgressRing';

/**
 * L'anneau porte la couleur de l'état, décidée une seule fois par `stateTone`.
 * Il ne doit pas en inventer une autre : deux couleurs contradictoires sur le
 * même écran, c'est l'utilisateur qui doit trancher — exactement ce que
 * l'application est censée lui éviter.
 */
describe('anneau de progression', () => {
  const arcs = (container: HTMLElement) => ({
    principal: container.querySelector('.ring__value')!,
    depassement: container.querySelector('.ring__overflow'),
  });

  it('garde la couleur de l’état quand l’objectif est dépassé', () => {
    // 7h12 sur 7h00 : la journée est finie et l'écran l'annonce en vert.
    // Repeindre l'anneau en orange le contredirait pour douze minutes.
    const { container } = render(
      <ProgressRing value={432} target={420} big="7h12" color="var(--mint)" />,
    );
    const { principal, depassement } = arcs(container);

    expect(principal.getAttribute('stroke')).toBe('var(--mint)');
    expect(depassement).not.toBeNull();
    expect(depassement!.getAttribute('stroke')).toBe('var(--amber)');
  });

  it('n’affiche aucun arc de dépassement en deçà de l’objectif', () => {
    const { container } = render(
      <ProgressRing value={200} target={420} big="3h20" color="var(--sky)" />,
    );
    const { principal, depassement } = arcs(container);

    expect(principal.getAttribute('stroke')).toBe('var(--sky)');
    expect(depassement).toBeNull();
  });
});
