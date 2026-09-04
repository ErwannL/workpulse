// Marque le dossier CJS comme CommonJS : sans ce fichier, Node lit le
// `"type": "module"` du paquet et refuse les `require` de dist/cjs.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
mkdirSync(`${dist}/cjs`, { recursive: true });
writeFileSync(`${dist}/cjs/package.json`, JSON.stringify({ type: 'commonjs' }, null, 2));
mkdirSync(`${dist}/esm`, { recursive: true });
writeFileSync(`${dist}/esm/package.json`, JSON.stringify({ type: 'module' }, null, 2));
console.log('dist/{esm,cjs}/package.json écrits');
