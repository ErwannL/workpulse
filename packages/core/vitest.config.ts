import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      // `testing` fabrique des jeux d'essai, `index` ne fait que réexporter.
      exclude: ['src/**/*.test.ts', 'src/testing.ts', 'src/index.ts'],
      thresholds: {
        // Le domaine est le cœur du produit : aucune ligne non couverte.
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
