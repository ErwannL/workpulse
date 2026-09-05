import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // SWC fournit `emitDecoratorMetadata`, que l'injection de dépendances de
  // NestJS exige et qu'esbuild ne sait pas produire.
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
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/main.ts',
        'src/**/*.module.ts',
        'src/**/*.dto.ts',
        'src/prisma/prisma.service.ts',
      ],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
