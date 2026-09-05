import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

/** Révision Git injectée au build et affichée dans le panneau d'administration. */
function gitInfo() {
  try {
    return {
      sha: execSync('git rev-parse --short HEAD').toString().trim(),
      tag: execSync('git describe --tags --always').toString().trim(),
    };
  } catch {
    return { sha: 'dev', tag: 'dev' };
  }
}
const git = gitInfo();

export default defineConfig({
  // Chemins relatifs : l'application doit fonctionner sous un sous-dossier
  // (GitHub Pages) comme à la racine d'un domaine.
  base: './',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@workpulse/core': fileURLToPath(
        new URL('../../packages/core/src/index.ts', import.meta.url),
      ),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(git.sha),
    __APP_TAG__: JSON.stringify(git.tag),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          storage: ['dexie', 'dexie-react-hooks'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'WorkPulse',
        short_name: 'WorkPulse',
        description: 'Assistant personnel de temps de travail',
        theme_color: '#0B0D12',
        background_color: '#0B0D12',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        lang: 'fr',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
});
