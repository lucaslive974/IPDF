import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __IS_MOBILE__: false,
    __ENABLE_CLOUD_SYNC__: true,
  },
  resolve: {
    alias: {
      '@domain': path.resolve(import.meta.dirname, 'src/core/domain'),
      '@ports': path.resolve(import.meta.dirname, 'src/core/ports'),
      '@core': path.resolve(import.meta.dirname, 'src/core'),
      '@adapters': path.resolve(import.meta.dirname, 'src/adapters'),
      '@hooks': path.resolve(import.meta.dirname, 'src/ui/hooks'),
      '@providers': path.resolve(import.meta.dirname, 'src/ui/providers'),
      '@stores': path.resolve(import.meta.dirname, 'src/ui/stores'),
      '@utils': path.resolve(import.meta.dirname, 'src/utils'),
      '@components': path.resolve(import.meta.dirname, 'src/ui/components'),
      '@ui': path.resolve(import.meta.dirname, 'src/ui/components/ui'),
      '@assets': path.resolve(import.meta.dirname, 'assets'),
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
