---
tags: [decision, api]
---

# Synchronisation

Facultative. Le serveur n'est pas la source de vérité : il **arbitre**.

## La règle

Dernier écrivain gagnant, sur un `updatedAt` produit par le **client**.

Le serveur ne voit pas quand une modification a réellement eu lieu. Un appareil
resté hors ligne une semaine enverrait des modifications anciennes qui, datées
par le serveur, écraseraient du travail plus récent.

En cas d'égalité stricte, le serveur l'emporte : le résultat ne dépend alors
pas de l'ordre d'arrivée des requêtes, et rejouer un lot n'écrit rien.

## Suppressions réversibles

Sans marqueur `deletedAt`, une ligne supprimée sur un appareil réapparaîtrait
depuis un appareil qui l'ignore encore. Une suppression doit être une
information qui se propage, pas une absence.

## Ce que ça suppose

Des horloges à peu près justes. Sur des téléphones synchronisés par le réseau,
l'hypothèse tient. Un décalage important produirait une perte de modification —
pas une corruption.

Voir [[Local-first]], [ADR 0005](../adr/0005-synchronisation-lww.md)
