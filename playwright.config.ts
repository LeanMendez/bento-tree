import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/visual',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    deviceScaleFactor: 1,
    baseURL: 'http://localhost:4321',
  },
  webServer: {
    // --ignore-lock: servidor en primer plano (Astro lo manda a background si detecta un agente de IA).
    command: 'pnpm astro dev --port 4321 --ignore-lock',
    url: 'http://localhost:4321',
    reuseExistingServer: true,
  },
});
