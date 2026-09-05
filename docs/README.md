# Documentation WorkPulse

Cette documentation est organisée par question posée, pas par technologie.

## Comprendre le produit

| Document | Répond à |
| --- | --- |
| [Règles métier](regles-metier.md) | Comment un solde est calculé, et pourquoi cette règle plutôt qu'une autre |
| [Moteur de décision](moteur-de-decision.md) | Comment l'application décide seule quoi dire et quand |
| [Design system](design-system.md) | Pourquoi l'interface ressemble à ça |

## Comprendre le code

| Document | Répond à |
| --- | --- |
| [Architecture](architecture.md) | Ce qui vit où, et ce qui a le droit de dépendre de quoi |
| [Base de données](base-de-donnees.md) | Le schéma local, le schéma serveur, et pourquoi ils diffèrent |
| [API](api.md) | Le protocole de synchronisation, endpoint par endpoint |
| [Stratégie de test](tests.md) | Ce qui est testé, à quel niveau, et ce qui ne l'est pas |
| [Intégration continue](ci-cd.md) | Ce que la chaîne vérifie avant qu'un commit atteigne `main` |

## Décisions

Les [décisions d'architecture](adr/) sont consignées une par fichier, avec le
contexte qui les a rendues nécessaires et les conséquences acceptées.

| ADR | Décision |
| --- | --- |
| [0001](adr/0001-local-first.md) | L'appareil est la source de vérité |
| [0002](adr/0002-domaine-partage.md) | Un paquet de domaine partagé entre le client et le serveur |
| [0003](adr/0003-monorepo-npm.md) | Monorepo en espaces de travail npm |
| [0004](adr/0004-indexeddb-dexie.md) | IndexedDB via Dexie pour le stockage local |
| [0005](adr/0005-synchronisation-lww.md) | Dernier écrivain gagnant, avec suppressions réversibles |
| [0006](adr/0006-couverture-100.md) | 100 % de couverture sur le domaine et l'API |
| [0007](adr/0007-pas-de-framework-ui.md) | Aucune bibliothèque d'interface |

## Exploiter

| Document | Répond à |
| --- | --- |
| [Exploitation](exploitation.md) | Lancer, déployer, sauvegarder, surveiller |
| [Contribuer](contribuer.md) | Comment travailler sur ce dépôt |

## Carte du code

Le dépôt contient un graphe de connaissances généré par
[graphify](https://github.com/graphify) : voir [graphe-de-connaissances.md](graphe-de-connaissances.md).
