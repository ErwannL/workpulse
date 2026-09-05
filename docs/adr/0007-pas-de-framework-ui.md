# ADR 0007 — Aucune bibliothèque d'interface

**Statut** : accepté · **Date** : 2026-09-04

## Contexte

L'application compte cinq écrans et une quinzaine de composants. Les candidats
habituels — Material UI, Chakra, shadcn/ui, Tailwind — apportent des composants
prêts et une cohérence visuelle immédiate.

WorkPulse est par ailleurs une application mobile installable : son poids est
un critère de premier plan, pas un détail d'optimisation.

## Décision

Aucune bibliothèque d'interface. Trois feuilles de style — jetons, base,
composants — et des composants React écrits à la main.

## Conséquences

**Ce qu'on gagne**

- **Le poids.** L'application complète pèse 116 ko compressés, CSS comprise.
  Material UI seul en pèse davantage.
- **La maîtrise du mouvement.** Les animations sont écrites pour ce produit :
  l'anneau se dessine, le chiffre marque le coup, le point bat tant que le
  compteur tourne. Une bibliothèque généraliste ne propose rien de tel.
- **L'absence de lutte.** Pas de surcharge de thème, pas de `!important` contre
  des styles imposés, pas de mise à jour majeure à absorber.
- **La lisibilité.** Une centaine de classes CSS, toutes nommées dans la même
  logique, se lisent d'un bout à l'autre.

**Ce qu'on paie**

- L'accessibilité est à notre charge. Rôles ARIA, gestion du clavier, contrastes
  et zones tactiles ont dû être écrits — et testés.
- Pas de composants complexes gratuits. Il n'y en avait pas besoin ici : la
  feuille modale et l'interrupteur sont les seuls éléments non triviaux.
- La cohérence repose sur la discipline des jetons plutôt que sur un système
  imposé.

**Quand reconsidérer**

Si l'application devait accueillir des tableaux de données, de l'autocomplétion,
des sélecteurs de date complexes ou un usage bureau à part entière. Rien de tout
cela n'est au programme.

**Pourquoi pas Tailwind en particulier**

Tailwind aurait évité d'écrire du CSS, mais pas de concevoir le système. Les
jetons, les états, le mouvement auraient existé de la même façon — répartis dans
les composants plutôt que rassemblés. Pour cinq écrans, le regroupement est plus
lisible.
