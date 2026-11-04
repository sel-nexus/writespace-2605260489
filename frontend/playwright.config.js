/** Start a local frontend and test it at the required responsive widths. */
import 'dotenv/config';
import { defineConfig } from '@playwright/test';

const port = Number(process.env.VITE_PORT || 5173);
const baseURL = process.env.VITE_BASE_URL || `http://127.0.0.1:${port}`;
const target = new URL(baseURL);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('VITE_PORT must be a valid port number.');
}
if (!['http:', 'https:'].includes(target.protocol)) {
  throw new Error('VITE_BASE_URL must be an HTTP URL.');
}
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  use: { baseURL, browserName: 'chromium', trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 0.0.0.0 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: { VITE_PORT: String(port), VITE_BASE_URL: baseURL },
  },
});
