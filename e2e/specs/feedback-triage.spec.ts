import { test, expect } from "../fixtures.ts";

// Triage state on the admin dashboard (#225), against the built Worker and the
// local D1 seeded by `e2e:db`.
//
// Rows are created through the real public POST /api/feedback rather than seeded
// SQL, so the insert path and the read path are exercised together. Locally the
// request host is `localhost`, which the dashboard classifies as test traffic —
// hence `all=1` on every read here.

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
async function submitAndGetId(request: import("@playwright/test").APIRequestContext, message: string) {
  const post = await request.post("/api/feedback", {
    data: { category: "bug", message, puzzleNumber: "#1", date: "2026-07-22" },
  });
  expect(post.status()).toBe(200);

  const html = await (await request.get(BASE)).text();
  const card = html.split("<article").find((c) => c.includes(message));
  expect(card, `no card rendered for "${message}"`).toBeDefined();

  const id = /action="\/feedback\/(\d+)\/status"/.exec(card as string)?.[1];
  expect(id, `no status form in the card for "${message}"`).toBeDefined();
  return Number(id);
}

test.describe("feedback triage", () => {
  test("a new row renders as open with a Resolve control", async ({ request }) => {
    const id = await submitAndGetId(request, "triage: renders open");
    const html = await (await request.get(BASE)).text();

    expect(html).toContain(`action="/feedback/${id}/status"`);
    expect(html).toContain("Resolve");
    expect(html).toContain("triage: renders open");
  });

  test("resolving hides the row from the default view and Reopen restores it", async ({ request, baseURL }) => {
    const id = await submitAndGetId(request, "triage: resolve round trip");

    const res = await request.post(`/feedback/${id}/status`, {
      form: { status: "resolved", back: BASE },
      headers: { Origin: origin(baseURL) },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(303);

    // Default view is the outstanding queue — the resolved row drops out of it.
    const openOnly = await (await request.get("/feedback?all=1")).text();
    expect(openOnly).not.toContain("triage: resolve round trip");

    // ?status=all widens it back, and the control flips to Reopen.
    const all = await (await request.get(BASE)).text();
    expect(all).toContain("triage: resolve round trip");
    expect(all).toContain("Reopen");

    const back = await request.post(`/feedback/${id}/status`, {
      form: { status: "open", back: BASE },
      headers: { Origin: origin(baseURL) },
      maxRedirects: 0,
    });
    expect(back.status()).toBe(303);
    expect(await (await request.get("/feedback?all=1")).text()).toContain("triage: resolve round trip");
  });

  test("a cross-origin POST is refused", async ({ request }) => {
    const id = await submitAndGetId(request, "triage: csrf guard");

    const res = await request.post(`/feedback/${id}/status`, {
      form: { status: "resolved", back: BASE },
      headers: { Origin: "https://evil.example" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(403);

    // The row is untouched — still in the open queue.
    expect(await (await request.get("/feedback?all=1")).text()).toContain("triage: csrf guard");
  });

  test("an unknown status value is rejected", async ({ request, baseURL }) => {
    const id = await submitAndGetId(request, "triage: bad status");

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
