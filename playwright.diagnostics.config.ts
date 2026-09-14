import { defineConfig, devices } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  testIgnore: [],
  workers: 1,
  retries: 0,
  outputDir: 'diagnostic-results/artifacts',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'diagnostic-report', open: 'never' }],
    ['json', { outputFile: 'diagnostic-results/results.json' }],
  ],
  projects: [{ name: 'diagnostics', testMatch: '**/diagnostics/**/*.spec.ts', use: { ...devices['Desktop Chrome'] } }],
});
