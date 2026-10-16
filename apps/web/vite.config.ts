import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The client never talks to a hard-coded origin. `/api/*` is proxied to the
 * Fastify server so dev avoids CORS entirely and a reverse proxy can take over
 * in production with no client change.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
