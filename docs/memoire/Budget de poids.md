---
tags: [decision, performance]
---

# Budget de poids

220 ko de JavaScript compressé, 30 ko de CSS. La chaîne échoue au-delà.

## Pourquoi un seuil dur

Le poids d'une application ne grossit jamais d'un coup : il glisse de quelques
kilo-octets à chaque dépendance ajoutée « juste pour ce composant ». Un seuil
transforme cette dérive en décision.

## État actuel

| Type | Budget | Réel |
| --- | ---: | ---: |
| JavaScript | 220 ko | ~116 ko |
| CSS | 30 ko | ~5 ko |

La marge est confortable — c'est justement le moment d'installer la règle.

## Ce que ça a décidé

[[Pas de framework UI]]. Material UI seul pèse plus que l'application entière.

`scripts/check-bundle-budget.mjs`
