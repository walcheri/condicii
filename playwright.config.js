import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:11041",
    channel: "chrome",
    headless: true,
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node server.js",
    url: "http://127.0.0.1:11041/api/health",
    env: { PORT: "11041", DATA_DIR: ".browser-data", NODE_ENV: "test" },
    reuseExistingServer: false,
  },
  reporter: "list",
});
