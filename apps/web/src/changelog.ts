import donnees from './generated/changelog.json';

export interface ChangelogSection {
  titre: string;
  entrees: string[];
}

export interface ChangelogRelease {
  version: string;
  date: string | null;
  sections: ChangelogSection[];
}

export const APP_VERSION: string = __APP_VERSION__;

/** Le journal complet, de la version la plus récente à la plus ancienne. */
export const CHANGELOG: ChangelogRelease[] = donnees as ChangelogRelease[];

const LAST_SEEN_KEY = 'workpulse.derniereVersionVue';

/** Compare deux numéros de version sémantiques. */
export function compareVersions(a: string, b: string): number {
  // Un numéro tronqué ou illisible est ramené à zéro plutôt que de produire
  // un NaN, qui rendrait toute comparaison ultérieure fausse en silence.
  const parse = (v: string): [number, number, number] => {
    const parts = v.split('.').map((n) => Number.parseInt(n, 10) || 0);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  };
  const [a1, a2, a3] = parse(a);
  const [b1, b2, b3] = parse(b);
  return a1 - b1 || a2 - b2 || a3 - b3;
}

/**
 * Les versions publiées après celle que l'appareil connaissait.
 *
 * `null` — première installation — renvoie tout le journal : c'est le seul cas
 * où l'on montre l'historique complet plutôt qu'un différentiel.
 */
export function changelogSince(
  derniereVue: string | null,
  journal: ChangelogRelease[] = CHANGELOG,
): ChangelogRelease[] {
  if (derniereVue === null) return journal;
  return journal.filter((release) => compareVersions(release.version, derniereVue) > 0);
}

/** Version déjà vue sur cet appareil, ou `null` à la première ouverture. */
export function readLastSeenVersion(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

export function writeLastSeenVersion(version: string = APP_VERSION): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, version);
  } catch {
    // Stockage indisponible : l'écran des nouveautés réapparaîtra, sans gravité.
  }
}

/**
 * Ce qu'il faut montrer à l'ouverture. Rien lors d'une première installation :
 * on n'accueille pas quelqu'un par la liste des correctifs d'une application
 * qu'il n'a jamais utilisée.
 */
export function pendingRelease(
  derniereVue: string | null = readLastSeenVersion(),
  version: string = APP_VERSION,
  journal: ChangelogRelease[] = CHANGELOG,
): ChangelogRelease[] {
  if (derniereVue === null) return [];
  if (compareVersions(version, derniereVue) <= 0) return [];
  return changelogSince(derniereVue, journal);
}
