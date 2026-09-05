# ADR 0005 — Dernier écrivain gagnant, suppressions réversibles

**Statut** : accepté · **Date** : 2026-09-05

## Contexte

Plusieurs appareils d'une même personne modifient les mêmes journées, parfois
hors ligne. Il faut une règle de résolution de conflit.

Les options : dernier écrivain gagnant, CRDT, ou journal d'opérations.

## Décision

Dernier écrivain gagnant, arbitré sur un `updatedAt` **produit par le client**,
avec suppressions réversibles (`deletedAt`).

En cas d'égalité stricte, le serveur l'emporte.

## Conséquences

**Pourquoi l'horodatage du client**

Le serveur ne voit pas quand une modification a réellement eu lieu. Un appareil
resté hors ligne une semaine enverrait des modifications anciennes qui, datées
par le serveur, écraseraient du travail plus récent.

Ce choix suppose des horloges à peu près justes. Pour un usage personnel, sur
des téléphones synchronisés par le réseau, l'hypothèse tient. Un décalage
important produirait une perte de modification — pas une corruption.

**Pourquoi les suppressions réversibles**

Sans marqueur, une ligne supprimée sur un appareil réapparaîtrait à la
synchronisation suivante depuis un appareil qui l'ignore encore. La suppression
doit être une information qui se propage, pas une absence.

**Pourquoi le serveur gagne à égalité**

Pour que le résultat ne dépende pas de l'ordre d'arrivée des requêtes. Deux
appareils rejouant le même lot n'entraînent alors aucune écriture — la
synchronisation est idempotente.

**Pourquoi pas un CRDT**

Les données de WorkPulse sont un ensemble de lignes indépendantes identifiées
par le client. Il n'y a pas d'édition concurrente d'une même structure, pas de
texte à fusionner. Un CRDT apporterait une complexité considérable pour un
problème qui n'existe pas ici.

**Ce qu'on paie**

- Une modification concurrente sur deux appareils perd la plus ancienne, sans
  avertissement autre que le compteur `conflicts` renvoyé au client.
- Les lignes supprimées restent en base. Une purge périodique sera nécessaire
  si le volume devient un sujet ; il ne l'est pas à cette échelle.
