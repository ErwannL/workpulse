---
tags: [regle, decouverte]
---

# Départ oublié

Un pointage de sortie manquant sur une journée **passée** ne compte pas. La
journée est signalée comme incomplète et attend une correction.

## Le bug

Le code comptait tout segment ouvert jusqu'à l'instant présent. Un oubli du
lundi valait cinquante heures le mercredi — et faisait exploser le
[[Report de solde]] et les [[Alertes]].

## Pourquoi ne rien compter plutôt que plafonner

Deux plafonds étaient possibles :

- **À minuit** : seize heures pour une arrivée à 8 h. Visible, mais faux, et
  suffisant pour dépasser le plafond d'heures supplémentaires et déclencher des
  alertes trompeuses.
- **À l'heure de fin de référence** : plausible, donc invisible — le pire cas.

Ne rien inventer et le dire est la seule option honnête.

## Comment il a été trouvé

Par le banc de charge sur cinq ans d'historique — voir [[Pièges rencontrés]].
Le test cherchait une régression de performance ; il a trouvé une régression de
justesse.

## Effet de bord utile

Une journée passée ne dépend plus de l'heure courante. C'est ce qui a rendu la
[[Mémoire du report]] correcte.
