import { defineConfig } from '@playwright/test'
import { config } from 'dotenv'

// The Next dev server loads .env.local itself, but the Playwright test process
// does not — and specs call createAdminClient() directly, which needs these.
config({ path: '.env.local' })

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
})
