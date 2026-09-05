# Design system

Aucune bibliothèque d'interface. Trois feuilles de style, une centaine de
classes, et des composants qui tiennent en une page.

Voir [ADR 0007](adr/0007-pas-de-framework-ui.md) pour le pourquoi.

---

## Principes

**Le pouce d'abord.** L'application se tient d'une main, dans un couloir, entre
deux portes. Les actions vivent en bas, les informations en haut.

**Une couleur veut dire quelque chose.** Le vert n'est pas décoratif : il
signifie « tu peux partir ». L'ambre signifie « attention ». Le corail signifie
« arrête ». Rien n'est coloré pour faire joli.

**Les chiffres s'alignent.** Toutes les durées utilisent des chiffres à chasse
fixe. Un compteur qui saute latéralement à chaque minute est illisible.

**Le mouvement situe.** Un écran entre par où il arrive, une valeur qui change
attire l'œil une fois, et rien ne bouge en continu sauf ce qui est réellement
en cours.

---

## Jetons

`apps/web/src/styles/tokens.css`

### Profondeurs

Trois seulement : la page, la carte, l'élément posé.

| Jeton | Rôle |
| --- | --- |
| `--bg` | fond de la page |
| `--bg-elevated` | feuilles modales, barre d'onglets |
| `--surface` | cartes |
| `--surface-strong` | champs, pastilles |
| `--hairline` | séparateurs |

### Couleurs d'état

| Jeton | Sens |
| --- | --- |
| `--mint` | objectif atteint, on peut partir |
| `--sky` | en cours, tout va bien |
| `--amber` | attention, pause, heures supplémentaires |
| `--coral` | plafond dépassé, journée incomplète |
| `--violet` | jour non travaillé, férié, congé |

Ces cinq couleurs correspondent exactement aux états du moteur. La
correspondance vit dans `ui/tone.ts`, pas dans les composants.

### Typographie

Police système — elle est déjà chargée, elle est familière, elle s'adapte à la
langue. Les durées passent par `font-variant-numeric: tabular-nums`.

---

## Composants

`apps/web/src/ui/components/`

| Composant | Rôle |
| --- | --- |
| `Card` | conteneur avec titre optionnel et action |
| `Row` | libellé à gauche, valeur à droite, cliquable ou non |
| `Switch` | interrupteur accessible (`role="switch"`) |
| `Field` | libellé, précision, contrôle |
| `Segmented` | choix parmi deux ou trois options |
| `Sheet` | feuille modale, Échap et clic sur le fond la ferment |
| `Banner` | message d'attention, de danger ou d'information |
| `ProgressRing` | anneau du jour, avec arc de dépassement |
| `ProgressBar` | barre de la semaine, avec zone d'heures supplémentaires |
| `TabBar` | les cinq onglets |
| `AlertBar` | alerte du moteur, visible depuis tous les écrans |
| `DayEditor` | correction d'une journée |
| `ScheduleSheet` | horaire d'un jour de la semaine |
| `WhatsNew` | nouveautés depuis la version installée |

Chacun tient en moins de deux cents lignes et n'a aucune connaissance du
domaine — sauf `DayEditor` et `ScheduleSheet`, qui éditent des objets du
domaine et l'assument.

---

## L'anneau du jour

Le seul élément un peu travaillé.

```
       ╭───────────╮
     ╱               ╲       arc principal : temps travaillé / temps dû
    │      8h13       │      arc intérieur  : dépassement, s'il existe
    │  sur 7h00 …     │      couleur        : état du moteur
    │  ┌───────────┐  │
     ╲ │ +1h13     │ ╱
       ╰───────────╯
```

Il se dessine à l'ouverture, et le grand chiffre marque le coup lorsqu'il
change. Au-delà de l'objectif, un second arc repart du haut : le dépassement se
lit sans avoir à comparer deux nombres.

Sur une demi-journée, le libellé dit « sur 3h30 ce matin » plutôt que
« aujourd'hui ». Le détail compte : c'est ce qui évite de croire à une erreur.

---

## Mouvement

| Élément | Animation | Durée |
| --- | --- | --- |
| Écran | entrée par le bas | 320 ms |
| Cartes | apparition décalée | 360 ms, 30 ms d'écart |
| Anneau | tracé progressif | 900 ms |
| Grand chiffre | léger rebond au changement | 400 ms |
| Point « en cours » | battement | 2,4 s, en boucle |
| Barre de la semaine | reflet lent, journée en cours | 2,6 s, en boucle |
| Feuille modale | montée | 280 ms |
| Cellules du calendrier | apparition | 280 ms |

Seules deux animations bouclent, et uniquement quand quelque chose est
réellement en cours.

### Réduction du mouvement

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
}
```

Une seule règle, en tête de `base.css`, qui neutralise tout. Le réglage système
est respecté sans que chaque animation ait à y penser.

---

## Accessibilité

| Point | État |
| --- | --- |
| Rôles ARIA | `switch`, `dialog`, `status`, `group`, `main` |
| Libellés | tous les champs ont un `aria-label` ou un libellé associé |
| Navigation clavier | `:focus-visible` visible partout, Échap ferme les feuilles |
| Contraste | texte principal ≥ 12:1 sur le fond |
| Zones tactiles | au moins 44 px de haut |
| Mouvement | `prefers-reduced-motion` respecté |
| Thème clair | jetons redéfinis, secondaire mais lisible |

Les tests d'interface interrogent par rôle et par libellé — ce qui a fait
apparaître, et corriger, les champs de réglages sans libellé.

---

## Ce qui a été écarté

**Un système de grille.** Cinq écrans, une colonne. Une grille serait de
l'outillage sans usage.

**Des variantes de composants.** `Button` n'a pas dix `variant`. Il a
`primary`, `ghost`, `danger`, `quiet` — quatre, parce qu'il y a quatre
intentions.

**Un mode sombre optionnel.** L'application est sombre. Le thème clair existe
et reste lisible, mais le sombre est le cas nominal : on regarde cet écran tôt
le matin et tard le soir.
