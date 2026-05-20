import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/static/dist/',
  build: {
    outDir: 'static/dist',
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: 'index.html',
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks: {
          react: ['react', 'react-dom'],
          charts: ['apexcharts', 'react-apexcharts'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});
