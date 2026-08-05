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

  test("/stats serves the dashboard", async ({ page }) => {
    // Checked at the request level rather than by navigating: a browser
    // navigation logs resource-load console errors the guard would have to
    // allowlist. The old "200 or 503" tolerance is gone — stats read D1, so
    // there are no secrets to be missing and 503 is no longer a valid outcome.
    const res = await page.request.get("/stats");
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("Clumeral Stats");
  });
});
