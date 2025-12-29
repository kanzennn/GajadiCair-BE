module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
    'sonarjs',
  ],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:sonarjs/recommended',
  ],
  rules: {
    // === METRICS / QUALITY RULES ===

    // Cyclomatic Complexity
    'complexity': ['warn', 10],

    // Cognitive Complexity (lebih cocok TS & NestJS)
    'sonarjs/cognitive-complexity': ['warn', 15],

    // Function terlalu panjang
    'max-lines-per-function': [
      'warn',
      { max: 60, skipBlankLines: true, skipComments: true },
    ],

    // Nested if/loop terlalu dalam
    'max-depth': ['warn', 4],

    // Terlalu banyak parameter
    'max-params': ['warn', 5],
  },
};
