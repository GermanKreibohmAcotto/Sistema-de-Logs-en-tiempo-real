// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
  {
    // Plain Node scripts (not covered by the TS parser, which is where
    // no-undef normally gets disabled in favor of tsc's own checks).
    files: ['**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
  eslintConfigPrettier,
);
