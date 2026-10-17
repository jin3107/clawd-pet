import { defineConfig } from 'vite';

// `--mode tunnel` (npm run dev:tunnel): the page is opened through Discord's proxy over
// HTTPS:443, so the HMR websocket must also dial 443 instead of the local dev port.
export default defineConfig(({ mode }) => ({
  server: {
    port: 5173,
    allowedHosts: true,
    // Transform the entry up front so the first request through the tunnel doesn't pay (or fail on) a cold start.
    warmup: { clientFiles: ['./src/main.ts'] },
    hmr: mode === 'tunnel' ? { clientPort: 443 } : undefined,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
  // Pre-bundle the SDK at startup; otherwise Vite discovers it on the first page load, re-optimizes and
  // reloads, and requests made mid-way fail with "Outdated Optimize Dep".
  optimizeDeps: { include: ['@discord/embedded-app-sdk'] },
  build: { target: 'es2022' },
}));
