import { defineConfig } from 'vitest/config';

/**
 * Tests de tenue en charge.
 *
 * Ils mesurent des durées : ils tournent donc sans instrumentation de
 * couverture, seuls, et sans parallélisme — trois conditions sans lesquelles
 * les seuils deviendraient du bruit.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.perf.ts'],
    fileParallelism: false,
    coverage: { enabled: false },
  },
});
