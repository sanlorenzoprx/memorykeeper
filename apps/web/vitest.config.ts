import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // switch to 'jsdom' if you add DOM-based tests
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
});