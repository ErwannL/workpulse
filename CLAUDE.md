# CLAUDE.md

Instructions pour un agent qui travaille sur ce dépôt. Elles valent aussi pour
un humain — voir [docs/contribuer.md](docs/contribuer.md).

---

## Ce qu'est WorkPulse

Un assistant personnel de temps de travail. Il répond en permanence à deux
questions :

> Est-ce que j'ai assez travaillé aujourd'hui, et est-ce que je peux rentrer ?
> Est-ce que je suis en avance ou en retard sur ma semaine ?

Ce n'est pas une pointeuse. La différence est que l'utilisateur ne doit **rien
calculer lui-même**.

---

## Avant de toucher au code

```bash
npm install
npm run verify      # doit passer sur une copie fraîche
```

Lire [docs/regles-metier.md](docs/regles-metier.md). Ce document fait autorité :
si le code et lui divergent, l'un des deux est en tort — il faut trancher, pas
contourner.

Pour comprendre un choix, [docs/memoire/](docs/memoire/README.md) répond en une
note courte. Pour savoir qui appelle quoi, `npm run graph` puis
`graphify query "…"`.

---

## Structure

```
packages/core     domaine pur — aucune dépendance
apps/web          PWA React + enveloppe Android
apps/api          synchronisation NestJS + Prisma (facultative)
docs/             documentation, ADR, mémoire du projet
scripts/          outillage : changelog, icônes, budget, notes de version
```

---

## Les invariants

Ils ne se discutent pas sans ADR.

| Invariant | Vérifié par |
| --- | --- |
| `packages/core` ne dépend de rien | règle ESLint — la chaîne échoue |
| Aucun calcul métier dans un composant | relecture |
| Aucun solde stocké : tout est recalculé | relecture |
| L'application marche sans réseau ni compte | tests |
| Domaine et API à 100 % de couverture | seuils dans la chaîne |
| Budget de poids : 220 ko de JS compressé | `scripts/check-bundle-budget.mjs` |

**Le premier est le plus important.** Le domaine est importé par l'application
et par l'API : c'est ce qui rend impossible qu'un solde diffère entre le
téléphone et le serveur. Y importer React ou Prisma casse cette garantie.

---

## Où va un nouveau code

Poser la question dans cet ordre :

1. **Est-ce une règle de calcul ou de décision ?** → `packages/core`
2. **Est-ce de l'affichage ?** → `apps/web/src/ui`
3. **Est-ce du stockage local ?** → `apps/web/src/db`
4. **Est-ce du serveur ?** → `apps/api`

Si un composant se met à calculer une durée, c'est que la règle manquait au
domaine. Le corriger là, pas dans le composant.

---

## Comment travailler

### L'ordre

1. **Écrire le test d'abord** pour toute règle métier, tout correctif, toute
   protection. Le voir échouer. Puis écrire le code.
2. **Mettre à jour `CHANGELOG.md`** sous `## [Non publié]`, au moment du
   changement — pas à la publication.
3. **Mettre à jour la documentation touchée.** Une règle qui change et
   `docs/regles-metier.md` qui ne bouge pas, c'est une divergence installée.
4. **`npm run verify`** avant de proposer.

### Le style

**Commenter le pourquoi, jamais le quoi.** Un commentaire qui paraphrase le
code vieillit mal ; un commentaire qui explique une décision reste utile dix
ans.

```ts
// bien
// En cas d'égalité stricte, le serveur l'emporte : deux appareils qui rejouent
// le même lot n'entraînent alors aucune écriture.

// mal
// Compare les updatedAt et renvoie le plus grand
```

**Les commentaires et l'interface sont en français.** La cohérence locale d'un
fichier prime sur l'uniformité du dépôt.

**Nommer ce que la chose est.** `advanceBeforeToday`, pas `tmp`.

**Un nom de test se lit comme une phrase du cahier des charges.**

```ts
it('l’avance de la semaine couvre la journée : il est 14h et on peut rentrer', () => {
```

---

## Pièges connus

Six erreurs ont déjà coûté du temps ici. Elles sont documentées dans
[docs/memoire/Pièges rencontrés.md](docs/memoire/Pièges%20rencontrés.md) :

1. **Écrire depuis un `useLiveQuery` Dexie** lève `ReadOnlyError` — la lecture
   se fait dans une transaction en lecture seule.
2. **`consistent-type-imports` casse l'injection NestJS** — la règle est
   désactivée sur `apps/api`, ne pas la réactiver.
3. **`ThrottlerModule.forRoot()` ne protège rien** sans garde `APP_GUARD`.
4. **Une protection dans `main.ts` n'est testée par personne** — la
   configuration vit dans `bootstrap.ts`, partagé avec les tests.
5. **Une transaction Dexie ne se termine pas sous horloge simulée** — ces
   scénarios tournent en temps réel.
6. **Les mesures de temps ne cohabitent pas avec la couverture** — les fichiers
   `*.perf.ts` sont hors de la suite principale.

---

## Commits et versions

Convention [Conventional Commits](https://www.conventionalcommits.org/fr/),
vérifiée par la chaîne. Portées : `core`, `web`, `api`, `docs`, `ci`, `deps`,
`repo`, `alertes`, `ui`, `db`.

`main` reste linéaire. Le travail se fait sur des branches `feat/…`, `fix/…`,
`refactor/…`, fusionnées puis supprimées. Chaque version est un tag `vX.Y.Z`.

La chaîne refuse de publier si le tag ne correspond pas à la version du paquet,
ou si `CHANGELOG.md` ne documente pas cette version.

---

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run dev` | application web sur `:5173` |
| `npm run dev:api` | API (demande une base) |
| `npm test` | tous les tests |
| `npm run test:cov` | avec seuils de couverture |
| `npm run test:perf` | tenue en charge du domaine |
| `npm run verify` | ce que vérifie la chaîne |
| `npm run build` | compile les trois paquets |
| `npm run android` | compile et synchronise le projet Android |
| `npm run changelog` | régénère le journal embarqué |
| `npm run graph` | régénère le graphe de connaissances |

---

## Ce qu'il ne faut pas faire

- **Contourner une règle métier dans un écran.** La corriger dans le domaine.
- **Stocker un résultat calculé.** Il deviendra faux après une correction
  rétroactive.
- **Ajouter une dépendance sans regarder le budget de poids.** C'est une
  application mobile.
- **Baisser un seuil de couverture pour faire passer la chaîne.** Soit le test
  manque, soit le code est mort — les deux se règlent autrement.
- **Publier une version non documentée.** La chaîne le refuse, et c'est voulu.
- **Toucher à `apps/web/android/` à la main.** Le projet est engendré ; les
  versions et les icônes sont alignées par `scripts/sync-android.mjs`.
