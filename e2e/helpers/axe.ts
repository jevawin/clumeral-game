import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

// The axe configuration and the label-in-name exception list, shared so that every
// spec that runs axe applies exactly the same rules. Moved here verbatim from
// e2e/specs/a11y.spec.ts, which still holds the tripwire and the pinned names; the
// time chart spec imports it so its scans cannot drift from that one list. "This
// suite" and "below" in the comments mean a11y.spec.ts.

// The ONE rule this suite overrules, and the exact nodes it overrules it on.
// Anything else axe reports still fails. Read `label-content-name-mismatch` in
// docs/INVARIANTS.md (P5) before touching this; #345 is the whole argument.
//
// axe 4.14 rewrote the rule to compare the accessible name against text VISIBLE
// ON SCREEN, ignoring aria-hidden. Both groups below are a value or a hint that
// is painted and deliberately hidden from the name, which the rule now reads as
// a label mismatch:
//
//   data-undo / data-reset — the visible label is "Undo"; the "Ctrl + Z" beneath
//     it is a supplementary hint, not what identifies the control. The name is
//     "Undo last change", which a voice user saying "click Undo" matches. The
//     only shape that satisfies axe moves the hint outside the button, where it
//     leaves the key-face — a visual change to the board controls to satisfy a
//     literal reading of the full visible string.
//
//   data-digit 0-2 — the painted digits are a VALUE DISPLAY. They report what is
//     left in the box; they do not identify it. Once aria-hidden they are content
//     rather than a visible label, and WCAG 2.5.3 is about labels. The shapes that
//     pass are a name that says nothing ("Hundreds box 0123456789"), dropping
//     role="button" from the primary game control, or not painting eliminated
//     digits at all.
//
// What replaces axe here, because the exception silences it permanently on these
// five: the names are pinned by hand instead. Both board-control aria-labels at
// "each control exposes its name and its shortcut description" below, the reset
// relabelling in undo-reset.spec.ts, and all three box names in "accessibility —
// digit box names". Those assertions are load-bearing now — do not tidy them away.
//
// And the gate that makes this safe to rely on: `test:e2e:smoke` is the whole
// spec set on chromium-desktop and is a required check on PRs into both staging
// and main, so the tripwire below runs on every future axe bump.
//
// Jamie's call, 2026-11-01, P5 owner. The tripwire below is what makes it safe
// rather than a shrug: a SIXTH node cannot appear silently, and if the set ever
// shrinks the dedicated test goes red and says to prune this list.
//
// A fourth option was considered and declined, and the record should say so
// rather than claim nothing exists: put the role on a text-free wrapper and make
// the painted text a SIBLING of the named control rather than a descendant. It
// clears both groups with the paint unchanged, and it is the conventional fix.
// Declined because it restructures the board controls and the primary game
// control to satisfy a reading of the rule we think is wrong anyway — but it is
// the thing to reach for if this exception is ever revisited.
export const LABEL_IN_NAME_RULE = "label-content-name-mismatch";

// Each entry is the axe target AND a signature that must appear in the node's own
// markup. The pairing is the fix for a real hole: axe's selector is only
// guaranteed unique within ONE document, and /archive is a separate
// Worker-rendered document that `seriousViolations` also scans. (Only /archive
// — /stats and the Worker feedback dashboard are never passed to axe, and the
// "feedback modal" scan is the in-app dialog in this same document.) A future
// `<button data-reset>Clear filters</button>` on /archive would
// be the only `[data-reset]` there, so axe would emit exactly
// `button[data-reset=""]` and a target-only match would silently excuse it.
// `board-ctrl` and `data-box-name` exist nowhere but index.html's board.
//
// The signature has to survive axe's own truncation of `node.html`: over 300
// characters it rebuilds the opening tag, and if the attribute block alone is
// over 300 it truncates every attribute NAME AND VALUE to 20 characters first.
// Both signatures clear that today — `data-box-name="Hundreds box"` is 13 and 12
// characters, and `class="key-face board-ctrl"` is 19 so the controls never reach
// the branch. Adding a long Tailwind class list to .board-ctrl, or any class
// BEFORE `board-ctrl`, would truncate the value and drop the signature. It fails
// closed, but the red reads `unexpected node(s) button[data-undo=""]` — a
// documented node reported as unexpected. If you see that, check the class order
// before touching this list.
export const LABEL_IN_NAME_EXCEPTIONS = [
  { target: 'button[data-undo=""]', signature: "board-ctrl" },
  { target: 'button[data-reset=""]', signature: "board-ctrl" },
  { target: 'div[data-digit="0"]', signature: "data-box-name" },
  { target: 'div[data-digit="1"]', signature: "data-box-name" },
  { target: 'div[data-digit="2"]', signature: "data-box-name" },
] as const;

export const LABEL_IN_NAME_TARGETS = LABEL_IN_NAME_EXCEPTIONS.map((e) => e.target);

// Excused only when the target AND the signature match. Anything else — a new
// node, the same selector in another document, or one of these five with its
// markup changed out from under the reasoning — is reported.
function isExcusedLabelInName(node: { target: unknown; html: string }): boolean {
  return LABEL_IN_NAME_EXCEPTIONS.some(
    (e) => String(node.target) === e.target && node.html.includes(e.signature),
  );
}

// Fail only on serious/critical violations — the launch-blocking bar. Lesser
// (moderate/minor) findings are surfaced by a full `axe` run but don't gate here.
//
// Deliberately NOT AxeBuilder's own .disableRules() or .exclude(): the first
// drops the rule everywhere, so a real mismatch on a future control would never
// be seen, and the second drops EVERY rule on those nodes, losing contrast and
// role checks on the digit boxes — the primary game control.
export async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .flatMap((v) => {
      if (v.id !== LABEL_IN_NAME_RULE) {
        return [`${v.id} (${v.impact}): ${v.nodes.length} node(s)`];
      }
      const unexpected = v.nodes.filter((n) => !isExcusedLabelInName(n));
      // Named, not counted: a new node here is a real finding and the message is
      // the first thing anyone reads.
      return unexpected.length
        ? [`${v.id} (${v.impact}): unexpected node(s) ${unexpected.map((n) => String(n.target)).join(", ")}`]
        : [];
    });
}
