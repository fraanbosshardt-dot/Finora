import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  webServer:process.env.CI?{command:"pnpm dev",url:"http://127.0.0.1:3000",reuseExistingServer:false,timeout:120000}:undefined,
  use: {
    baseURL: "http://127.0.0.1:3000",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
