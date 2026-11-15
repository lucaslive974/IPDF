import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;
const tauriPlatform = process.env.TAURI_ENV_PLATFORM ?? 'desktop';
const isMobile = tauriPlatform === 'android' || tauriPlatform === 'ios';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __IS_MOBILE__: JSON.stringify(isMobile),
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
