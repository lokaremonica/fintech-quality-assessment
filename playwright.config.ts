import { defineConfig, devices } from '@playwright/test';
import { environment } from './config/environment';

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/diagnostics/**',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: environment.name === 'ci' ? 2 : 4,
  timeout: 20_000,
  expect: { timeout: 5_000 },
  outputDir: 'test-results/artifacts',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: environment.uiBaseURL,
    screenshot: 'only-on-failure',
    // Raw traces include credentials and bodies. Sanitized API attachments are the default diagnostic.
    trace: 'off',
    video: 'off',
    actionTimeout: 5_000,
  },
  projects: [
    { name: 'api', testMatch: '**/api/**/*.spec.ts' },
    { name: 'ui-chromium', testMatch: '**/ui/**/*.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'framework', testMatch: '**/framework/**/*.spec.ts' },
  ],
  webServer: environment.startMock ? {
    command: 'npm start',
    url: `${environment.apiBaseURL}/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: { MOCK_PORT: String(environment.port), MOCK_AUTH_SECRET: environment.authSecret },
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
  } : undefined,
});
