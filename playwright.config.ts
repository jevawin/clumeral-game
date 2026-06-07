import { defineConfig, devices } from "@playwright/test";

// E2E tests run against the PRODUCTION build (`vite preview`), not `vite dev`.
// Reason: some bugs only exist in built output — e.g. #210, where Tailwind v4's
// Lightning CSS optimize pass rewrites `light-dark()` into an invalid concatenated
// SVG fill. The dev server skips that pass, so the bug never appears there.
// Test what ships.
const PORT = 4173;

// The structured regression suite lives in e2e/specs/** and runs across the full
// browser matrix. The older ad-hoc specs sit in e2e/ root and stay chromium-only
// (their original scope) so the matrix doesn't change their behaviour.
const SUITE = /specs[\\/].*\.spec\.ts$/;
const LEGACY = /e2e[\\/][^\\/]+\.spec\.ts$/;

// Deterministic clock context for the suite: UTC so the browser-local day matches
// the worker's todayUTC() (which /api/dev/answer keys on). Specs that test timezone
// divergence override timezoneId per-describe.
const SUITE_USE = { timezoneId: "UTC", locale: "en-GB" } as const;

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
    // ── Structured regression suite — full browser matrix ──
    { name: "chromium-desktop", testMatch: SUITE, use: { ...devices["Desktop Chrome"], ...SUITE_USE } },
    { name: "webkit-desktop", testMatch: SUITE, use: { ...devices["Desktop Safari"], ...SUITE_USE } },
    { name: "firefox-desktop", testMatch: SUITE, use: { ...devices["Desktop Firefox"], ...SUITE_USE } },
    { name: "mobile-chromium", testMatch: SUITE, use: { ...devices["Pixel 5"], ...SUITE_USE } },
    { name: "mobile-webkit", testMatch: SUITE, use: { ...devices["iPhone 13"], ...SUITE_USE } },
    // ── Existing ad-hoc specs — chromium only, unchanged scope ──
    { name: "legacy-chromium", testMatch: LEGACY, use: { ...devices["Desktop Chrome"] } },
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
