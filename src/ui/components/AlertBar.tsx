import { useState } from 'react';
import { formatDuration } from '@/core/time';
import { useAlerts } from '@/state/useAlerts';

/**
 * Bandeau d'alerte, posé au-dessus de la barre d'onglets et visible depuis
 * n'importe quel écran. Chaque alerte offre les mêmes réponses : agir,
 * reporter, ignorer (§17).
 */
export function AlertBar() {
  const { alert, accept, snoozeFor, ignore, snoozeOptions } = useAlerts();
  const [refusal, setRefusal] = useState<string | null>(null);

  if (!alert) return null;

  return (
    <div className="alertbar" role="status">
      <div className="alertbar__head">
        <span className="alertbar__emoji">{alert.emoji}</span>
        <div>
          <p className="alertbar__title">{alert.title}</p>
          <p className="alertbar__body">{refusal ?? alert.body}</p>
        </div>
      </div>

      <div className="alertbar__actions">
        {alert.actionLabel && (
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={async () => {
              const result = await accept();
              if (!result.ok) setRefusal(result.message ?? 'Action refusée.');
            }}
          >
            {alert.actionLabel}
          </button>
        )}
        {alert.snoozable &&
          snoozeOptions.map((m) => (
            <button
              key={m}
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => snoozeFor(m)}
            >
              +{formatDuration(m)}
            </button>
          ))}
        <button type="button" className="btn btn--sm btn--quiet" onClick={ignore}>
          {alert.snoozable ? 'Ignorer' : 'J’ai compris'}
        </button>
      </div>
    </div>
  );
}
