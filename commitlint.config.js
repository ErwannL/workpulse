/**
 * Convention de commit : le journal de `main` doit rester lisible et permettre
 * de dériver automatiquement les notes de version.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
    'scope-enum': [
      2,
      'always',
      ['core', 'web', 'api', 'docs', 'ci', 'deps', 'repo', 'alertes', 'ui', 'db'],
    ],
  },
};
