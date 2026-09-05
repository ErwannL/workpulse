---
tags: [decision, fondation]
---

# Local-first

**L'appareil détient la vérité.** Toutes les données vivent dans IndexedDB,
tous les calculs se font localement, l'application marche sans réseau et sans
compte.

## Pourquoi

Des horaires de travail sont une donnée personnelle, potentiellement sensible
vis-à-vis d'un employeur. Et la question « puis-je rentrer ? » doit trouver sa
réponse immédiatement, pas après un aller-retour réseau.

## Ce que ça impose

- La [[Synchronisation]] doit arbitrer des conflits au lieu de lire une base
  unique.
- La sauvegarde est à la charge de l'utilisateur : export manuel.
- Perdre son téléphone sans sauvegarde, c'est perdre son historique. Assumé :
  le remède — un compte obligatoire — coûterait plus cher que le mal.

## Ce que ça permet

- Le [[Domaine partagé]] n'a besoin d'aucune infrastructure pour être testé.
- L'[[Application Android]] est un simple empaquetage, pas un portage.

Référence : [ADR 0001](../adr/0001-local-first.md)
