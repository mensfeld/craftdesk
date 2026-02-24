import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        maxForks: 2
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'bin/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/',
        'tests/'
      ]
    },
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist']
  }
});
