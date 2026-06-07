import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vitest/config';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true, template: 'treemap' }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      include: ['**/*.test.{ts,tsx}'],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            // Use anchored path segments to avoid false matches (e.g. @floating-ui/react-dom)
            if (/node_modules[/\\]react-dom[/\\]/.test(id))     return 'vendor-react';
            if (/node_modules[/\\]react-router/.test(id))        return 'vendor-react';
            if (/node_modules[/\\]react[/\\]/.test(id))          return 'vendor-react';
            if (/node_modules[/\\]scheduler[/\\]/.test(id))      return 'vendor-react';
            if (id.includes('@supabase'))                         return 'vendor-supabase';
            if (id.includes('recharts'))                          return 'vendor-charts';
            if (id.includes('jspdf'))                             return 'vendor-pdf';
            if (id.includes('xlsx'))                              return 'vendor-xlsx';
            if (id.includes('@base-ui'))                          return 'vendor-ui';
            if (id.includes('@floating-ui'))                      return 'vendor-ui';
            if (id.includes('sonner'))                            return 'vendor-ui';
            if (id.includes('next-themes'))                       return 'vendor-ui';
            if (id.includes('driver.js'))                         return 'vendor-driver';
            if (id.includes('tailwind-merge'))                    return 'vendor-utils';
          },
        },
      },
    },
  };
});
