---
tags: [decision, coeur]
---

# Moteur de décision

Une fonction, `computePulse`, agrège tout ce qu'on sait et produit un état.
Écrans, notifications et couleurs ne font que le lire.

## L'idée

```
temps travaillé aujourd'hui
+ solde reporté
+ autres journées de la semaine
+ temps théorique du jour
+ calendrier
+ heure courante
= un état, et tout ce qui en découle
```

« Il est 14 h, tu as fait tes heures, rentre chez toi » devient une
**conséquence du calcul**, pas une règle bricolée dans une notification.

## Ce qui en découle directement

- [[Solde affiché]] — le chiffre montré à l'écran
- [[Alertes]] — quand parler, et pour dire quoi
- La couleur de l'écran (`ui/tone.ts`)
- L'heure de départ conseillée

## La contrainte que ça crée

Le moteur est rappelé toutes les quinze secondes. Il doit donc rester bon
marché — d'où la [[Mémoire du report]].

Référence : [docs/moteur-de-decision.md](../moteur-de-decision.md)
