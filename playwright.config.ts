import { defineConfig, devices } from "@playwright/test";

// E2E tests run against the PRODUCTION build (`vite preview`), not `vite dev`.
// Reason: some bugs only exist in built output — e.g. #210, where Tailwind v4's
// Lightning CSS optimize pass rewrites `light-dark()` into an invalid concatenated
// SVG fill. The dev server skips that pass, so the bug never appears there.
// Test what ships.
const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    // #210 is an animation bug — never let the runner disable animations.
    reducedMotion: "no-preference",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // `preview` = `vite build && vite preview`. Always rebuild before serving —
    // this suite exists to test BUILT output, so reusing a stale preview server
    // (an older dist) would give false green/red. Never reuse.
    command: "npm run preview",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
