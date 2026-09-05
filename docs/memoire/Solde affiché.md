---
tags: [regle, surprise]
---

# Solde affiché

À 9 h avec une heure au compteur, l'application affiche **0h00**, pas −6h00.

## Pourquoi

Le solde brut est exact : six heures manquent. Mais la question posée est
« suis-je en retard ? » — et à 9 h, non. Il reste la journée pour les faire.

```ts
const standing = dayOver ? totalBalance : advanceBeforeToday + Math.max(0, day.balance);
```

Les heures faites **en plus** comptent immédiatement. Le retard, lui, n'existe
qu'une fois la journée pointée.

## Ce que ça a demandé

Un champ distinct dans le [[Moteur de décision]] : `standing` pour l'affichage,
`totalBalance` pour qui veut le chiffre brut. Trois tests décrivent la
différence.

## D'où ça vient

D'une capture d'écran. Au premier lancement, l'application annonçait « −35h00 »
— voir [[Pièges rencontrés]]. La correction du bug a rendu visible la question
de fond : un chiffre exact peut être un mauvais message.
