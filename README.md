# WorkPulse

Assistant personnel de temps de travail. Application mobile installable (PWA),
100 % locale : aucune donnée ne quitte l'appareil.

WorkPulse répond en permanence à deux questions :

> **Est-ce que j'ai assez travaillé aujourd'hui, et est-ce que je peux rentrer ?**
>
> **Est-ce que je suis en avance ou en retard sur ma semaine ?**

---

## Le moteur de décision

Tout part d'une fonction pure, `computePulse`, dans [`src/core/engine.ts`](src/core/engine.ts).
À chaque tick, elle agrège le temps travaillé du jour, le solde reporté des semaines
précédentes, les autres journées de la semaine, le calendrier (fériés, congés, absences)
et l'heure courante, puis produit un état unique :

```
NOT_STARTED · WORKING · BREAK · DAY_COMPLETE · WEEK_COMPLETE
OVERTIME_LIMIT_REACHED · ABSENT · HOLIDAY
```

L'interface et les alertes ne font que **lire** cet état. Aucune règle métier n'est
recodée dans un écran ou dans une notification : le « il est 14h, tu as déjà fait tes
heures, rentre chez toi » est une conséquence du calcul, pas un cas particulier.

Le moteur expose aussi les grandeurs dérivées utiles : objectif ajusté du jour,
temps restant, heure de départ recommandée (pause légale comprise), avance ou
retard, plafond d'heures supplémentaires.

### Deux subtilités qui changent l'usage

- **Le solde affiché ignore ce qu'il reste le temps de faire aujourd'hui.** À 9 h avec
  une heure au compteur, l'application n'annonce pas « −6 h » : elle annonce « 0h00 ».
  Les heures faites *en plus*, elles, comptent immédiatement. C'est le champ `standing`.
- **Rien n'est dû avant la première journée suivie.** Installer l'application un
  vendredi ne crée pas quatre jours de dette.

---

## Règles métier

| Règle | Comportement |
| --- | --- |
| Journée type | 7 h, configurable |
| Semaine type | 35 h, configurable |
| Solde | `heures travaillées − heures théoriques` |
| Report | le solde d'une semaine ouvre la suivante |
| Heures supplémentaires | plafond de +4 h/semaine, alerte au-delà |
| Jours fériés | calendrier français calculé (Pâques par computus), modifiable jour par jour |
| Congés, RTT, maladie | temps théorique neutralisé — jamais confondu avec un oubli |
| Pause déjeuner | minimum de 30 min ; reprendre avant est **refusé** |
| Corrections | tout pointage peut être ajouté ou modifié, l'heure d'origine est conservée |

### La pause déjeuner

Reprendre le travail après 15 minutes de pause n'est pas autorisé. L'application
refuse l'action et propose autre chose :

> **Pas si vite 🍿** — Tu as encore droit à 15 min de Netflix.
>
> **Et si tu allais prendre l'air ?** — 15 min dehors, ça ne se refuse pas.

Le seuil et l'application stricte de la règle sont réglables.

---

## Alertes

Les horaires de référence (08:00 / 12:00 / 13:00 / 17:00) déclenchent des alertes,
mais **l'état du compteur a le dernier mot** : à 17 h, si l'avance de la semaine
couvre la journée, l'application dit de rentrer plutôt que de réclamer des heures.
Inversement, dès que l'objectif est couvert — même à 14 h — elle le signale.

Chaque alerte propose les mêmes réponses : agir, reporter (10 min / 30 min / 1 h),
ignorer pour la journée. Les notifications système sont facultatives et demandées
explicitement ; sans elles, les alertes restent visibles dans l'application.

---

## Architecture

```
src/
  core/      logique métier pure, sans React ni navigateur
    time         dates, semaines ISO, formats français
    holidays     jours fériés français
    day          automate de pointage → temps travaillé / pauses
    ledger       objectifs, soldes hebdomadaires, report, statistiques
    breakRules   pause minimale
    engine       moteur de décision central
    alerts       quelle alerte est due, et pourquoi
  db/        stockage IndexedDB (Dexie), sauvegarde et restauration
  state/     contexte React, horloge, actions de pointage
  ui/        écrans et composants
```

Le noyau `core/` ne dépend de rien : c'est lui qui porte les tests.

**Stack** — React 19, TypeScript, Vite, Dexie (IndexedDB), vite-plugin-pwa. Aucune
librairie d'interface : le design system tient dans trois feuilles de style.

---

## Développement

```bash
npm install
npm run dev
```

| Commande | Effet |
| --- | --- |
| `npm run dev` | serveur de développement |
| `npm run build` | build de production (PWA incluse) |
| `npm test` | suite de tests |
| `npm run icons` | régénère les icônes du manifeste |

---

## Versions

`main` reste linéaire et propre : chaque version est un tag, et le panneau
d'administration (Réglages → bas de page) affiche la version, la révision Git
et la date de compilation de l'application installée.

| Version | Contenu |
| --- | --- |
| `v0.1.0` | noyau métier, pointage, calendrier, statistiques, réglages |
| `v0.2.0` | système d'alertes intelligentes |

---

## Confidentialité

Tout est stocké dans IndexedDB, sur l'appareil. Aucun serveur, aucune requête
sortante. L'export JSON est la seule façon de faire sortir les données, et il
est déclenché à la main.
