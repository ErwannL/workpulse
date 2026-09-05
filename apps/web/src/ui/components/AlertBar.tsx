import { useEffect, useRef, useState } from 'react';
import { formatDuration } from '@workpulse/core';
import { useAlerts } from '@/state/useAlerts';

/**
 * Bandeau d'alerte, posé au-dessus de la barre d'onglets et visible depuis
 * n'importe quel écran. Chaque alerte offre les mêmes réponses : agir,
 * reporter, ignorer (§17).
 */
export function AlertBar() {
  const { alert, accept, snoozeFor, ignore, snoozeOptions } = useAlerts();
  const [refusal, setRefusal] = useState<string | null>(null);
  const bandeau = useRef<HTMLDivElement>(null);

  /*
   * Le bandeau flotte au-dessus du contenu : sans réserver sa place, il
   * masquerait le bouton de pointage, c'est-à-dire précisément ce qu'il
   * demande d'actionner. Sa hauteur est mesurée plutôt que devinée, pour
   * rester juste quel que soit le nombre de lignes du message.
   */
  useEffect(() => {
    const element = bandeau.current;
    const racine = document.documentElement;
    if (element === null) {
      racine.style.removeProperty('--alertbar-h');
      return;
    }

    const publier = () => {
      racine.style.setProperty('--alertbar-h', `${element.offsetHeight}px`);
    };
    publier();

    const observateur = new ResizeObserver(publier);
    observateur.observe(element);
    return () => {
      observateur.disconnect();
      racine.style.removeProperty('--alertbar-h');
    };
  }, [alert]);

  if (!alert) return null;

  return (
    <div className="alertbar" role="status" ref={bandeau}>
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
