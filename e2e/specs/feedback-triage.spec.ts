import { test, expect } from "../fixtures.ts";

// Triage state on the admin dashboard (#225), against the built Worker and the
// local D1 seeded by `e2e:db`.
//
// Rows are created through the real public POST /api/feedback rather than seeded
// SQL, so the insert path and the read path are exercised together. Locally the
// request host is `localhost`, which the dashboard classifies as test traffic —
// hence `all=1` on every read here.
//
// Every project in the matrix shares one D1 and runs fullyParallel, so a message
// must be unique per *project*, not just per test — otherwise firefox resolves the
// row chromium is still asserting on.

const BASE = "/feedback?all=1&status=all";

// Same-origin is the CSRF guard, so the header has to match what the Worker sees.
// Take it from the Playwright baseURL rather than hardcoding the preview port.
function origin(baseURL: string | undefined): string {
  return new URL(baseURL ?? "http://localhost:4173").origin;
}

// The submit endpoint returns { ok: true }, not the new id, so read it back off the
// dashboard. The suite is fullyParallel and every test shares one D1, so "newest row"
// is not necessarily ours — find the card carrying this test's unique message and
// take the id from that card alone.
async function submitAndGetId(request: import("@playwright/test").APIRequestContext, label: string) {
  const message = `${label} [${test.info().project.name}]`;
  const post = await request.post("/api/feedback", {
    data: { category: "bug", message, puzzleNumber: "#1", date: "2026-07-22" },
  });
  expect(post.status()).toBe(200);

  const html = await (await request.get(BASE)).text();
  const card = html.split("<article").find((c) => c.includes(message));
  expect(card, `no card rendered for "${message}"`).toBeDefined();

  const id = /action="\/feedback\/(\d+)\/status"/.exec(card as string)?.[1];
  expect(id, `no status form in the card for "${message}"`).toBeDefined();
  return { id: Number(id), message };
}

test.describe("feedback triage", () => {
  test("a new row renders as open with a Resolve control", async ({ request }) => {
    const { id, message } = await submitAndGetId(request, "triage: renders open");
    const html = await (await request.get(BASE)).text();

    expect(html).toContain(`action="/feedback/${id}/status"`);
    expect(html).toContain("Resolve");
    expect(html).toContain(message);
  });

  test("resolving hides the row from the default view and Reopen restores it", async ({ request, baseURL }) => {
    const { id, message } = await submitAndGetId(request, "triage: resolve round trip");

    const res = await request.post(`/feedback/${id}/status`, {
      form: { status: "resolved", back: BASE },
      headers: { Origin: origin(baseURL) },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(303);

    // Default view is the outstanding queue — the resolved row drops out of it.
    const openOnly = await (await request.get("/feedback?all=1")).text();
    expect(openOnly).not.toContain(message);

    // ?status=all widens it back, and the control flips to Reopen.
    const all = await (await request.get(BASE)).text();
    expect(all).toContain(message);
    expect(all).toContain("Reopen");

    const back = await request.post(`/feedback/${id}/status`, {
      form: { status: "open", back: BASE },
      headers: { Origin: origin(baseURL) },
      maxRedirects: 0,
    });
    expect(back.status()).toBe(303);
    expect(await (await request.get("/feedback?all=1")).text()).toContain(message);
  });

  test("a cross-origin POST is refused", async ({ request }) => {
    const { id, message } = await submitAndGetId(request, "triage: csrf guard");

    const res = await request.post(`/feedback/${id}/status`, {
      form: { status: "resolved", back: BASE },
      headers: { Origin: "https://evil.example" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(403);

    // The row is untouched — still in the open queue.
    expect(await (await request.get("/feedback?all=1")).text()).toContain(message);
  });

  test("an unknown status value is rejected", async ({ request, baseURL }) => {
    const { id } = await submitAndGetId(request, "triage: bad status");

    const res = await request.post(`/feedback/${id}/status`, {
      form: { status: "wontfix", back: BASE },
      headers: { Origin: origin(baseURL) },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(400);
  });

  test("a status update for a row that does not exist is a 404", async ({ request, baseURL }) => {
    const res = await request.post("/feedback/99999/status", {
      form: { status: "resolved", back: BASE },
      headers: { Origin: origin(baseURL) },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(404);
  });
});

// The dashboard is served on canonical hosts only. Preview deploys bounce to
// production, so a Cloudflare Access policy that misses a hostname pattern cannot
// leave live feedback exposed (2026-07-22: `clumeral-game.jevawin.workers.dev` was
// serving it unauthenticated because the policy wildcard required a hyphen prefix).
//
// vite's own host check rejects a spoofed Host header before the Worker sees it, so
// this asserts the localhost side — that the rule does NOT fire on a canonical host.
// The host-matching itself is unit-tested in tests/feedback-triage.spec.ts.
test.describe("feedback dashboard host rule", () => {
  test("localhost serves the dashboard rather than redirecting", async ({ request }) => {
    const res = await request.get("/feedback?all=1", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("<title>Feedback");
  });

  test("the status route is reachable on localhost, not bounced", async ({ request, baseURL }) => {
    // A redirect here would silently retarget a write at production, so the rule is
    // GET-only and the POST answers 404 on preview hosts instead.
    const res = await request.post("/feedback/99999/status", {
      form: { status: "resolved", back: BASE },
      headers: { Origin: origin(baseURL) },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(404);
  });
});
