---
tags: [decision, tests]
---

# Couverture 100

100 % sur le [[Domaine partagé]] et sur l'API. 97 % sur l'interface.

## Le raisonnement

La couverture ne mesure pas la qualité — on peut atteindre 100 % avec des tests
vides. Mais **l'inverse est vrai** : une ligne jamais exécutée est une règle
jamais vérifiée.

Et WorkPulse est un outil de calcul : une règle fausse ne plante pas, elle
produit un chiffre plausible que l'utilisateur croit.

## Ce que ça a rapporté

Trois morceaux de code défensif **supprimés** parce qu'inatteignables :

- un `emptyIfNaN` protégeant d'un `NaN` que `reduce` ne peut pas produire ;
- un `lastOut ?? now` dont le cas nul était impossible ;
- un `case 'HOLIDAY'` qu'une résolution antérieure rendait mort.

Deux défauts réels **trouvés** : les jours fériés absents de la vue semaine, et
les champs de réglages sans libellé accessible.

Aucun n'aurait été trouvé par un objectif de 80 %.

## Pourquoi pas 100 % sur l'interface

Un rendu conditionnel peut être couvert par un test qui n'apprend rien. Exiger
100 % pousserait à écrire des tests de façade pour satisfaire un compteur.

Référence : [ADR 0006](../adr/0006-couverture-100.md)
