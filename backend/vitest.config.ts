import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig(
  defineWorkersConfig({
    test: {
      poolOptions: {
        workers: {
          wrangler: {
            configPath: './wrangler.toml',
          },
          singleWorker: true,
        },
      },
      include: ['tests/**/*.test.ts'],
    },
  })
);
