---
tags: [performance]
---

# Mémoire du report

Le [[Report de solde]] rejoue toutes les semaines depuis le début du suivi. Le
[[Moteur de décision]] le rappelle **toutes les quinze secondes**.

Sur cinq ans d'historique : seize millisecondes à chaque battement, pour un
résultat identique.

## La mise en cache

Une `WeakMap` indexée sur l'identité des collections de données :

```ts
const memoireReport = new WeakMap<LedgerSource['entries'], ReportMemorise>();
```

Deux appels avec les mêmes `Map` portent sur les mêmes données. Quand
l'application les remplace — donc quand quelque chose a changé — l'entrée
disparaît toute seule.

La date du jour fait partie de la clé : au passage de minuit, une semaine cesse
d'être en cours.

## Ce qui l'a rendue possible

Le correctif de [[Départ oublié]]. Tant qu'une journée passée pouvait grandir
avec l'heure courante, aucun cache n'aurait été correct.

## Ce qui la prouve

Six tests d'invalidation : pointages modifiés, journée annotée, réglages
changés, semaine cible différente, passage de minuit. Un cache rapide et faux
serait pire que pas de cache.

Résultat : premier calcul ~16 ms, suivants < 1 ms.
