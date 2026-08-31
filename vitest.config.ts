import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // FALSE, because `npm test` IS the deploy gate. With passWithNoTests: true a single mistake in the
    // `include` glob above — a rename of tests/, a move to src/**/*.spec.ts — makes vitest collect zero
    // files and STILL exit 0. CI's required check goes green, deploy.yml's test job goes green, and the
    // site ships with the whole safety net switched off and nothing red anywhere to say so. The pure
    // logic in src/lib is the only thing tested here; an empty run must be a failure, not a pass.
    passWithNoTests: false,
  },
});
