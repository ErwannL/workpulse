import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: {
      // Les tests visent la source du domaine : ils ne dépendent donc pas de
      // l'ordre de compilation des paquets.
      '@workpulse/core': fileURLToPath(
        new URL('../../packages/core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.e2e.test.ts'],
    // Une base réelle est plus lente à démarrer que la valeur par défaut.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
