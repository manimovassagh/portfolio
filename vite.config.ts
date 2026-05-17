import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'static/dist',
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: 'src/main.tsx',
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'app.css';
          return 'assets/[name]-[hash][extname]';
        },
        manualChunks: {
          react: ['react', 'react-dom'],
          charts: ['apexcharts', 'react-apexcharts'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});
