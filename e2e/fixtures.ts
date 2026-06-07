import { test as base, expect } from "@playwright/test";
import { attachConsoleGuard, type ConsoleGuard } from "./helpers/console.ts";

// Custom `test` for the structured suite. Every test gets:
//  - a console guard that fails the test on unexpected console.error / pageerror
//    in built output (real regressions), and
//  - the external feedback endpoint stubbed at the network boundary, so the real
//    client send code runs but nothing leaves the machine.
//
// Import { test, expect } from "../fixtures.ts" in specs under e2e/specs/.
export const test = base.extend<{ consoleGuard: ConsoleGuard }>({
  consoleGuard: [
    async ({ page }, use) => {
      const guard = attachConsoleGuard(page);

      // Feedback → Google Apps Script. Fulfil 200 so the client's success path runs;
      // no real network call leaves. When #213 (Supabase feedback) lands, swap this
      // for the same-origin POST /api/feedback and drop the Google pattern.
      await page.route("**/script.google.com/**", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
      );

      await use(guard);
      guard.assertClean();
    },
    { auto: true },
  ],
});

export { expect };
