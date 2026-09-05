import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/graphify-out/**',
      '**/*.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Règles communes à tout le dépôt.
  {
    files: ['**/*.{ts,tsx,mts,mjs,js}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.node, ...globals.es2023 },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // Une promesse oubliée dans du code asynchrone est un bug silencieux.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'object-shorthand': 'error',
    },
  },

  // Application web : React et navigateur.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, __APP_VERSION__: 'readonly' } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Le domaine ne doit dépendre de rien : ni React, ni Node, ni base de données.
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'dexie*', '@nestjs/*', '@prisma/*', 'node:*'],
              message:
                'Le paquet @workpulse/core doit rester pur : aucune dépendance à une plateforme.',
            },
          ],
        },
      ],
    },
  },

  // API : NestJS résout ses dépendances à l'exécution via les métadonnées des
  // décorateurs. Transformer un import de classe injectée en `import type`
  // effacerait cette métadonnée et casserait l'injection au démarrage.
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },

  // Les scripts de construction parlent sur la sortie standard : c'est leur rôle.
  {
    files: ['**/scripts/**/*.{mjs,js}'],
    rules: { 'no-console': 'off' },
  },

  // Les tests peuvent tricher : mocks partiels, assertions non nulles.
  {
    files: ['**/*.test.{ts,tsx}', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  prettier,
);
