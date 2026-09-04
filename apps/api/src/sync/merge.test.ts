import { describe, expect, it } from 'vitest';
import { changedSince, mergeRecords, nextCursor, pickWinner, type Versioned } from './merge';

const rec = (id: string, updatedAt: number, deletedAt: number | null = null): Versioned => ({
  id,
  updatedAt,
  deletedAt,
});

describe('pickWinner', () => {
  it('garde la version la plus récente', () => {
    expect(pickWinner(rec('a', 10), rec('a', 20))?.updatedAt).toBe(20);
    expect(pickWinner(rec('a', 30), rec('a', 20))?.updatedAt).toBe(30);
  });

  it('en cas d’égalité, le serveur l’emporte pour rester déterministe', () => {
    const server = rec('a', 10);
    expect(pickWinner(server, rec('a', 10))).toBe(server);
  });

  it('accepte l’arrivée d’une ligne inconnue du serveur', () => {
    expect(pickWinner(undefined, rec('a', 5))?.id).toBe('a');
  });

  it('conserve une ligne que le client n’a pas envoyée', () => {
    expect(pickWinner(rec('a', 5), undefined)?.id).toBe('a');
  });

  it('une suppression plus récente l’emporte sur une modification plus ancienne', () => {
    const winner = pickWinner(rec('a', 10), rec('a', 20, 20));
    expect(winner?.deletedAt).toBe(20);
  });

  it('une modification plus récente ressuscite une ligne supprimée', () => {
    const winner = pickWinner(rec('a', 10, 10), rec('a', 20));
    expect(winner?.deletedAt).toBeNull();
  });
});

describe('mergeRecords', () => {
  it('ne réécrit que ce qui a réellement changé', () => {
    const result = mergeRecords([rec('a', 10), rec('b', 10)], [rec('a', 10), rec('b', 20)]);
    expect(result.toPersist.map((r) => r.id)).toEqual(['b']);
  });

  it('remonte les lignes que le client ignore', () => {
    const result = mergeRecords([rec('a', 10)], []);
    expect(result.toPersist).toEqual([]);
    expect(result.merged.map((r) => r.id)).toEqual(['a']);
  });

  it('insère les lignes inédites', () => {
    const result = mergeRecords([], [rec('c', 5)]);
    expect(result.toPersist.map((r) => r.id)).toEqual(['c']);
    expect(result.merged.map((r) => r.id)).toEqual(['c']);
  });

  it('compte les conflits réellement arbitrés', () => {
    const result = mergeRecords([rec('a', 30), rec('b', 10)], [rec('a', 20), rec('b', 20)]);
    expect(result.conflicts).toBe(1);
    expect(result.merged.find((r) => r.id === 'a')?.updatedAt).toBe(30);
  });

  it('rend un résultat stable, trié par identifiant', () => {
    const result = mergeRecords([rec('c', 1)], [rec('a', 1), rec('b', 1)]);
    expect(result.merged.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('ignore les doublons d’identifiant dans le lot entrant', () => {
    const result = mergeRecords([], [rec('a', 10), rec('a', 20)]);
    expect(result.merged).toHaveLength(1);
    expect(result.merged[0].updatedAt).toBe(20);
  });
});

describe('changedSince', () => {
  it('renvoie tout quand le client n’a pas de curseur', () => {
    expect(changedSince([rec('a', 1), rec('b', 2)], null)).toHaveLength(2);
  });

  it('ne renvoie que ce qui a bougé depuis le curseur', () => {
    expect(changedSince([rec('a', 1), rec('b', 5)], 1).map((r) => r.id)).toEqual(['b']);
  });
});

describe('nextCursor', () => {
  it('renvoie l’horodatage le plus récent du lot', () => {
    expect(nextCursor([rec('a', 3), rec('b', 9), rec('c', 5)], 0)).toBe(9);
  });

  it('retombe sur la valeur de repli quand le lot est vide', () => {
    expect(nextCursor([], 42)).toBe(42);
  });

  it('ne recule jamais en deçà de la valeur de repli', () => {
    expect(nextCursor([rec('a', 3)], 10)).toBe(10);
  });
});
