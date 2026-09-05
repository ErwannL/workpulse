# Graphe de connaissances

Le dépôt porte **deux** mémoires, qui ne disent pas la même chose.

| | [Mémoire du projet](memoire/README.md) | Graphe de code |
| --- | --- | --- |
| Contenu | pourquoi c'est ainsi | qui appelle qui |
| Origine | écrit à la main | extrait par [graphify](https://github.com/graphify) |
| Taille | 18 notes | ~1 500 nœuds |
| Versionné | oui | non — régénérable |
| Vieillit | lentement | à chaque commit |

Un extracteur ne peut pas deviner qu'un chiffre exact était un mauvais message,
ni pourquoi le serveur gagne en cas d'égalité. Inversement, personne n'écrira à
la main les 2 342 arêtes du code.

---

## La mémoire du projet

`docs/memoire/` — un vault [Obsidian](https://obsidian.md/) : ouvrir le dossier
comme un coffre.

Des notes courtes, une par question, densément liées par `[[wikilinks]]`. Le
graphe local d'Obsidian montre alors comment une décision en entraîne une
autre :

```
Local-first ──► Domaine partagé ──► Moteur de décision ──► Solde affiché
     │                                      │                    │
     └──► Application Android               └──► Alertes         └──► Pièges rencontrés
```

Elle se lit aussi bien dans GitHub, en Markdown ordinaire.

---

## Le graphe de code

Engendré par graphify — extraction syntaxique, sans modèle de langage et sans
clé d'API.

```bash
npm run graph
```

Ce qui apparaît dans `graphify-out/` :

| Fichier | Contenu |
| --- | --- |
| `graph.html` | graphe interactif, recherche et zoom |
| `graph.json` | données brutes, exploitables par un agent |
| `GRAPH_REPORT.md` | rapport en langage clair : communautés, nœuds centraux |
| `workpulse-callflow.html` | 16 diagrammes Mermaid d'architecture et d'appels |
| `obsidian/` | un vault d'environ 1 500 notes, une par symbole |

Le dossier est **ignoré par git** : trois mégaoctets de fichiers engendrés qui
périment au premier commit n'ont pas leur place dans l'historique. Une commande
suffit à les reconstruire.

### Ce que le graphe a confirmé

Les nœuds les plus connectés du code source, une fois écartés les fichiers de
configuration :

| Nœud | Arêtes |
| --- | ---: |
| `WorkDayDto` | 19 |
| `SyncPort` | 17 |
| `TimeEntryDto` | 17 |
| `DateISO` | 17 |
| `Minutes` | 17 |

Deux enseignements. D'abord, les types du domaine — `DateISO`, `Minutes` —
irriguent tout le dépôt : c'est exactement l'effet recherché par le
[[Domaine partagé]]. Ensuite, `SyncPort` est un point de passage obligé,
confirmant que l'abstraction de persistance joue son rôle.

Le rapport distingue les arêtes extraites de celles qui sont inférées, ce qui
donne une idée honnête de sa fiabilité.

---

## Interroger

Le graphe répond à des questions qu'une recherche textuelle traite mal.

```bash
graphify query "comment le solde hebdomadaire est-il calculé ?"
graphify path "computePulse" "PrismaSyncPort"     # le chemin le plus court
graphify affected "DaySchedule"                    # ce qu'un changement toucherait
graphify explain "SyncPort"                        # explication en langage clair
graphify god-nodes --top 10                        # les points de passage
```

`affected` est le plus utile en pratique : avant de modifier un type du
domaine, il liste ce qui en dépend.

---

## Tenir le graphe à jour

```bash
npm run graph        # extraction + diagrammes d'appel
```

Le rapport indique le commit à partir duquel il a été construit :

```
## Graph Freshness
- Built from commit: `4e2c584`
```

Comparer avec `git rev-parse HEAD` dit s'il est périmé.

L'installation se fait une fois :

```bash
uv tool install graphifyy
graphify install --platform claude    # pour la commande /graphify
```
