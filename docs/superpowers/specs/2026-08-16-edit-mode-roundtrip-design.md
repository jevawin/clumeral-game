# Edit-mode round-trip — design

**Date:** 2026-08-16
**Status:** approved in design, not yet planned or built
**Repos touched:** `clumeral-game` (everything below), `pi-dev-bot` (the `/fold` command only)

## Problem

Jamie iterates on visual design by changing CSS and looking at the result. Today the only way
to get those changes into the codebase is to *describe* them to the clumeral dev bot in
Telegram — sometimes literally ("`margin-top: 1rem`"), sometimes vaguely ("more space between
x and y"). Both are lossy. He wants to make the change himself, see it, and have the bot fold
it into source properly.

Dave needs to see the result. Dave does not need to edit.

## What already exists

`clumeral-game` already publishes a per-branch Cloudflare preview URL for every branch
(`wrangler versions upload`, `env.preprod`, on `workers.dev` — see
`2026-08-05-clumeral-preprod-split-design.md`). **The "bot builds a preview and links us to it"
half of the request is already solved.** Nothing in this design changes it.

Because Dave only looks, Dave keeps using that preview URL exactly as now. Everything below
concerns Jamie's editing instance only, which splits one hard problem into two easy ones.

## Rejected alternatives

**Chrome DevTools alone.** Class-attribute edits in the Elements panel touch the live DOM only:
a reload discards them, there is nothing to share, and (to be verified before anyone relies on
it) the Changes drawer diffs stylesheet edits but not class-attribute edits — so even locally,
class tweaks leave no artefact. Local Overrides persists, but to a folder on Jamie's Mac,
against *built* assets, and still is not shareable.

**DevTools Workspaces writing to real files.** Readymade and produces a genuine diff, but needs
the repo checked out on the same machine as the browser, and the bot lives on the Pi. Would
require a spike before it could be costed; parked, not dismissed.

**StackBlitz / CodeSandbox fork of a branch.** Readymade, shareable, live HMR — but Jamie would
be editing source, which is the thing he explicitly wants to avoid, and it is unverified
whether wrangler/Workers runs in a WebContainer.

**CodePen-style editors.** Host a snippet, not a Vite + Workers app. Not applicable.

## Architecture

```
Pi: vite dev (full Tailwind build)  ──serves──▶  Jamie's phone/laptop
        ▲                                             │
        │                                    edit-mode overlay
        │                                             │ POST patch set
        └── .edit-sessions/<ts>.json ◀── dev-server middleware
                    │
                    │ Jamie taps /fold in the Telegram group
                    ▼
            clumeral dev bot ──▶ locates in source, normalises,
                                  runs tests, opens PR, replies with preview URL
                                                          │
                                                          ▼
                                            Dave + Jamie view the preview
```

Five units, each independently testable:

| Unit | Purpose | Depends on |
|---|---|---|
| **Full-Tailwind dev build** | make every scale class available in the browser, unminified | Tailwind v4 `@theme` |
| **Class catalogue** | enumerate the valid classes the search box offers | the same `@theme` tokens |
| **Edit-mode overlay** | select an element, change its classes, record a patch | catalogue |
| **Session middleware** | receive the patch set, write it to the working tree | — |
| **`/fold` command** | bot reads the session, edits source, opens a PR | pi-dev-bot |

## Unit 1 — full-Tailwind dev build

Tailwind v4 compiles only the classes it finds in source. Adding `mt-7` in the browser does
nothing if no file uses `mt-7`. Edit mode therefore needs a complete build of the project's
scale loaded alongside the normal stylesheet.

**Settled by measurement, 2026-08-18** — see
`docs/superpowers/notes/2026-08-18-tailwind-full-build-spike.md`. The route is a dev-only
stylesheet that imports the real one and points a single `@source` at a class list generated
from Tailwind's own design system (`__unstable__loadDesignSystem().getClassList()`), so the
list cannot drift from `@theme`. Two undocumented behaviours it relies on were tested, not
read: `@source` accepts a single file, and an explicit `@source` is scanned even when the
file is gitignored. The design's fallback (a hand-built token cross-product) is not needed.
Production was proved unaffected — same content hash, same 50,555 bytes.

### The variant decision — hybrid, Jamie 2026-08-18

The generated list is base utilities only: 23,031 classes, a 5.24 MB unminified dev
stylesheet. Variants multiply it — three of them across everything reaches 24.6 MB, and all
88 is not worth costing. Neither pre-building a guessed shortlist nor rebuilding for every
class is right, so:

- **Pre-build the cheap families** — spacing, sizing, radius, text size. These are what the
  `-`/`+` steppers walk, and steppers must stay instant.
- **Build on demand for the expensive tail** — colour x shade x opacity, and every variant.
  The overlay appends the picked class to the generated list and the dev server rebuilds
  (measured: 0.32 s after a source edit, 1.93 s after a stylesheet edit). One beat of lag the
  first time a class is used, and no shortlist to maintain or outgrow.

The on-demand half needs no new plumbing: it is the same dev-server middleware as Unit 4.
Planning must settle where the pre-built/on-demand line falls and confirm the pre-built half
is small enough that the phone-parse risk below stops mattering.

**Two costs the spike measured that planning must carry:**

1. **Vite dev serves the stylesheet uncompressed** — over Tailscale to a phone that is the
   dominant cost, not the compile. A gzip middleware in the dev server is a few lines.
2. **Nobody has measured what a phone browser does with a six-figure line count of CSS.**
   Playwright is CI-only here, so the Pi could not answer it. Ten minutes for whoever next
   runs the browser suite; the hybrid split above is chosen partly so this cannot bite.

Same work also produces Unit 2, so the spike de-risked two units at once. Two Unit 2 findings
land with it: the six component classes are plain CSS and the design system does not know
them, so they are either listed by hand in the generator or converted to `@utility` in
`src/tailwind.css` (tidier, and a real source change, so it belongs in planning); and
`getVariants()` returns the 88 variants separately, so search can compose a variant with a
utility without either list enumerating the product.

## Unit 2 — class catalogue

The set of classes offered by search. Generated from the `@theme` tokens crossed with the
utility families, **not** hand-maintained and **not** scraped from the compiled CSS (which
would contain only classes already in use — the opposite of what is needed).

Must also include the project's **component classes** (`.digit-box`, `.burger-btn`,
`.skip-link`, `.toast-msg`, `.warn`, `.recurring`), because elements using them cannot be
retuned with utilities alone. An edit to one of those is a signal to the bot that the change
belongs in `src/tailwind.css`, not in a class attribute.

