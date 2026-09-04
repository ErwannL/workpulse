import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@workpulse/core': fileURLToPath(
        new URL('../../packages/core/src/index.ts', import.meta.url),
      ),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __APP_COMMIT__: JSON.stringify('test'),
    __APP_TAG__: JSON.stringify('test'),
    __BUILD_DATE__: JSON.stringify('1970-01-01T00:00:00.000Z'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/ui/icons.tsx',
      ],
      // Le domaine (`@workpulse/core`) est tenu à 100 %. Ici, les seuils
      // reflètent ce que des tests utiles atteignent réellement sur du code
      // d'interface : ils bloquent une régression, pas un rendu conditionnel.
      thresholds: {
        statements: 97,
        branches: 86,
        functions: 90,
        lines: 97,
      },
    },
  },
});
