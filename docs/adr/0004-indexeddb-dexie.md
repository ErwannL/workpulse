# ADR 0004 — IndexedDB via Dexie

**Statut** : accepté · **Date** : 2026-09-04

## Contexte

Les données doivent survivre à la fermeture de l'application, tenir plusieurs
années de pointages, et se lire assez vite pour un recalcul toutes les quinze
secondes.

Trois options : `localStorage`, IndexedDB brut, IndexedDB via une bibliothèque.

## Décision

IndexedDB, avec [Dexie](https://dexie.org/).

## Conséquences

**Pourquoi pas `localStorage`**

Limité à quelques mégaoctets, synchrone — donc bloquant — et sans index. Cinq
ans de pointages représentent environ 5 000 lignes : au-delà de ce que
`localStorage` traite raisonnablement.

**Pourquoi pas IndexedDB brut**

Son API à base d'événements est verbeuse au point de rendre le code de
persistance illisible. Dexie coûte environ 25 ko compressés et rend le dépôt
lisible d'un coup d'œil.

**Ce que Dexie apporte en plus**

`dexie-react-hooks` fournit `useLiveQuery` : l'interface se rafraîchit dès
qu'une donnée change, sans code de synchronisation. C'est ce qui permet à un
pointage d'apparaître immédiatement dans la frise.

**Ce qu'on paie**

- 25 ko de dépendance.
- Une contrainte découverte à l'usage : `useLiveQuery` s'exécute dans une
  transaction en lecture seule. Écrire depuis une lecture lève une erreur —
  d'où la séparation entre `loadSettings()` et `ensureSettings()`.

**Note pour les tests**

Une transaction Dexie ne se termine pas sous horloge simulée. Les scénarios qui
purgent ou importent des données tournent donc en temps réel, ce qui est
documenté dans les tests concernés.
