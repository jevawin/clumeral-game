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
  // Documented /stats fallback: the Worker returns 503 when analytics secrets are
  // absent (the usual case on local preview). The browser logs the failed document
  // load as a console error — expected, not a regression.
  /Failed to load resource: the server responded with a status of 503/i,
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
