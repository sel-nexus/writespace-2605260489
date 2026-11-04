/** Configure the standalone frontend and isolated DOM tests. */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const port = Number(env.VITE_PORT || 5173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('VITE_PORT must be a valid port number.');
  }
  return {
    plugins: [react()],
    server: { host: '0.0.0.0', port, strictPort: true },
    preview: { host: '0.0.0.0', port, strictPort: true },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      include: ['src/**/*.test.{js,jsx}'],
      restoreMocks: true,
      unstubGlobals: true,
    },
  };
});
