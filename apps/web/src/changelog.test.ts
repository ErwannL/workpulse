import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHANGELOG,
  changelogSince,
  compareVersions,
  pendingRelease,
  readLastSeenVersion,
  writeLastSeenVersion,
  type ChangelogRelease,
} from './changelog';

const journal: ChangelogRelease[] = [
  {
    version: '0.4.0',
    date: '2026-09-05',
    sections: [{ titre: 'Ajouté', entrees: ['Demi-journées'] }],
  },
  { version: '0.3.0', date: '2026-09-05', sections: [{ titre: 'Ajouté', entrees: ['Monorepo'] }] },
  { version: '0.2.1', date: '2026-09-04', sections: [{ titre: 'Modifié', entrees: ['Anneau'] }] },
];

beforeEach(() => {
  localStorage.clear();
});

describe('compareVersions', () => {
  it('ordonne les versions par majeur, mineur puis correctif', () => {
    expect(compareVersions('1.0.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareVersions('0.4.0', '0.3.9')).toBeGreaterThan(0);
    expect(compareVersions('0.2.1', '0.2.2')).toBeLessThan(0);
    expect(compareVersions('0.4.0', '0.4.0')).toBe(0);
  });

  it('tolère un numéro incomplet ou illisible', () => {
    expect(compareVersions('1', '0.9.9')).toBeGreaterThan(0);
    expect(compareVersions('abc', '0.0.0')).toBe(0);
  });
});

describe('changelogSince', () => {
  it('renvoie tout le journal en l’absence de version connue', () => {
    expect(changelogSince(null, journal)).toHaveLength(3);
  });

  it('ne renvoie que les versions postérieures', () => {
    expect(changelogSince('0.3.0', journal).map((r) => r.version)).toEqual(['0.4.0']);
    expect(changelogSince('0.2.1', journal).map((r) => r.version)).toEqual(['0.4.0', '0.3.0']);
  });

  it('ne renvoie rien quand l’appareil est à jour', () => {
    expect(changelogSince('0.4.0', journal)).toEqual([]);
  });
});

describe('mémoire de la dernière version vue', () => {
  it('part de rien puis retient la version', () => {
    expect(readLastSeenVersion()).toBeNull();
    writeLastSeenVersion('0.3.0');
    expect(readLastSeenVersion()).toBe('0.3.0');
  });

  it('survit à un stockage indisponible', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('navigation privée');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('navigation privée');
    });

    expect(readLastSeenVersion()).toBeNull();
    expect(() => writeLastSeenVersion('0.4.0')).not.toThrow();

    get.mockRestore();
    set.mockRestore();
  });
});

describe('pendingRelease', () => {
  it('ne montre rien lors d’une première installation', () => {
    expect(pendingRelease(null, '0.4.0', journal)).toEqual([]);
  });

  it('montre ce qui a changé depuis la version installée', () => {
    expect(pendingRelease('0.2.1', '0.4.0', journal).map((r) => r.version)).toEqual([
      '0.4.0',
      '0.3.0',
    ]);
  });

  it('ne montre rien si la version n’a pas bougé', () => {
    expect(pendingRelease('0.4.0', '0.4.0', journal)).toEqual([]);
  });

  it('ne montre rien après un retour à une version antérieure', () => {
    expect(pendingRelease('0.4.0', '0.3.0', journal)).toEqual([]);
  });

  it('lit la mémoire de l’appareil quand aucune version n’est fournie', () => {
    expect(pendingRelease(undefined, '0.4.0', journal)).toEqual([]);
    writeLastSeenVersion('0.2.1');
    expect(pendingRelease(undefined, '0.4.0', journal)).toHaveLength(2);
  });
});

describe('journal embarqué', () => {
  it('est généré depuis CHANGELOG.md et non vide', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
    expect(CHANGELOG[0].sections.length).toBeGreaterThan(0);
  });

  it('est trié de la version la plus récente à la plus ancienne', () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(compareVersions(CHANGELOG[i - 1].version, CHANGELOG[i].version)).toBeGreaterThan(0);
    }
  });

  it('ne contient pas la section « Non publié »', () => {
    expect(CHANGELOG.some((r) => /non publi/i.test(r.version))).toBe(false);
  });
});
