import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
