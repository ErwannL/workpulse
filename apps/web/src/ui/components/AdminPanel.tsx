import { useState } from 'react';
import { useStore } from '@/state/context';
import { Card } from './primitives';
import { WhatsNew } from './WhatsNew';
import { APP_VERSION, changelogSince } from '@/changelog';

/**
 * Panneau d'administration : ce qu'il faut pour répondre à « quelle version
 * tourne réellement sur ce téléphone ? » sans brancher un câble.
 */
export function AdminPanel() {
  const store = useStore();
  const [showNews, setShowNews] = useState(false);

  const entryCount = [...store.entries.values()].reduce((sum, list) => sum + list.length, 0);
  const installed =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;

  return (
    <>
      <Card title="Panneau d’administration">
        <div className="rows">
          <div className="row">
            <span className="row__label">Version</span>
            <span className="row__value">
              <span className="chip chip--accent">v{APP_VERSION}</span>
            </span>
          </div>
          <div className="row">
            <span className="row__label">Révision</span>
            <span className="row__value mono small">{__APP_TAG__}</span>
          </div>
          <div className="row">
            <span className="row__label">Commit</span>
            <span className="row__value mono small">{__APP_COMMIT__}</span>
          </div>
          <div className="row">
            <span className="row__label">Compilé le</span>
            <span className="row__value small">
              {new Date(__BUILD_DATE__).toLocaleString('fr-FR')}
            </span>
          </div>
          <div className="row">
            <span className="row__label">Pointages enregistrés</span>
            <span className="row__value">{entryCount}</span>
          </div>
          <div className="row">
            <span className="row__label">Journées annotées</span>
            <span className="row__value">{store.days.size}</span>
          </div>
          <div className="row">
            <span className="row__label">Mode</span>
            <span className="row__value small">
              {installed ? 'Application installée' : 'Navigateur'}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="btn btn--block btn--ghost btn--sm"
          style={{ marginTop: 14 }}
          onClick={() => setShowNews(true)}
        >
          Voir les nouveautés
        </button>
      </Card>

      {showNews && <WhatsNew releases={changelogSince(null)} onClose={() => setShowNews(false)} />}
    </>
  );
}
