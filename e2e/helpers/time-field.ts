import type { Page, Route } from "@playwright/test";

// The Daily leaderboard's field, stubbed. Shared by time-chart.spec.ts and
// results-page.spec.ts so a card that needs the leaderboard drawn gets it
// deterministically.
//
// page.route is unreliable on WebKit with an active service worker
// (e2e/fixtures.ts), so a spec using this sets `serviceWorkers: "block"`.

export type Row = { second: number; count: number };
export const rows = (times: number[]): Row[] => times.map((second) => ({ second, count: 1 }));

/** Stub the field. Returns a release() when `hold` is set, for the no-shift test. */
export async function stubField(page: Page, times: Row[], opts: { hold?: boolean; status?: number } = {}) {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/api/times/*", async (route: Route) => {
    if (opts.hold) await held;
    if (opts.status) await route.fulfill({ status: opts.status, json: { error: "Times unavailable" } });
    else await route.fulfill({ json: { times } });
  });
  return release;
}
