import { defineConfig } from '@playwright/test'

// Drives the Edge already installed on Windows (no browser download).
// Dev server for captures: lab.html is dev-only, so captures run against `vite`, not `vite preview`.
export default defineConfig({
  testDir: 'tests',
  testMatch: ['capture/**/*.spec.ts', 'e2e/**/*.spec.ts'],
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 1, // a dev-server reload mid-capture (another edit landing) should not fail a shot
  reporter: [['list']],
  use: {
    channel: 'msedge',
    headless: true,
    baseURL: 'http://localhost:5173/M3/',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    url: 'http://localhost:5173/M3/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
