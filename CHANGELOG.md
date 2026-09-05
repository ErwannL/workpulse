# Journal des modifications

Toutes les évolutions notables de WorkPulse sont consignées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le
versionnage suit [SemVer](https://semver.org/lang/fr/).

Ce fichier est la **source unique** des notes de version : il alimente à la fois
la release GitHub et l'écran « Nouveautés » de l'application, qui n'affiche que
ce qui a changé depuis la version précédemment installée sur l'appareil.

## [Non publié]

## [0.4.1] — 2026-09-05

### Sécurité

- **Cloisonnement des comptes.** L'identifiant d'un pointage était unique pour
  toute la base alors qu'il est produit par le client : un compte pouvait
  écraser la ligne d'un autre en devinant son identifiant. La clé primaire
  devient le couple `(userId, id)`. Trouvé par les tests d'intrusion.

### Corrigé

- Le paquet compilé de l'API sortait dans `dist/src/main.js` au lieu de
  `dist/main.js` : ni le conteneur ni la chaîne ne trouvaient le point
  d'entrée. Il manquait le `tsconfig.build.json` de NestJS.
- La sonde de vie répondait sur `/v1/health` au lieu de `/health` : le
  `HEALTHCHECK` du conteneur ne pouvait jamais aboutir, et le conteneur ne se
  serait jamais déclaré sain.
- Une erreur de validation renvoyait « Bad Request Exception » sans dire quel
  champ la motivait.
- Le bandeau d'alerte recouvrait le bouton de pointage qu'il demandait
  d'actionner.
- Le badge de l'anneau annonçait un retard à côté d'un message « tu peux
  partir ».
- Les champs d'heure de l'éditeur de journée étaient tronqués.

## [0.4.0] — 2026-09-05

### Ajouté

- **Demi-journées.** Chaque jour de la semaine se règle séparément : journée
  complète, matin seul, après-midi seul, horaires libres ou repos. L'objectif
  hebdomadaire devient la somme des journées, si bien qu'un vendredi matin ne
  demande plus aucune règle particulière ailleurs.
- **Forme d'une journée précise.** Une date peut prendre une autre forme que sa
  semaine type : travailler un samedi matin, ou ne faire qu'un après-midi.
- **Écran « Nouveautés ».** À la première ouverture après une mise à jour,
  l'application résume ce qui a changé depuis la version précédente.
- **Journal des modifications** alimenté au fil de l'eau, repris tel quel dans
  les releases GitHub.
- **Application Android (`.apk`)** jointe à chaque version publiée.
- **Animations** d'entrée, de transition entre onglets et de progression du
  compteur, désactivées si le système demande de réduire les animations.

### Modifié

- Les alertes suivent désormais les horaires propres à chaque journée. Sur une
  matinée, l'alerte de fin tombe à midi et aucune pause déjeuner n'est proposée.
- La pause minimale ne s'impose qu'aux journées qui comportent une coupure.
- Les réglages d'horaires uniques (`08:00 / 12:00 / 13:00 / 17:00`) laissent la
  place à l'édition de la semaine type. Les réglages existants sont migrés
  automatiquement.

## [0.3.0] — 2026-09-05

### Ajouté

- **Monorepo** en trois paquets : `@workpulse/core` (domaine pur),
  `@workpulse/web` (PWA) et `@workpulse/api` (synchronisation).
- **API de synchronisation** NestJS + Prisma + PostgreSQL, optionnelle. Le
  téléphone reste la source de vérité ; le serveur arbitre les conflits au
  dernier écrivain et propage les suppressions.
- **Résumé hebdomadaire côté serveur**, calculé avec le même code que le
  téléphone : une divergence entre les deux chiffres est impossible.
- **Chaîne d'intégration continue** : format, lint, types, tests des trois
  paquets, tests de bout en bout sur PostgreSQL réel, budget de poids, CodeQL,
  revue des dépendances et publication automatique.
- **Couverture 100 %** sur le domaine et sur l'API, seuils imposés par la chaîne.

### Corrigé

- Les jours fériés n'apparaissaient pas dans la vue semaine.
- Les champs de réglages n'avaient pas de libellé accessible.

## [0.2.1] — 2026-09-04

### Modifié

- L'anneau du jour annonce le temps qu'il reste à faire tant que la journée
  court, au lieu d'afficher un solde négatif dès le matin.
- L'histogramme de la semaine porte un repère à la hauteur de la journée type.

## [0.2.0] — 2026-09-04

### Ajouté

- **Alertes pilotées par le compteur**, pas par l'horloge : à 17 h, si l'avance
  de la semaine couvre la journée, l'application invite à rentrer au lieu de
  réclamer des heures.
- Alerte de départ anticipé dès que l'objectif est couvert, même à 14 h.
- Alerte de dépassement du plafond d'heures supplémentaires, prioritaire.
- Report d'une alerte de 10 min, 30 min ou 1 h, ou mise en sommeil pour la
  journée.
- Notifications système facultatives.

## [0.1.0] — 2026-09-04

### Ajouté

- **Moteur de décision** central produisant l'état de la journée.
- Pointage arrivée, pause, reprise et départ.
- Calcul du temps travaillé, du solde du jour et du solde de la semaine.
- Report du solde d'une semaine sur la suivante, plafond d'heures
  supplémentaires.
- Jours fériés français, congés, RTT, maladie, télétravail.
- Pause déjeuner minimale de 30 minutes, avec refus argumenté.
- Vue semaine, calendrier, statistiques et réglages.
- Application installable (PWA), stockage local uniquement.

[Non publié]: https://github.com/ErwannL/workpulse/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/ErwannL/workpulse/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/ErwannL/workpulse/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/ErwannL/workpulse/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/ErwannL/workpulse/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/ErwannL/workpulse/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ErwannL/workpulse/releases/tag/v0.1.0
