import { useEffect, type ReactNode } from 'react';

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <h2 className="card__title">
          <span>{title}</span>
          {action}
        </h2>
      )}
      {children}
    </section>
  );
}

export function Row({
  label,
  value,
  tone,
  onClick,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: 'pos' | 'neg' | 'over' | 'muted';
  onClick?: () => void;
}) {
  const cls = tone ? ` value-${tone}` : '';
  const content = (
    <>
      <span className="row__label">{label}</span>
      <span className={`row__value${cls}`}>{value}</span>
    </>
  );
  return onClick ? (
    <button type="button" className="row row--tappable" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="row">{content}</div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={() => onChange(!checked)}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <div>
        <div className="field__label">{label}</div>
        {hint && <div className="field__hint">{hint}</div>}
      </div>
      <div className="field__control">{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  // La feuille capture Échap et bloque le défilement de la page en dessous.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="sheet-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet">
        <div className="sheet__grip" />
        <h2 className="sheet__title">{title}</h2>
        {subtitle && <p className="sheet__sub">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export function Banner({
  tone = 'warn',
  icon,
  children,
}: {
  tone?: 'warn' | 'danger' | 'info';
  icon?: ReactNode;
  children: ReactNode;
}) {
  const cls = tone === 'warn' ? '' : ` banner--${tone}`;
  return (
    <div className={`banner${cls}`}>
      {icon}
      <div>{children}</div>
    </div>
  );
}

export function Metric({ value, label, tone }: { value: ReactNode; label: ReactNode; tone?: string }) {
  return (
    <div className="metric">
      <div className={`metric__value${tone ? ` value-${tone}` : ''}`}>{value}</div>
      <div className="metric__label">{label}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
