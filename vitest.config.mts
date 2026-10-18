import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // 'server-only' throws when imported in plain Node; in unit tests the
      // guard is meaningless, so alias it to a no-op stub.
      'server-only': path.resolve(import.meta.dirname, 'src/lib/__mocks__/server-only.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
