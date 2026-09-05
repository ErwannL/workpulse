# ADR 0003 — Monorepo en espaces de travail npm

**Statut** : accepté · **Date** : 2026-09-05

## Contexte

Trois paquets liés — domaine, application, API — évoluent ensemble. Une
modification de règle métier touche souvent les trois. Trois dépôts imposeraient
de publier une version du domaine, d'attendre, puis de mettre à jour deux
consommateurs, pour chaque changement.

## Décision

Un seul dépôt, avec les espaces de travail npm (`workspaces`).

```
packages/core     @workpulse/core
apps/web          @workpulse/web
apps/api          @workpulse/api
```

Aucun outil supplémentaire : ni pnpm, ni Turborepo, ni Nx.

## Conséquences

**Ce qu'on gagne**

- Une modification traverse les trois paquets dans un seul commit, avec ses tests.
- Une seule chaîne d'intégration, un seul jeu de règles de style.
- npm est déjà là : rien à installer, rien à apprendre.

**Ce qu'on paie**

- Pas de cache de compilation distribué. À cette taille, la compilation complète
  prend moins d'une minute — le cache coûterait plus qu'il ne rapporte.
- L'ordre de compilation est explicite (`build:core` d'abord) au lieu d'être
  déduit d'un graphe de dépendances.

**Quand reconsidérer**

Si la compilation complète dépasse deux ou trois minutes, ou si un quatrième
paquet apparaît, Turborepo mérite un second regard.
