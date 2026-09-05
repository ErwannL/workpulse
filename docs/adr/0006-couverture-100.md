# ADR 0006 — 100 % de couverture sur le domaine et l'API

**Statut** : accepté · **Date** : 2026-09-05

## Contexte

WorkPulse est un outil de calcul. Une règle fausse ne se voit pas : elle produit
un chiffre plausible mais faux, que l'utilisateur croit. Contrairement à un
plantage, une erreur de solde peut passer des mois inaperçue.

La couverture de test n'est pas une mesure de qualité — on peut atteindre 100 %
avec des tests vides. Mais **l'inverse est vrai** : une ligne jamais exécutée
est une règle jamais vérifiée.

## Décision

Seuils imposés par la chaîne, échec de la compilation en dessous :

| Paquet | Lignes | Branches | Fonctions |
| --- | --- | --- | --- |
| `@workpulse/core` | 100 % | 100 % | 100 % |
| `@workpulse/api` | 100 % | 100 % | 100 % |
| `@workpulse/web` | 97 % | 86 % | 90 % |

Toute exclusion est déclarée dans le fichier de configuration, avec sa raison.

## Conséquences

**Ce que 100 % a réellement apporté**

Atteindre 100 % a forcé à examiner chaque branche. Cela a conduit à :

- **supprimer trois morceaux de code défensif inatteignables** — un
  `emptyIfNaN` protégeant d'un `NaN` que `reduce` ne peut pas produire, un
  `lastOut ?? now` dont le cas nul était impossible, un `case 'HOLIDAY'`
  qu'une résolution antérieure rendait mort ;
- **découvrir deux défauts réels** : les jours fériés n'apparaissaient pas dans
  la vue semaine, et les champs de réglages n'avaient pas de libellé accessible ;
- **rendre explicite une erreur de conception** : l'assainissement des réglages
  ne devait pas maquiller une panne interne en erreur de saisie.

Aucun de ces points n'aurait été trouvé par un objectif de 80 %.

**Pourquoi pas 100 % sur l'interface**

Un rendu conditionnel — « afficher ce libellé si la journée est une matinée » —
peut être couvert par un test, mais ce test n'apprend rien. Exiger 100 %
pousserait à écrire des tests de façade pour satisfaire un compteur.

Les seuils y sont donc élevés mais atteignables par des tests qui décrivent des
parcours réels : pointer, se voir refuser une reprise trop tôt, poser des
congés, régler une demi-journée.

**Ce qu'on paie**

- Écrire un test pour une branche défensive coûte du temps. Souvent, la bonne
  réponse est de supprimer la branche.
- Un cas d'erreur interne demande parfois de simuler un module pour être
  atteignable.

**Ce que ce seuil ne garantit pas**

Rien sur la justesse des règles. Un test peut couvrir une ligne en affirmant le
mauvais résultat. C'est le rôle des tests de bout en bout, des tests d'intrusion
et de la relecture — pas du compteur.
