import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
  },
  optimizeDeps: {
    include: ['@mysten/dapp-kit', 'zustand', 'use-sync-external-store', 'use-sync-external-store/shim/with-selector'],
  },
});
