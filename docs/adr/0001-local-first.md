# ADR 0001 — L'appareil est la source de vérité

**Statut** : accepté · **Date** : 2026-09-04

## Contexte

WorkPulse suit des horaires de travail : une donnée personnelle, potentiellement
sensible vis-à-vis d'un employeur. Le cahier des charges (§32) demande que la
première version privilégie le stockage local et qu'aucune donnée ne parte vers
un service externe sans action explicite.

Par ailleurs, l'application doit répondre instantanément à « puis-je rentrer ? ».
Un aller-retour réseau pour obtenir un solde serait à la fois lent et fragile.

## Décision

L'appareil détient la vérité. Toutes les données vivent dans IndexedDB. Tous les
calculs se font localement. L'application est pleinement fonctionnelle sans
réseau, sans compte, sans serveur.

Une API de synchronisation existe, mais elle est **facultative** et n'arbitre
que des conflits entre appareils d'une même personne.

## Conséquences

**Ce qu'on gagne**

- Aucune donnée ne quitte l'appareil par défaut.
- Réponse immédiate, hors ligne comprise.
- Aucun coût d'hébergement pour l'usage nominal.
- Pas de compte à créer pour commencer.

**Ce qu'on paie**

- La synchronisation multi-appareils demande une résolution de conflit
  explicite plutôt qu'une base unique (voir [ADR 0005](0005-synchronisation-lww.md)).
- La sauvegarde est à la charge de l'utilisateur : export manuel, ou
  synchronisation.
- Perdre son téléphone sans sauvegarde, c'est perdre son historique.

**Ce qu'on accepte**

Le dernier point est assumé : le remède — un compte obligatoire — coûterait
plus cher que le mal pour un outil personnel.
