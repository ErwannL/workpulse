---
tags: [securite, decouverte]
---

# Pollution de prototype

La vraie faille du projet.

## Le problème

Les réglages sont le seul champ libre du protocole : leur forme appartient au
[[Domaine partagé]], la base ne les valide pas. Cette liberté est aussi une
porte.

```json
{ "settings": { "payload": { "__proto__": { "pirate": true } } } }
```

Fusionné par un `{...a, ...b}`, cet objet modifie le prototype d'`Object` — et
donc le comportement de **tout le processus**.

## La défense

`sanitizeJson()` recopie clé par clé et écarte `__proto__`, `constructor` et
`prototype`, à toute profondeur, tableaux compris. Elle borne aussi la taille
et l'imbrication.

Elle vit dans le [[Domaine partagé]] parce que deux endroits en ont besoin :
l'API, et l'import de sauvegarde côté application — où le fichier vient aussi
de l'extérieur.

## Le test qui compte

```ts
expect(({} as Record<string, unknown>).pirate).toBeUndefined();
```

Vérifier que la clé a été retirée ne suffit pas : il faut vérifier que le
prototype global est intact.

Voir [docs/securite.md](../securite.md)
