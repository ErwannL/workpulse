import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Banner, Card, Empty, Field, Metric, Row, Segmented, Sheet, Switch } from './primitives';
import { ProgressBar, ProgressRing } from './ProgressRing';
import { TabBar } from './TabBar';

describe('Card', () => {
  it('affiche un titre et une action', () => {
    render(
      <Card title="Cette semaine" action={<button type="button">Modifier</button>}>
        contenu
      </Card>,
    );
    expect(screen.getByRole('heading', { name: /cette semaine/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument();
  });

  it('se passe de titre', () => {
    render(<Card>contenu seul</Card>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});

describe('Row', () => {
  it('affiche un libellé et une valeur', () => {
    render(<Row label="Objectif" value="35h00" />);
    expect(screen.getByText('35h00')).toBeInTheDocument();
  });

  it('devient cliquable quand une action est fournie', async () => {
    const onClick = vi.fn();
    render(<Row label="Lundi" value="8h08" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('colore la valeur selon la tonalité', () => {
    const { container } = render(<Row label="Solde" value="+1h08" tone="pos" />);
    expect(container.querySelector('.value-pos')).not.toBeNull();
  });
});

describe('Switch', () => {
  it('expose son état et bascule au clic', async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Alertes" />);
    const toggle = screen.getByRole('switch', { name: 'Alertes' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Segmented', () => {
  it('marque l’option active et signale les changements', async () => {
    const onChange = vi.fn();
    render(
      <Segmented
        options={[
          { value: 'week', label: 'Semaine' },
          { value: 'month', label: 'Mois' },
        ]}
        value="week"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('button', { name: 'Semaine' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Mois' }));
    expect(onChange).toHaveBeenCalledWith('month');
  });
});

describe('Sheet', () => {
  it('se ferme avec Échap', async () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Journée" subtitle="lundi 7 septembre" onClose={onClose}>
        contenu
      </Sheet>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('lundi 7 septembre')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('se ferme en touchant le fond, pas le contenu', async () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Journée" onClose={onClose}>
        <span>contenu</span>
      </Sheet>,
    );
    await userEvent.click(screen.getByText('contenu'));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('rend le défilement de la page en la fermant', () => {
    const { unmount } = render(
      <Sheet title="Journée" onClose={vi.fn()}>
        contenu
      </Sheet>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});

describe('Banner, Metric, Empty, Field', () => {
  it('rend les variantes de bandeau', () => {
    const { container, rerender } = render(<Banner>attention</Banner>);
    expect(container.querySelector('.banner')).not.toBeNull();
    rerender(<Banner tone="danger">refus</Banner>);
    expect(container.querySelector('.banner--danger')).not.toBeNull();
    rerender(
      <Banner tone="info" icon={<span data-testid="icone" />}>
        information
      </Banner>,
    );
    expect(screen.getByTestId('icone')).toBeInTheDocument();
  });

  it('rend une métrique, un vide et un champ', () => {
    render(
      <>
        <Metric value="35h00" label="Objectif" tone="pos" />
        <Empty>Rien à afficher</Empty>
        <Field label="Prénom" hint="Affiché sur l’accueil">
          <input aria-label="prenom" />
        </Field>
      </>,
    );
    expect(screen.getByText('35h00')).toBeInTheDocument();
    expect(screen.getByText('Rien à afficher')).toBeInTheDocument();
    expect(screen.getByText('Affiché sur l’accueil')).toBeInTheDocument();
    expect(screen.getByLabelText('prenom')).toBeInTheDocument();
  });
});

describe('ProgressRing', () => {
  it('remplit l’anneau proportionnellement à l’objectif', () => {
    const { container } = render(
      <ProgressRing value={210} target={420} big="3h30" label="sur 7h00" />,
    );
    const arc = container.querySelector('.ring__value') as SVGCircleElement;
    const total = Number(arc.getAttribute('stroke-dasharray'));
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(total * 0.5, 5);
    expect(screen.getByText('3h30')).toBeInTheDocument();
  });

  it('ajoute un arc de dépassement au-delà de l’objectif', () => {
    const { container } = render(<ProgressRing value={630} target={420} big="10h30" />);
    expect(container.querySelector('.ring__overflow')).not.toBeNull();
  });

  it('n’affiche pas d’arc de dépassement en deçà de l’objectif', () => {
    const { container } = render(<ProgressRing value={100} target={420} big="1h40" />);
    expect(container.querySelector('.ring__overflow')).toBeNull();
  });

  it('reste stable pour un objectif nul', () => {
    const { container } = render(<ProgressRing value={0} target={0} big="0h00" badge="—" />);
    const arc = container.querySelector('.ring__value') as SVGCircleElement;
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeGreaterThan(0);
  });

  it('remplit l’anneau quand du temps est fait sans objectif', () => {
    const { container } = render(<ProgressRing value={60} target={0} big="1h00" />);
    const arc = container.querySelector('.ring__value') as SVGCircleElement;
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBe(0);
  });
});

describe('ProgressBar', () => {
  it('remplit jusqu’à l’objectif', () => {
    const { container } = render(<ProgressBar value={1050} target={2100} cap={240} />);
    const fill = container.querySelector('.bar__fill') as HTMLElement;
    expect(fill.style.width).toBe(`${(1050 / 2340) * 100}%`);
    expect(container.querySelector('.bar__over')).toBeNull();
  });

  it('affiche la zone d’heures supplémentaires', () => {
    const { container } = render(<ProgressBar value={2200} target={2100} cap={240} />);
    expect(container.querySelector('.bar__over')).not.toBeNull();
    expect(container.querySelector('.bar__fill--over')).toBeNull();
  });

  it('signale le dépassement du plafond', () => {
    const { container } = render(<ProgressBar value={2500} target={2100} cap={240} />);
    expect(container.querySelector('.bar__fill--over')).not.toBeNull();
  });

  it('tolère un objectif nul sans division par zéro', () => {
    const { container } = render(<ProgressBar value={0} target={0} />);
    const fill = container.querySelector('.bar__fill') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });
});

describe('TabBar', () => {
  it('marque l’onglet courant et navigue au clic', async () => {
    const onNavigate = vi.fn();
    render(<TabBar route="pulse" onNavigate={onNavigate} />);
    expect(screen.getByRole('button', { name: /aujourd’hui/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await userEvent.click(screen.getByRole('button', { name: /calendrier/i }));
    expect(onNavigate).toHaveBeenCalledWith('calendrier');
  });
});
