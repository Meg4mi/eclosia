import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

// environnement distant : Chromium préinstallé hors du cache Playwright ;
// CI/local : résolution Playwright normale (npx playwright install chromium)
const chromiumPath =
  process.env.CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  webServer: {
    command: 'npx serve out -l 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
