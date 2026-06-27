import { test, expect } from "../fixtures.ts";

// Smoke: every user-reachable route loads without erroring, with its primary
// element present and the console guard clean. SPA routes serve the app shell;
// /archive and /stats are Worker-rendered; /puzzles 302s to /archive.

test.describe("smoke: routes load clean", () => {
  test("/ serves the app shell", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("[data-screens]")).toBeAttached();
  });

  test("/play serves the app shell", async ({ page }) => {
    // A cold visitor with no history bounces to /welcome (RTE-03) — either way the
    // shell loads. Smoke only asserts the shell + a clean console.
    const res = await page.goto("/play");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("[data-screens]")).toBeAttached();
  });

  test("/solved serves the app shell", async ({ page }) => {
    const res = await page.goto("/solved");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("[data-screens]")).toBeAttached();
  });

  test("/archive renders the SSR list", async ({ page }) => {
    const res = await page.goto("/archive");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("h1")).toContainText("Every Clumeral");
  });

  test("/puzzles redirects to /archive", async ({ page }) => {
    await page.goto("/puzzles");
    expect(new URL(page.url()).pathname).toBe("/archive");
    await expect(page.locator("h1")).toContainText("Every Clumeral");
  });

  test("/stats serves the dashboard or the documented 503", async ({ page }) => {
    // Checked at the request level: a browser navigation to the 503 fallback would
    // log an (expected) resource-load console error, which the guard shouldn't have
    // to allowlist. Local preview usually lacks analytics secrets → documented 503;
    // with secrets it renders the dashboard.
    const res = await page.request.get("/stats");
    expect([200, 503]).toContain(res.status());
    const body = await res.text();
    if (res.status() === 200) expect(body).toContain("Clumeral Stats");
    else expect(body).toContain("Analytics secrets not configured");
  });
});
