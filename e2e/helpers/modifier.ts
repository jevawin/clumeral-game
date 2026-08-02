import type { Page } from "@playwright/test";
import { modifierLabel } from "../../src/shortcuts.ts";

// The shortcut hint renders whichever modifier the platform uses, so a spec that
// hardcodes "Ctrl" is really asserting that the runner is not a Mac. CI is Linux
// and would stay green; the first local run on Jamie's or Dave's machine would go
// red on a perfectly correct build.
//
// Reuses the app's own modifierLabel rather than restating the rule, so the two
// can't drift. That does mean this can't catch a bug *inside* modifierLabel —
// tests/shortcuts.spec.ts pins that behaviour directly, and what these specs are
// actually for is the wiring: that the right string reaches the right span.
export async function expectedModifier(
  page: Page,
): Promise<{ visible: "Cmd" | "Ctrl"; spoken: "Command" | "Control" }> {
  const platform = await page.evaluate(
    () =>
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
        ?.platform ?? navigator.platform,
  );
  const visible = modifierLabel(platform);
  return { visible, spoken: visible === "Cmd" ? "Command" : "Control" };
}
