/**
 * Assainissement du seul champ libre du protocole : les réglages.
 *
 * Tout le reste de la synchronisation est décrit par des DTO validés champ par
 * champ. Les réglages, eux, sont volontairement opaques — leur forme appartient
 * au domaine, pas à la base. Cette liberté est aussi une porte : un objet JSON
 * contenant `__proto__` peut, une fois fusionné par un `{...a, ...b}`, modifier
 * le prototype d'`Object` et donc le comportement de tout le processus.
 *
 * On recopie donc l'objet clé par clé, en écartant les clés dangereuses et en
 * bornant taille et profondeur.
 */

/** Clés qui permettent d'atteindre le prototype d'un objet. */
const CLES_INTERDITES = new Set(['__proto__', 'constructor', 'prototype']);

/** Au-delà, l'objet n'est plus un réglage mais une tentative d'épuisement. */
export const MAX_PAYLOAD_DEPTH = 12;
export const MAX_PAYLOAD_KEYS = 512;

export class PayloadRejeteError extends Error {}

/**
 * Renvoie une copie sûre de `valeur`, ou lève si elle est inacceptable.
 * La copie est profonde : le résultat ne partage aucune référence avec l'entrée.
 */
export function sanitizeJson(valeur: unknown, profondeur = 0): unknown {
  if (profondeur > MAX_PAYLOAD_DEPTH) {
    throw new PayloadRejeteError(
      `Objet trop profond : plus de ${MAX_PAYLOAD_DEPTH} niveaux d'imbrication.`,
    );
  }

  if (valeur === null) return null;

  switch (typeof valeur) {
    case 'string':
    case 'boolean':
      return valeur;
    case 'number':
      if (!Number.isFinite(valeur)) {
        throw new PayloadRejeteError('Nombre non fini refusé : JSON ne sait pas le représenter.');
      }
      return valeur;
    case 'object':
      break;
    default:
      throw new PayloadRejeteError(`Type non sérialisable refusé : ${typeof valeur}.`);
  }

  if (Array.isArray(valeur)) {
    if (valeur.length > MAX_PAYLOAD_KEYS) {
      throw new PayloadRejeteError(
        `Tableau trop volumineux : plus de ${MAX_PAYLOAD_KEYS} entrées.`,
      );
    }
    return valeur.map((element) => sanitizeJson(element, profondeur + 1));
  }

  const entrees = Object.entries(valeur as Record<string, unknown>);
  if (entrees.length > MAX_PAYLOAD_KEYS) {
    throw new PayloadRejeteError(`Objet trop volumineux : plus de ${MAX_PAYLOAD_KEYS} clés.`);
  }

  // `Object.create(null)` éviterait tout héritage, mais le résultat doit rester
  // un objet ordinaire pour traverser Prisma et JSON.stringify sans surprise.
  const propre: Record<string, unknown> = {};
  for (const [cle, sousValeur] of entrees) {
    if (CLES_INTERDITES.has(cle)) continue;
    propre[cle] = sanitizeJson(sousValeur, profondeur + 1);
  }
  return propre;
}
