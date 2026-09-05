import type { ReactNode } from 'react';

/**
 * Anneau de progression de la journée. Au-delà de l'objectif, un second arc
 * repart du haut pour matérialiser les heures supplémentaires.
 */
export function ProgressRing({
  value,
  target,
  size = 208,
  stroke = 14,
  big,
  label,
  badge,
  color = 'var(--mint)',
  overColor = 'var(--amber)',
}: {
  value: number;
  target: number;
  size?: number;
  stroke?: number;
  big: ReactNode;
  label?: ReactNode;
  badge?: ReactNode;
  color?: string;
  overColor?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = target > 0 ? value / target : value > 0 ? 1 : 0;
  const main = Math.max(0, Math.min(1, ratio));
  const over = Math.max(0, Math.min(1, ratio - 1));

  return (
    <div className="ring" style={{ width: size, height: size, ['--ring-length' as string]: c }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle
          className="ring__track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="ring__value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          // L'anneau garde la couleur de l'état : c'est le fin arc intérieur
          // qui signale le dépassement. Repeindre l'anneau entier faisait dire
          // « attention » à un écran qui annonçait par ailleurs « tu peux
          // rentrer », pour douze minutes de plus que prévu.
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - main)}
        />
        {over > 0 && (
          <circle
            className="ring__overflow"
            cx={size / 2}
            cy={size / 2}
            r={r - stroke - 4}
            fill="none"
            strokeWidth={5}
            stroke={overColor}
            strokeDasharray={2 * Math.PI * (r - stroke - 4)}
            strokeDashoffset={2 * Math.PI * (r - stroke - 4) * (1 - over)}
          />
        )}
      </svg>
      <div className="ring__center">
        {/* La clé rejoue l'animation à chaque changement de valeur. */}
        <div className="ring__big" key={String(big)}>
          {big}
        </div>
        {label && <div className="ring__label">{label}</div>}
        {badge && <div className="ring__badge">{badge}</div>}
      </div>
    </div>
  );
}

/** Barre horizontale avec zone d'heures supplémentaires hachurée. */
export function ProgressBar({
  value,
  target,
  cap = 0,
  live = false,
}: {
  value: number;
  target: number;
  cap?: number;
  /** Journée en cours : la barre porte un reflet lent. */
  live?: boolean;
}) {
  const span = target + cap || 1;
  const filled = Math.max(0, Math.min(value, target)) / span;
  const extra = Math.max(0, Math.min(value - target, cap)) / span;
  const capStart = target / span;
  const overflowing = value > target + cap;

  return (
    <div className="bar">
      <div
        className={`bar__fill${overflowing ? ' bar__fill--over' : ''}${live ? ' bar__fill--live' : ''}`}
        style={{ width: `${filled * 100}%` }}
      />
      {extra > 0 && (
        <div
          className="bar__over"
          style={{ left: `${capStart * 100}%`, width: `${extra * 100}%` }}
        />
      )}
    </div>
  );
}
