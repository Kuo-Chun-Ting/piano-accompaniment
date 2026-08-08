import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3200'
const isLive = process.env.PLAYWRIGHT_LIVE === 'true'
const isHeadless = process.env.PLAYWRIGHT_HEADLESS !== 'false'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  grepInvert: isLive ? undefined : /@live/,
  use: {
    baseURL,
    headless: isHeadless,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npx nuxt dev --port 3200',
        url: 'http://localhost:3200',
        env: {
          NUXT_BUILD_DIR: '.nuxt-e2e',
          ...(isLive
            ? {}
            : {
                NUXT_OPENAI_API_KEY: '',
                NUXT_OPENAI_MODEL: '',
              }),
        },
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
})
