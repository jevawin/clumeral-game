import { test as base, expect } from "@playwright/test";
import { attachConsoleGuard, type ConsoleGuard } from "./helpers/console.ts";

// Custom `test` for the structured suite. Every test gets a console guard that
// fails the test on unexpected console.error / pageerror in built output (real
// regressions).
//
// Feedback (#213) POSTs same-origin to /api/feedback and is served by the real
// preview Worker writing to a LOCAL miniflare D1 (seeded by `npm run e2e:db`,
// wired into the webServer command). Nothing leaves the machine, and the actual
// Worker route + D1 insert get exercised — so there's no network stub here. (An
// active service worker makes page.route interception unreliable on WebKit, which
// is the other reason to hit the real local endpoint rather than stub it.)
//
// Import { test, expect } from "../fixtures.ts" in specs under e2e/specs/.
export const test = base.extend<{ consoleGuard: ConsoleGuard }>({
  consoleGuard: [
    async ({ page }, use) => {
      const guard = attachConsoleGuard(page);
      await use(guard);
      guard.assertClean();
    },
    { auto: true },
  ],
});

export { expect };