### Search behaviour

- **Prefix match**, so `t-7` cannot reach `mt-7`. Deliberate: it keeps result sets small and
  predictable.
- **Match the segment after the last `:`**, so `mt` finds `md:mt-4` and `dark:mt-4`. The chip
  displays the variant prefix.
- **Strip a leading `-` when matching**, so `mt` finds `-mt-4`.
- **Group by family and cap results.** `mt` yields ~15 and is fine; `bg` and `text` yield
  thousands across colour × shade × opacity, and are unusable without grouping.

### No arbitrary values

`mt-[13px]` and friends are not offered and cannot be typed. **Decided deliberately:** hitting
the edge of the scale is information, not an obstacle. When the scale has no right answer,
Jamie says so in words and the bot decides whether the token set should change. This also means
search never has to produce a value it cannot enumerate.

## Unit 3 — edit-mode overlay

Loaded only in dev/preprod builds (see Safety).

### Mode toggle

A floating pencil button, bottom-right, toggles **play mode** ⇄ **edit mode**. In edit mode all
pointer events are intercepted at the document level in the capture phase, so no tap reaches
the game. This is load-bearing: Clumeral is a game, and taps are gameplay. Flipping back to
play mode restores normal behaviour so a change can be tested in use.

### Selection, including nested and same-size elements

A tap selects the topmost element under the point — which is usually the innermost, leaving
wrappers that share their child's exact box unreachable. Two mechanisms fix this, both borrowed
from DevTools:

- **Breadcrumb.** `main › .card › .row › button`, horizontally scrollable. Tapping a crumb
  selects that ancestor. Any wrapper is one tap away regardless of its box.
- **Nav arrows.** ↑ parent, ↓ first child, ← → siblings. Thumb-sized, for stepping between
  elements whose boxes are visually identical.

The selected element gets an outline plus a label showing its tag **and its source location**.
Two elements with pixel-identical boxes are told apart by where they came from, not by their
highlight.

### Panel — phone

Collapsible bottom sheet:

1. breadcrumb row
2. nav arrows row
3. **class chips** — tap a chip to remove it; `+` opens search
4. **steppers** — `−`/`+` walk the Tailwind scale for spacing, size, radius, text size
5. footer — undo · reset element · **Done**

**Search and steppers do different jobs and both are needed.** Search answers *which utility*
(`flex`, `items-center`, `rounded-lg`); steppers answer *how much* (`mt-4` → `mt-5`). Keeping
them separate is why search does not have to enumerate every step of every scale.

**When search is focused the sheet collapses to search + results only** and the selected
element is scrolled into view above it. Without this the on-screen keyboard covers the very
element being edited.

### Panel — desktop

Same panel docked right, plus a raw class field and a free-CSS box, for when it is easier to
think in `margin-top: 1rem` and let the bot convert.

### Replace, do not append

