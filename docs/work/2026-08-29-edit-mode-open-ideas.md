# Edit mode — ideas raised and not yet built

Everything Jamie has asked for that is still outstanding, with enough context to
pick each one up cold. Ordered by how much they change.

Anything he asked for that IS built is not listed — see the git log on
`dev/edit-mode-roundtrip`, which names each of his reports in its message.

---

## 1. Forward, to go with back

**Jamie, 2026-08-24: "Back works. Forward doesn't."**

Back undoes one change at a time. There is no redo. The brief only ever
specified back (items 66-70), so this is a new feature rather than a defect.

Cheap in principle — `history.undo()` already returns the change it removed, so
a redo stack is a second array. The thinking it needs is about the BACK STACK,
not the code: browser history has no "forward" the page can trigger, so redo
would be a button in the footer rather than a gesture, and pressing back then
forward would leave the browser's own history in a state the page did not
choose. Worth ten minutes of design before writing anything.

Touches `src/edit-mode/history.ts` and the footer in `controls.ts`.

## 2. Friendlier names for the class families

**Raised by me, 2026-08-27, not yet answered.**

The picker groups classes by the CSS properties they set, so the headings read
`font-size, line-height` and `padding-inline`. Precise, and exactly the same
rule that decides whether two classes replace each other — which is a real
virtue, because what you see matches what happens.

But on a phone they are long and technical. A friendly-name map ("Text size",
"Side padding") would read better and would be the first place the tool's
vocabulary drifts from Tailwind's. Jamie's call, since it is UI wording.

## 3. A Playwright project for edit mode

**Cut by Jamie on 2026-08-18 (brief item 88: "Cut. I will be the tester"), worth
reopening now Playwright is installed.**

The existing suite serves the PRODUCTION build, where edit mode is deliberately
absent — so it can prove edit mode is gone and can never prove it works. Testing
the tool needs a second Playwright project pointed at `vite dev`.

What it would buy, honestly: the interaction bugs, which is most of what has
gone wrong. What it would not: anything iOS-specific — the keyboard, the tab
discard, double-tap zoom. See the handover for the split.

Costs CI time and changes what runs on every pull request, so it is Jamie's
call, not an implementation detail.

## 4. The read-only link for Dave

**Agreed in the brief (items 21-29), built, never set up.**

The read-only port runs and refuses writes. Nobody has pointed a `cloudflared`
tunnel at it, so Dave has never seen a session. Operational, on Jamie's
Cloudflare account.

Worth doing before the pull request, because it is the only part of the design
nobody has exercised even once.

## 5. Deciding what happens to the free-CSS box on a phone

**Not raised by Jamie; noticed while building.**

The raw class field and the free-CSS box are desktop-only (brief item 34), and
Jamie only ever uses the phone. So two of the three patch kinds the session file
supports — `raw` and `css` — have never been produced in real use, and `/fold`
is being written against all three.

Either they need a way in on a phone, or the contract carries a shape that will
not appear in practice. Neither is wrong; it should be a decision rather than an
accident.

---

## Which first: bugs or ideas?

**Bugs first, and it is not close.**

Everything left in the ideas list sits on top of the same interaction layer the
open bug is in — the Safari restore path. Forward/redo in particular shares the
history and re-projection machinery with back. Building on it while it is
uncertain means building twice.

The one exception is **number 4, Dave's tunnel**, which touches no code at all
and is the only part of the whole design that has never been tried. That could
happen at any point, in parallel, whenever Jamie has ten minutes.

The single most useful next thing is not on this list: **an answer to whether
the Safari reload loses the work or just reloads the page.** That one report
decides whether there is a bug to chase at all.
