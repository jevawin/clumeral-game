import { test, expect } from "../fixtures.ts";
import { MenuPage } from "../pages/menu.page.ts";
import { FeedbackPage } from "../pages/feedback.page.ts";
import { gotoPlayableGame } from "../helpers/game-setup.ts";
import { expectActiveScreen } from "../helpers/screens.ts";
import { solvePuzzle } from "../helpers/solve.ts";

test.describe("header menu", () => {
  test("burger toggles the menu and flips aria-expanded; Esc closes it", async ({ page }) => {
    await gotoPlayableGame(page);
    const menu = new MenuPage(page);

    await expect(menu.menuBtn).toHaveAttribute("aria-expanded", "false");
    await menu.open();
    await expect(menu.menuBtn).toHaveAttribute("aria-expanded", "true");
    await expect(menu.menu).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu.menuBtn).toHaveAttribute("aria-expanded", "false");
  });

  test("how-to-play menu link reaches the help (welcome) screen even after solving", async ({ page }) => {
    // Solve today first so a todayEntry exists — now /welcome resolves to /solved
    // (route-resolver RTE-03). HTP navigates with skipResolve, which is the ONLY
    // thing that lets a solved-today player still reach the welcome/help screen
    // instead of being bounced back to completion. Solving first is what actually
    // exercises that bypass.
    await gotoPlayableGame(page);
    await solvePuzzle(page);
    await expectActiveScreen(page, "completion");

    const menu = new MenuPage(page);
    await menu.open();
    await expect(menu.htpBtn).toBeVisible();
    await menu.htpBtn.click();

    // skipResolve bypassed the /welcome → /solved redirect; the burger closed.
    await expectActiveScreen(page, "welcome");
    await expect(menu.menuBtn).toHaveAttribute("aria-expanded", "false");
  });

  test("feedback modal: open, fill, send succeeds and closes", async ({ page }) => {
    await gotoPlayableGame(page);
    const menu = new MenuPage(page);
    const fb = new FeedbackPage(page);

    await menu.open();
    await menu.fbBtn.click();
    await expect(fb.modal).toBeVisible();

    await fb.cat("bug").click();
    await fb.msg.fill("E2E smoke feedback — please ignore.");
    await fb.send.click();

    // Success closes the modal — a persistent signal, unlike the toast which
    // self-removes after 3s (flaky to assert under load). The send hits the real
    // preview Worker → local D1 (seeded by e2e:db); a non-200 makes the client log
    // a non-allowlisted console.error and the guard fails the test — the right signal.
    await expect(fb.modal).toBeHidden();
    await expect(page.locator("[data-toast] .toast-msg")).toBeVisible();
  });

  test("theme toggle flips the root class and persists across reload", async ({ page }) => {
    await gotoPlayableGame(page);
    const menu = new MenuPage(page);
    const root = page.locator("html");

    const wasDark = await root.evaluate((el) => el.classList.contains("dark"));
    const expected = wasDark ? /light/ : /dark/;

    await menu.open();
    await menu.themeToggle.click();
    await expect(root).toHaveClass(expected);

    await page.reload();
    await expect(root).toHaveClass(expected);
    expect(await page.evaluate(() => localStorage.getItem("dlng_theme"))).toBe(
      wasDark ? "light" : "dark",
    );
  });

  test("colour swatch selection persists across reload", async ({ page }) => {
    await gotoPlayableGame(page);
    const menu = new MenuPage(page);

    await menu.open();
    await menu.swatch("Berry").click();
    expect(await page.evaluate(() => localStorage.getItem("dlng_colour"))).toBe("Berry");

    await page.reload();
    expect(await page.evaluate(() => localStorage.getItem("dlng_colour"))).toBe("Berry");
  });
});
