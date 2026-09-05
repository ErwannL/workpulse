import type { ChangelogRelease } from '@/changelog';
import { Empty, Sheet } from './primitives';

const EMOJI_SECTION: Record<string, string> = {
  Ajouté: '✨',
  Modifié: '🔧',
  Corrigé: '🐞',
  Supprimé: '🗑️',
  Sécurité: '🔒',
  Déprécié: '⚠️',
};

function formatDate(date: string | null): string {
  if (date === null) return '';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Ce qui a changé depuis la version précédemment installée sur cet appareil.
 * Le contenu vient de CHANGELOG.md : il n'existe pas de seconde liste à tenir.
 */
export function WhatsNew({
  releases,
  onClose,
}: {
  releases: ChangelogRelease[];
  onClose: () => void;
}) {
  const plusieurs = releases.length > 1;

  return (
    <Sheet
      title="Nouveautés"
      subtitle={
        plusieurs
          ? `${releases.length} versions depuis ta dernière ouverture`
          : releases.length === 1
            ? `Version ${releases[0].version}`
            : undefined
      }
      onClose={onClose}
    >
      {releases.length === 0 ? (
        <Empty>Rien de neuf depuis ta dernière visite.</Empty>
      ) : (
        <div className="stack">
          {releases.map((release) => (
            <section key={release.version} className="release">
              <header className="release__head">
                <span className="chip chip--accent">v{release.version}</span>
                <span className="faint small">{formatDate(release.date)}</span>
              </header>
              {release.sections.map((section) => (
                <div key={section.titre} className="release__section">
                  <h3 className="release__title">
                    <span aria-hidden="true">{EMOJI_SECTION[section.titre] ?? '•'}</span>{' '}
                    {section.titre}
                  </h3>
                  <ul className="release__list">
                    {section.entrees.map((entree) => (
                      <li key={entree}>{entree}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      <div className="sheet__actions">
        <button type="button" className="btn btn--block btn--primary" onClick={onClose}>
          C’est noté
        </button>
      </div>
    </Sheet>
  );
}
