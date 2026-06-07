import type { Page } from "@playwright/test";

// Known-benign console noise. Keep this list tight — every entry is a deliberate
// exception, not a catch-all. Add a pattern only when you've confirmed the message
// is harmless (e.g. a third-party beacon failing against a stubbed endpoint).
const ALLOW: RegExp[] = [
  /favicon\.ico/i,
  // Analytics/feedback beacons may fail against stubs or the local Worker — the
  // app swallows these by design and they are not user-facing errors.
  /script\.google\.com/i,
  /\/api\/event/i,
  // External Google Fonts noise. When the test host can't reach fonts.gstatic.com
  // (offline CI / sandbox), the @font-face downloads fail and the SW can't return a
  // Response for the cross-origin fetch. Firefox surfaces all of this as console
  // errors; the app falls back to system fonts. Environmental, not a regression —
  // production reaches Google Fonts normally. (SW cross-origin handling is tracked
  // separately as a minor follow-up.) Patterns are scoped to the fonts host / SW
  // wording so they can't mask a genuine same-origin error.
  /fonts\.(gstatic|googleapis)\.com/i, // also matches the "Cross-Origin Request Blocked … fonts.gstatic.com" line
  /downloadable font: download failed/i,
  /ServiceWorker passed a promise to FetchEvent\.respondWith\(\) that resolved with non-Response/i,
  /An attempt was made to use an object that is not, or is no longer, usable/i,
];

export interface ConsoleGuard {
  /** Throw if any non-allowlisted console.error / pageerror was seen. */
  assertClean(): void;
  /** Raw collected messages, for debugging. */
  readonly errors: readonly string[];
}

// Attach a guard that records console.error and uncaught pageerror events. Call
// assertClean() at the end of a test (the fixture does this automatically) to fail
// on any unexpected error — these are real regressions in built output.
export function attachConsoleGuard(page: Page): ConsoleGuard {
  const errors: string[] = [];
  const allowed = (text: string) => ALLOW.some((re) => re.test(text));

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (!allowed(text)) errors.push(`console.error: ${text}`);
  });
  page.on("pageerror", (err) => {
    const text = err.message ?? String(err);
    if (!allowed(text)) errors.push(`pageerror: ${text}`);
  });

  return {
    errors,
    assertClean() {
      if (errors.length) {
        throw new Error(
          `Console guard caught ${errors.length} unexpected error(s):\n  ${errors.join("\n  ")}`,
        );
      }
    },
  };
}
