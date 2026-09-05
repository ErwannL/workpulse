# ADR 0002 — Un paquet de domaine partagé

**Statut** : accepté · **Date** : 2026-09-05

## Contexte

Avec l'ajout d'une API de synchronisation, le calcul d'un solde peut se faire à
deux endroits : sur le téléphone et sur le serveur. Deux implémentations
divergeraient — pas immédiatement, mais au premier cas particulier : un jour
férié travaillé, une demi-journée, un report négatif.

Un utilisateur qui verrait deux chiffres différents ne saurait pas lequel croire,
et perdrait confiance dans les deux.

## Décision

Le domaine vit dans un paquet distinct, `@workpulse/core`, sans aucune
dépendance de plateforme. L'application web et l'API l'importent tel quel.

Une règle ESLint interdit d'y importer React, Dexie, NestJS, Prisma ou les
modules Node.

## Conséquences

**Ce qu'on gagne**

- La divergence devient impossible par construction, pas par discipline.
- Le domaine se teste sans navigateur, sans base, sans serveur — d'où la
  couverture à 100 %.
- L'ajout de l'enveloppe Android n'a demandé aucun changement dans le domaine.

**Ce qu'on paie**

- Une double compilation ESM et CommonJS : Vite consomme l'un, NestJS l'autre.
- Le domaine doit être compilé avant que l'API ne se type-vérifie, ce qui impose
  un ordre dans la chaîne.
- Les imports relatifs portent une extension `.js`, contrainte de la sortie ESM.

**Alternative écartée**

Dupliquer le calcul côté serveur en acceptant une dérive « surveillée par des
tests de non-régression ». Cela revient à écrire deux fois la même chose et à
espérer que les tests attrapent la divergence — alors qu'un paquet partagé la
rend impossible.
