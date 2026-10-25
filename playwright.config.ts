import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// The demo path runs against a production build with the mock model, the
// sample calendar and the test-only sign-in. It uses the real Supabase database
// and deletes what it created afterwards.
loadEnvConfig(process.cwd());
const PORT = 3210;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: "Asia/Hong_Kong",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], timezoneId: "Asia/Hong_Kong" } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: { E2E_TEST_MODE: "1", AI_MODE: "mock", APP_URL: `http://localhost:${PORT}` },
  },
});
