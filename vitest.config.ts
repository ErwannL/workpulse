import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __APP_COMMIT__: JSON.stringify('test'),
    __APP_TAG__: JSON.stringify('test'),
    __BUILD_DATE__: JSON.stringify('1970-01-01T00:00:00.000Z'),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
