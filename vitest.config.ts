import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/test/**/*.spec.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/core/**/*.ts', 'src/adapters/**/*.ts'],
      exclude: [
        'src/core/ports/**/*.ts',
        'src/core/domain/types.ts',
        'src/core/domain/BookMetadata.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
