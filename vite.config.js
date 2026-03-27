import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  root: './',
  envDir: './',
  plugins: [react(), cloudflare()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      },
      '/ping': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      },
      // Proxy websocket connections if client tries to connect to /ws
      '/ws': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      },
    },
    allowedHosts: ['localhost'], // add cloudflare tunnel here when testing discord activity
    hmr: {
      host: 'localhost',
    },
  },
});
