import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-charts':   ['recharts'],
            'vendor-pdf':      ['jspdf', 'jspdf-autotable'],
            'vendor-xlsx':     ['xlsx'],
            'vendor-ui':       ['@base-ui/react', 'sonner', 'next-themes'],
          },
        },
      },
    },
  };
});
