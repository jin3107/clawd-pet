import { defineConfig } from 'vite';

// `--mode tunnel` (npm run dev:tunnel): the page is opened through Discord's proxy over
// HTTPS:443, so the HMR websocket must also dial 443 instead of the local dev port.
export default defineConfig(({ mode }) => ({
  server: {
    port: 5173,
    allowedHosts: true,
    hmr: mode === 'tunnel' ? { clientPort: 443 } : undefined,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
  build: { target: 'es2022' },
}));
