---
tags: [decision, fondation]
---

# Domaine partagé

`@workpulse/core` ne dépend de rien. Ni React, ni Dexie, ni NestJS, ni Prisma,
ni même des modules Node.

## Pourquoi

Avec une API, le calcul d'un solde peut se faire à deux endroits. Deux
implémentations divergeraient — pas tout de suite, mais au premier cas
particulier : un jour férié travaillé, une [[Demi-journées|demi-journée]], un
[[Report de solde|report]] négatif.

Un utilisateur qui verrait deux chiffres différents ne saurait pas lequel
croire, et perdrait confiance dans les deux.

## Comment c'est tenu

Une règle ESLint, pas une intention :

```js
files: ['packages/core/**/*.ts'],
rules: { 'no-restricted-imports': ['error', { patterns: [
  { group: ['react', 'react-*', 'dexie*', '@nestjs/*', '@prisma/*', 'node:*'] },
]}]}
```

Importer React dans le domaine fait échouer la chaîne.

## Ce que ça a rendu possible

- [[Couverture 100]] : un domaine sans dépendance se teste intégralement.
- L'[[Application Android]] n'a demandé aucun changement dans le domaine.
- `GET /v1/summary/week` recalcule le solde avec le même code que le téléphone.

Référence : [ADR 0002](../adr/0002-domaine-partage.md)
