/**
 * Résolution de conflit de la synchronisation.
 *
 * Le serveur n'arbitre pas selon son horloge : il compare les `updatedAt`
 * portés par les lignes elles-mêmes. C'est ce qui permet à un appareil resté
 * hors ligne une semaine de se resynchroniser sans écraser le travail des
 * autres, et à une suppression de se propager au lieu de « réapparaître ».
 *
 * Ces fonctions sont pures : aucune base, aucune dépendance à NestJS.
 */

export interface Versioned {
  id: string;
  /** Horodatage epoch ms de la dernière écriture, produit par le client. */
  updatedAt: number;
  /** Suppression réversible. `null` ou absent = ligne vivante. */
  deletedAt?: number | null;
}

/**
 * Départage deux versions d'une même ligne. En cas d'égalité stricte, le
 * serveur l'emporte : deux appareils qui rejouent le même lot n'entraînent
 * alors aucune écriture, et le résultat ne dépend pas de l'ordre d'arrivée.
 */
export function pickWinner<T extends Versioned>(
  server: T | undefined,
  incoming: T | undefined,
): T | undefined {
  if (server === undefined) return incoming;
  if (incoming === undefined) return server;
  return incoming.updatedAt > server.updatedAt ? incoming : server;
}

export interface MergeResult<T extends Versioned> {
  /** État complet après arbitrage, trié par identifiant. */
  merged: T[];
  /** Sous-ensemble à écrire : les lignes où le client a gagné. */
  toPersist: T[];
  /** Nombre de lignes entrantes rejetées au profit du serveur. */
  conflicts: number;
}

/**
 * Fusionne un lot entrant avec l'état du serveur.
 *
 * `toPersist` est volontairement minimal : rejouer deux fois la même
 * synchronisation ne doit produire aucune écriture.
 */
export function mergeRecords<T extends Versioned>(server: T[], incoming: T[]): MergeResult<T> {
  const byId = new Map<string, T>();
  for (const record of server) byId.set(record.id, record);

  // Un lot mal formé peut contenir deux fois le même identifiant : on ne garde
  // que la version la plus récente avant d'arbitrer contre le serveur.
  const deduped = new Map<string, T>();
  for (const record of incoming) {
    const previous = deduped.get(record.id);
    if (previous === undefined || record.updatedAt > previous.updatedAt) {
      deduped.set(record.id, record);
    }
  }

  const toPersist: T[] = [];
  let conflicts = 0;

  for (const record of deduped.values()) {
    const current = byId.get(record.id);
    const winner = pickWinner(current, record);
    if (winner === record) {
      byId.set(record.id, record);
      toPersist.push(record);
    } else {
      conflicts += 1;
    }
  }

  const merged = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  return { merged, toPersist, conflicts };
}

/** Ne renvoie que ce qui a bougé depuis le curseur du client. */
export function changedSince<T extends Versioned>(records: T[], since: number | null): T[] {
  if (since === null) return records;
  return records.filter((r) => r.updatedAt > since);
}

/** Curseur à renvoyer au client : l'horodatage le plus récent du lot. */
export function nextCursor(records: Versioned[], fallback: number): number {
  return records.reduce((max, r) => (r.updatedAt > max ? r.updatedAt : max), fallback);
}
