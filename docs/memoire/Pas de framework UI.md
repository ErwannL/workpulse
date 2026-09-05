---
tags: [decision, ui]
---

# Pas de framework UI

Trois feuilles de style, une centaine de classes, des composants écrits à la
main.

## Ce qu'on gagne

- Le [[Budget de poids]] : 116 ko pour l'application entière.
- Des animations écrites pour ce produit — l'anneau se dessine, le chiffre
  marque le coup, le point bat tant que le compteur tourne. Aucune bibliothèque
  généraliste ne propose cela.
- Aucune lutte : pas de surcharge de thème, pas de `!important`, pas de mise à
  jour majeure à absorber.

## Ce qu'on paie

L'accessibilité est à notre charge : rôles ARIA, clavier, contrastes, zones
tactiles. Ils ont dû être écrits — et testés. Les tests d'interface interrogent
par rôle et par libellé, ce qui a fait apparaître les champs de réglages sans
libellé.

## Quand reconsidérer

Tableaux de données, autocomplétion, sélecteurs de date complexes, usage bureau.
Rien de tout cela n'est au programme.

Référence : [ADR 0007](../adr/0007-pas-de-framework-ui.md)
