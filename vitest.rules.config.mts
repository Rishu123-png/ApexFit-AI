import { defineConfig } from 'vitest/config';

/** Runs only against Firebase Realtime Database Emulator. */
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    hookTimeout: 30_000,
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
