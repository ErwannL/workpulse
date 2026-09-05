import { describe, expect, it } from 'vitest';
import { sanitizeJson, MAX_PAYLOAD_KEYS, MAX_PAYLOAD_DEPTH } from './safety.js';

/**
 * Les réglages voyagent en JSON libre : c'est le seul endroit de l'API où le
 * client décide de la forme des données. Un objet malveillant y a donc sa
 * meilleure chance, et ces tests décrivent ce qui doit être refusé.
 */
describe('sanitizeJson — pollution de prototype', () => {
  it('retire __proto__ au lieu de le fusionner', () => {
    const hostile = JSON.parse('{"dailyMinutes":420,"__proto__":{"pollue":true}}');
    const propre = sanitizeJson(hostile) as Record<string, unknown>;

    expect(propre.dailyMinutes).toBe(420);
    expect(Object.keys(propre)).not.toContain('__proto__');
    expect(({} as Record<string, unknown>).pollue).toBeUndefined();
  });

  it('retire constructor et prototype', () => {
    const hostile = JSON.parse(
      '{"constructor":{"prototype":{"pollue":true}},"prototype":{"x":1},"ok":1}',
    );
    const propre = sanitizeJson(hostile) as Record<string, unknown>;
    expect(Object.keys(propre)).toEqual(['ok']);
  });

  it('nettoie aussi les objets imbriqués', () => {
    const hostile = JSON.parse('{"a":{"b":{"__proto__":{"pollue":true},"garde":1}}}');
    const propre = sanitizeJson(hostile) as { a: { b: Record<string, unknown> } };
    expect(Object.keys(propre.a.b)).toEqual(['garde']);
  });

  it('traverse les tableaux', () => {
    const hostile = JSON.parse('[{"__proto__":{"p":1},"ok":2}]');
    const propre = sanitizeJson(hostile) as Record<string, unknown>[];
    expect(Object.keys(propre[0])).toEqual(['ok']);
  });
});

describe('sanitizeJson — abus de volume', () => {
  it('refuse un objet trop profond', () => {
    let profond: unknown = { fin: true };
    for (let i = 0; i < MAX_PAYLOAD_DEPTH + 5; i++) profond = { suivant: profond };
    expect(() => sanitizeJson(profond)).toThrow(/profond/i);
  });

  it('accepte une profondeur raisonnable', () => {
    let ok: unknown = { fin: true };
    for (let i = 0; i < MAX_PAYLOAD_DEPTH - 2; i++) ok = { suivant: ok };
    expect(() => sanitizeJson(ok)).not.toThrow();
  });

  it('refuse un objet à trop de clés', () => {
    const large: Record<string, number> = {};
    for (let i = 0; i <= MAX_PAYLOAD_KEYS; i++) large[`k${i}`] = i;
    expect(() => sanitizeJson(large)).toThrow(/clés|volumineux/i);
  });

  it('refuse un tableau démesuré', () => {
    expect(() => sanitizeJson(new Array(MAX_PAYLOAD_KEYS + 1).fill(0))).toThrow();
  });
});

describe('sanitizeJson — valeurs', () => {
  it('laisse passer les scalaires', () => {
    expect(sanitizeJson(42)).toBe(42);
    expect(sanitizeJson('texte')).toBe('texte');
    expect(sanitizeJson(true)).toBe(true);
    expect(sanitizeJson(null)).toBeNull();
  });

  it('rend une copie : modifier le résultat ne touche pas la source', () => {
    const source = { a: { b: 1 } };
    const copie = sanitizeJson(source) as { a: { b: number } };
    copie.a.b = 2;
    expect(source.a.b).toBe(1);
  });

  it('refuse une valeur non sérialisable', () => {
    expect(() => sanitizeJson({ f: () => 1 } as never)).toThrow(/type/i);
    expect(() => sanitizeJson({ n: Number.NaN })).toThrow(/fini|nombre/i);
  });
});
