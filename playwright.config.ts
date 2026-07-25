import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'cd server && npx tsx src/index.ts',
      port: 4000,
      timeout: 15000,
      reuseExistingServer: true,
    },
    {
      command: 'npx vite',
      port: 5173,
      timeout: 15000,
      reuseExistingServer: true,
    },
  ],
})
