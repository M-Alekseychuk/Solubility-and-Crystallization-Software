import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('plotly.js') || id.includes('react-plotly')) {
              return 'plotly';
            }
            if (id.includes('mathjs')) {
              return 'mathjs';
            }
            if (id.includes('xlsx') || id.includes('xlsx-js-style') || id.includes('exceljs')) {
              return 'xlsx';
            }
            if (id.includes('docx') || id.includes('pptxgenjs')) {
              return 'office';
            }
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