If an element has `mt-4` and `mt-6` is added, both land in the class list and the winner is
decided by CSS order, not class order — so the tap appears to do nothing. **The overlay
replaces same-family classes rather than appending**, driven by a family map. The map must also
settle the cross-family cases (what happens to `p-4` when `px-4` is added). This is the single
most likely source of silent wrongness in the overlay and needs positive tests: assert the
*failing* case, i.e. that appending would have produced a no-op.

### JS-controlled classes

Some classes are set at runtime by theme or game state (`theme.ts` toggles `.dark`; several
modules toggle `.hidden`). An edit to one of those can be overwritten on the next render, and
its fold-back target is a conditional rather than a literal. **The overlay detects that the
class list changed after an edit and flags it in the patch**, rather than silently losing the
change.

## Unit 4 — session transport

**Done** POSTs the patch set to a middleware in the Pi's Vite dev server, which writes
`.edit-sessions/<timestamp>.json` in the game working tree. Jamie then taps **`/fold`** in the
Telegram group and the bot picks it up as an ordinary turn.

Chosen over having the browser message Telegram directly: one tap either way, no new trigger
plumbing, and the bot's token stays on the Pi and never goes near a browser.

Each patch entry carries:

- the element's breadcrumb
- its tag and visible text
- its **full before and after class list**
- any flag raised by the JS-controlled-classes check

Not a screenshot, not computed CSS.

`.edit-sessions/` is gitignored.

## Unit 5 — `/fold`

### Locating the element in source

**No build-time source stamping.** An earlier version of this design had a Vite plugin
stamping `data-src="grid.ts:42"` on every element, which means parsing HTML out of TS template
literals — the most fragile component in the whole design. It was dropped in favour of the
observation that the bot is an LLM with the repo in front of it: *a `<button>` reading "Submit"
with classes `rounded-lg bg-bg px-4 mt-4`, inside `.card`* is almost always uniquely
greppable.

So: **the bot greps the before-class-string and disambiguates by reading, and asks in the group
when genuinely ambiguous.** If real use shows ambiguity is common, the stamping plugin is a
clean later addition, not a rewrite.

### What the bot does

1. Locate each edited element in source.
2. Apply the change — and **normalise it to house conventions**: logical properties over
   physical, theme tokens over one-off values, component class over a utility pile where that
   is what the codebase does.
3. Run tests and lint.
4. Open a PR against `staging`.
5. Reply in the group with the preview URL.

**Jamie's edit is the intent; the bot's commit is the implementation.** The overlay does not
have to produce code anyone would want to keep — that is the entire point of the round-trip,
and it is why "no arbitrary values" costs nothing.

## Safety

**Edit mode must be physically absent from production builds.** The overlay, the middleware and
the full-Tailwind stylesheet are gated to dev/preprod. A test asserts the production bundle
contains no overlay code — an assertion about the built artefact, not about a config flag.

The dev server binds on the Pi and is reached over Tailscale, or a cloudflared tunnel if a
public link is wanted. It is never exposed to the internet unauthenticated: it accepts POSTs
that write files into the working tree.

## Testing

- **Unit 2:** catalogue contains every `@theme` spacing step and every component class; search
  finds `md:mt-4` from `mt`, finds `-mt-4` from `mt`, and does *not* find `mt-7` from `t-7`.
- **Unit 3:** family-map replacement — assert that appending `mt-6` to `mt-4` would produce a
  no-op, and that the overlay does not do it. Breadcrumb reaches a same-box wrapper. Play mode
  restores gameplay after edit mode intercepted taps.
- **Unit 4:** a patch round-trips to JSON and back without losing the before-class list.
- **Unit 5:** grep-location succeeds on a unique class string and *asks* rather than guessing on
  a duplicated one.
- **Safety:** production bundle contains no overlay code, **and no edit-mode-only utility**.
  The spike showed the production gate is thinner than it looks — it holds only because
  nothing imports the edit entry, so the moment dev points at that entry the gate becomes
  "the swap only happens in dev". Assert against the built CSS, not a config flag.

Per the project's own hard-won rule: revert each fix and watch the test go red. A green suite
that passes without the fix pins nothing.

## Open questions to settle during planning

1. ~~Exactly how a complete Tailwind v4 build is produced for dev (Unit 1 spike).~~ **Closed
   2026-08-18 by measurement** — see Unit 1 above and the spike note. Left open by it, for
   planning: where the pre-built/on-demand line falls, and the phone-parse measurement.
2. The cross-family rules in the replace map (`p-4` vs `px-4`, and `text-sm` vs `text-text` — the same `text-` prefix covers size and colour).
3. Whether Dave should ever be able to *view* an uncommitted edit session, or only the PR
   preview. Currently: only the PR preview.
