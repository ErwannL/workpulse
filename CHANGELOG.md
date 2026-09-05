# Journal des modifications

Toutes les évolutions notables de WorkPulse sont consignées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le
versionnage suit [SemVer](https://semver.org/lang/fr/).

Ce fichier est la **source unique** des notes de version : il alimente à la fois
la release GitHub et l'écran « Nouveautés » de l'application, qui n'affiche que
ce qui a changé depuis la version précédemment installée sur l'appareil.

## [Non publié]

## [0.5.1] — 2026-09-05

### Modifié

- **Les dix pull requests de Dependabot sont soldées.** Onze mises à jour
  prises — actions GitHub, ESLint 10, commitlint 21, jsdom 30,
  `dexie-react-hooks` 4, `class-validator` 0.15, `globals` 17,
  `@testing-library/jest-dom` 7, `@types/supertest` 7 ; cinq différées, avec
  leur raison, dans l'issue #13.
- `@testing-library/jest-dom` 7 déclare `vitest` en pair optionnel : hissée à
  la racine de l'espace de travail, elle ne l'y voyait pas. `vitest` et son
  greffon de couverture sont donc déclarés à la racine, en plus de chaque
  paquet.
- `@types/node` reste volontairement aligné sur la version de Node exécutée :
  des types en avance décrivent des fonctions que le moteur n'a pas, et le
  compilateur les accepte sans broncher.

### Corrigé

- **La revue des dépendances échouait sur toutes les pull requests** depuis
  l'origine du dépôt, y compris celles de Dependabot, pour une raison sans
  rapport avec leur contenu : le graphe de dépendances de GitHub est un réglage
  du dépôt, et il est éteint. Un contrôle indisponible n'est pas un contrôle en
  échec — le job explique comment l'allumer et reprend de lui-même ensuite.
- **Le serveur du script de captures acceptait une remontée de chemin.**
  Signalé par CodeQL : comparer le chemin résolu à la racine par `startsWith`
  laisse passer tout ce qui commence par le même préfixe, et « dist » est aussi
  un préfixe de « distractor ».

## [0.5.0] — 2026-09-05

### Ajouté

- **Captures d'écran dans la documentation.** Six écrans, engendrés par
  `npm run screenshots` : Chrome piloté par son protocole de débogage, horloge
  figée et base locale réécrite, donc reproductibles au pixel près. Une capture
  faite à la main vieillit en silence ; celle-ci se refait en une commande.

### Modifié

- **Le `.apk` passe de 4,7 Mo à 1,1 Mo.** La chaîne compilait une variante de
  débogage : `classes.dex` non minifié, et 1,6 Mo de cartes de source
  embarquées. Elle compile désormais la variante de publication, minifiée par
  R8 — sans risque pour Capacitor, qui publie ses propres règles `-keep`.
  Un téléchargement qui échouait près de la fin sur un réseau moyen a désormais
  quatre fois moins d'occasions de le faire.
- **La signature de publication se branche par secrets.** Si le dépôt fournit
  un trousseau, la chaîne l'utilise ; sinon elle retombe sur la clé de
  débogage. Une seule variante à maintenir. La chaîne vérifie en outre que le
  paquet produit est bien signé, plutôt que de laisser le téléphone l'apprendre.
- Les notes de version portent la taille du paquet, son empreinte SHA-256 et la
  marche à suivre quand un téléchargement se fige à 100 %.
- **Dépendances.** Actions GitHub à jour, ESLint 10 et commitlint 21. Les lots
  NestJS 12, Prisma 7 et outillage (TypeScript, Vite, Vitest) restent en
  attente : ils n'en forment qu'un — NestJS 12 exige TypeScript ≥ 6 — et Vitest
  4 change la mesure de couverture au point de révéler des chemins que la
  version précédente comptait à tort comme couverts.

### Corrigé

- **Une semaine grevée d'une dette annonçait « tu peux partir » alors que le
  bouton de départ réclamait encore du temps.** L'état `WEEK_COMPLETE` ne
  regardait que l'objectif de la semaine, en ignorant le report entrant. Il
  exige désormais aussi que la journée soit soldée.
- **Douze minutes de dépassement repeignaient tout l'anneau en orange**, sur un
  écran qui annonçait par ailleurs « objectif atteint » en vert. L'anneau garde
  la couleur de l'état ; seul le fin arc intérieur signale le dépassement.
- **Trois tolérances différentes pour une même idée.** La vue semaine peignait
  en rouge une journée finie deux minutes trop tard, le calendrier annonçait des
  heures supplémentaires au-delà de cinq minutes, et le moteur, lui, en tolérait
  dix. Les trois écrans partagent maintenant `TREND_TOLERANCE`.
- L'emoji du titre se retrouvait seul en fin de ligne sur un écran étroit : une
  espace insécable le garde collé au prénom.

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
