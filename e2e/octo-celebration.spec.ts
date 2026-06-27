import { test, expect, type Page } from "@playwright/test";

// Regression test for issue #210 — "Octopus goes invisible during celebration".
//
// Root cause (see .planning/debug/octopus-invisible-during-anim.md): the
// `octo-colours` keyframe used `light-dark()` for its fill stops. Tailwind v4's
// Lightning CSS optimize pass rewrites `light-dark()` into two concatenated
// `var()` expressions, which is an invalid SVG `<paint>` value. The browser
// discards the invalid fill and falls back to the `fill` initial value — black.
// On the dark-mode near-black background the octopus then vanishes.
//
// The bug only exists in BUILT output (the dev server skips Lightning CSS
// optimize), so this suite runs against `vite preview`. See playwright.config.ts.
//
// Oracle: drive the celebration fill animation and sample the rendered fill of
// the octopus body across the full 1.44s colour cycle. The fill must never be
// black, must never match the page background, and must actually change over
// time (proves the animation runs and we are reading its live values).

const THEME_BG = {
  dark: "rgb(18, 18, 19)", // #121213
  light: "rgb(250, 250, 250)", // #FAFAFA
} as const;

type OctoSample = { fills: string[]; keyframeFills: string[] };

// Drive the celebration fill animation and report (a) the live rendered fill
// sampled across one-plus full colour cycle (cycle = 1.44s) and (b) the parsed
// keyframe fill values the browser actually accepted. #210 corrupts both: the
// invalid `light-dark()` polyfill makes the keyframe stops fall back to black.
async function sampleOctoFill(page: Page): Promise<OctoSample> {
  return page.evaluate(async () => {
    const svg = document.querySelector("[data-octo]");
    // The keyframe targets the svg's first DIRECT-CHILD path
    // (`[data-octo].celebrate > path:first-of-type`) — the body fill. A naive
    // `path` selector would match the mask's path instead, which is not animated.
    const path = svg?.querySelector<SVGPathElement>(":scope > path");
    if (!svg || !path) throw new Error("octopus svg / body path not found");

    svg.classList.add("celebrate");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const anim = path.getAnimations()[0];
    const keyframeFills: string[] = anim
      ? anim.effect!.getKeyframes().map((k) => String((k as Record<string, unknown>).fill ?? ""))
      : [];

    const fills: string[] = [];
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        fills.push(getComputedStyle(path).fill);
        if (performance.now() - start > 1600) return resolve();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return { fills, keyframeFills };
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`octopus stays visible through the celebration colour cycle — ${theme} theme`, async ({ page }) => {
    // Force the theme before the app boots (theme.ts reads this key on init).
    await page.addInitScript((t) => localStorage.setItem("dlng_theme", t), theme);

    await page.goto("/");
    await expect(page.locator(`html.${theme}`)).toBeAttached();

    const { fills, keyframeFills } = await sampleOctoFill(page);

    expect(fills.length, "should have collected fill samples across the cycle").toBeGreaterThan(10);

    // Oracle 1 — parsed keyframe stops. #210 makes the 25/50/75% stops invalid,
    // so the browser drops them and they fall back to the `fill` initial (black).
    expect(keyframeFills.length, "celebration animation should be running").toBeGreaterThanOrEqual(4);
    const badStop = keyframeFills.find((c) => c === "" || c === "rgb(0, 0, 0)");
    expect(badStop, `a keyframe fill stop is invalid/black (#210 regression) in ${theme} theme`).toBeUndefined();

    // Oracle 2 — the live rendered fill. Must never be black (the #210 symptom)
    // and never blend into the page background.
    const black = fills.filter((c) => c === "rgb(0, 0, 0)");
    expect(black, `octopus fill went black (#210 regression) in ${theme} theme`).toHaveLength(0);

    const blendsIn = fills.filter((c) => c === THEME_BG[theme]);
    expect(blendsIn, `octopus fill matched the ${theme} background`).toHaveLength(0);

    // The fill must actually cycle — guards against a false pass where the
    // animation is not running and a single static colour is sampled.
    expect(new Set(fills).size, "fill should transition through several colours").toBeGreaterThanOrEqual(3);
  });
}
