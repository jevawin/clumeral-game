import { test, expect } from "../fixtures.ts";

// A THROWAWAY spec (stats-Tailwind plan, Task 5b). Delete it once its numbers
// are in the pull request.
//
// Why it exists. Item 56 settled the box figures at a flat 30px, replacing a
// clamp that shrank to 20px on a narrow screen, and Jamie's sign-off named the
// risk: a long figure overflowing a box that has `overflow: hidden` would be
// silently CLIPPED, not wrapped. Nothing else in the suite can see that. The
// unit tests render into jsdom, which has no layout engine at all — it returns
// scrollWidth and clientWidth of 0 for every element and never resolves a
// clamp — so a jsdom check here is a guaranteed false pass.
//
// It also records the resolved font size at each width, so the pull request can
// state the change as a measurement rather than as arithmetic.
//
// It rides the Playwright matrix CI already runs on every pull request. It is
// not a reason to run Playwright locally.

// 320 is the narrowest phone worth supporting and the width section 0.2's wrap
// point was chosen against; 390 is a modern phone; 480 is the page column's own
// maximum, where the boxes are at their widest.
const WIDTHS = [320, 390, 480];

for (const width of WIDTHS) {
  test(`no stat figure is clipped at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });

    // The demo history fills the panel without waiting three days for the
    // reveal gate. It deliberately contains a 2210-second game, so the widest
    // time the format can produce is on screen rather than assumed.
    await page.goto(`/solved?demo=stats`);
    await expect(page.locator("[data-completion-panel]")).toBeVisible();
    await expect(page.locator("[data-stat-col]").first()).toBeVisible();

    const figures = await page.locator("[data-stat-value], [data-stat-figure-value]").evaluateAll(
      (nodes) => nodes.map((el) => ({
        text: (el.textContent ?? "").trim(),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        fontSize: getComputedStyle(el).fontSize,
      })),
    );

    expect(figures.length, "no figures found — the panel did not render").toBeGreaterThan(0);

    // Attached rather than logged, so the numbers survive into the CI report and
    // can be pasted into the pull request.
    await test.info().attach(`figures-${width}px.json`, {
      body: JSON.stringify(figures, null, 2),
      contentType: "application/json",
    });

    for (const f of figures) {
      expect(
        f.scrollWidth,
        `"${f.text}" at ${f.fontSize} overflows its box by ${f.scrollWidth - f.clientWidth}px at ${width}px wide`,
      ).toBeLessThanOrEqual(f.clientWidth);
    }
  });
}
