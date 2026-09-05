---
tags: [regle]
---

# Report de solde

Le solde d'une semaine ouvre la suivante. Positif comme négatif.

```
Semaine 1 : 38 h faites, 35 h dues   →  +3 h
Semaine 2 : commence avec            →  +3 h
```

## Comment c'est calculé

En rejouant **toutes** les semaines depuis le début du suivi. C'est simple,
vérifiable, et sans état stocké — un solde enregistré deviendrait faux après
une correction rétroactive.

Le coût croît donc avec l'ancienneté du compte, d'où la [[Mémoire du report]].

## Deux garde-fous

- Rien n'est dû avant le début du suivi : installer l'application un vendredi
  ne crée pas quatre jours de dette.
- L'objectif du jour ajusté par le report est borné par le plafond d'heures
  supplémentaires. Un retard de vingt heures ne réclame pas une journée de
  vingt-sept heures.

Voir [[Moteur de décision]], [[Solde affiché]].
