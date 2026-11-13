import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@domain': path.resolve(__dirname, 'src/core/domain'),
      '@ports': path.resolve(__dirname, 'src/core/ports'),
      '@core': path.resolve(__dirname, 'src/core'),
      '@adapters': path.resolve(__dirname, 'src/adapters'),
      '@hooks': path.resolve(__dirname, 'src/ui/hooks'),
      '@providers': path.resolve(__dirname, 'src/ui/providers'),
      '@stores': path.resolve(__dirname, 'src/ui/stores'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@components': path.resolve(__dirname, 'src/ui/components'),
      '@ui': path.resolve(__dirname, 'src/ui/components/ui'),
      '@assets': path.resolve(__dirname, 'assets'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/test/**/*.spec.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['text', 'html', 'json-summary', 'lcov'],
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
