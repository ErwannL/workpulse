---
tags: [regle, coeur]
---

# Alertes

**L'horloge déclenche, le compteur décide.**

L'horaire de référence du jour ouvre la fenêtre ; c'est l'état du
[[Moteur de décision]] qui choisit le message.

| Heure | Situation | Message |
| --- | --- | --- |
| 17:00 | objectif atteint | Fin de journée. Tu peux rentrer. |
| 17:00 | avance suffisante | Ton avance couvre le retard d'aujourd'hui. |
| 17:00 | en retard | Il te reste 37 min. |
| 14:00 | objectif déjà couvert | Tu as fait tes heures. |

Aucun de ces cas n'est codé séparément : ils tombent tous du même état.

## Priorité

`OVERTIME` › `CAN_LEAVE` › `DAY_END` › `LUNCH_END` › `LUNCH_START` › `DAY_START`

Le dépassement de plafond passe avant tout — c'est la seule situation où
l'application doit contredire l'envie de continuer. Il ne se reporte pas.

## Deux natures

- **Immédiate** : vient du compteur, ne peut pas être programmée d'avance.
- **Programmée** : vient de l'horaire, peut partir application fermée — mais
  seulement dans l'[[Application Android]].
