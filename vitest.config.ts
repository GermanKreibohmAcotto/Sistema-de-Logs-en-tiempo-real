import { defineConfig } from 'vitest/config';

export default defineConfig({
  // No `esbuild.jsx` here on purpose: Vitest 4 transforms through oxc, which
  // ignores esbuild options (it warns about them on every run) and already
  // defaults to the automatic JSX runtime the .tsx component tests need.
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['apps/**/test/**/*.test.{ts,tsx}', 'packages/**/test/**/*.test.{ts,tsx}'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
