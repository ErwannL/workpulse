---
tags: [decouverte]
---

# Pièges rencontrés

Les six qui ont coûté du temps, et ce qu'ils ont appris.

## 1. Écrire depuis une lecture Dexie

`useLiveQuery` s'exécute dans une transaction **en lecture seule**. Y appeler
une écriture lève `ReadOnlyError` et l'application reste blanche.

D'où la séparation entre `loadSettings()` — lecture pure — et
`ensureSettings()`, appelé une fois hors de tout `liveQuery`.

## 2. Le premier lancement annonçait −35h00

Le début de suivi valait « lundi de la semaine en cours ». Installer
l'application un vendredi créait quatre jours de dette.

Corrigé en deux temps : le suivi démarre aujourd'hui, et rien n'est dû avant.
Cela a mené à [[Solde affiché]].

## 3. `consistent-type-imports` casse NestJS

Transformer `import { SyncService }` en `import type` efface la métadonnée que
l'injection de dépendances lit à l'exécution. L'application ne démarre plus.

La règle est désactivée sur `apps/api`, avec le commentaire qui explique
pourquoi.

## 4. Le contrôle de débit ne s'appliquait pas

`ThrottlerModule.forRoot()` **configure** mais n'active rien. Sans une garde
globale `APP_GUARD`, aucune limite n'est appliquée — et le module déclaré
donnait une fausse impression de protection.

## 5. Les protections n'étaient pas testées

`helmet`, la limite de taille et la validation stricte vivaient dans `main.ts`.
Les tests de bout en bout construisaient leur propre application : ils ne les
exerçaient jamais.

La configuration a été extraite dans `bootstrap.ts`, partagé par les deux.

## 6. Le banc de charge a trouvé un bug de justesse

Il cherchait une régression de performance. Il a trouvé [[Départ oublié]] — et
au passage rendu possible la [[Mémoire du report]].

Un test de performance qui ne trouve rien reste utile ; celui-là a payé deux
fois.
