---
tags: [plateforme]
---

# Application Android

Le même code, empaqueté avec Capacitor. Pas un second produit.

## Le seul gain réel

| | Navigateur | Installée |
| --- | --- | --- |
| Notification immédiate | si l'onglet vit | oui |
| **Rappel programmé, application fermée** | **non** | **oui** |

Un service worker ne garantit pas le réveil d'un onglet fermé. L'application
installée programme de vrais rappels système : l'alerte de 8 h part même si
WorkPulse n'a pas été ouvert depuis la veille.

C'est la seule différence fonctionnelle entre les deux enveloppes, et elle est
isolée dans un unique fichier : `platform/notifications.ts`.

## Les icônes ne sont pas importées

Un script dessine le logo et produit les cinq densités Android, l'icône ronde,
le calque avant adaptatif et l'icône monochrome de la barre d'état. C'est le
**même script que le favicon web** : une seule définition du logo.

## Deux règles de programmation

- Reprogrammer **remplace** au lieu d'empiler.
- Un rappel déjà passé n'est jamais programmé : il sonnerait aussitôt.

Une [[Demi-journées|demi-journée]] ne reçoit que deux rappels au lieu de quatre.

Voir [docs/android.md](../android.md)
