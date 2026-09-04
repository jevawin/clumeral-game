# Edit-mode round-trip — plan

**Date:** 2026-08-19
**Branch:** `dev/edit-mode-roundtrip`
**Brief:** `docs/work/2026-08-18-edit-mode-roundtrip-brief.md` (closed 2026-08-19, item 116)
**Design:** `docs/superpowers/specs/2026-08-16-edit-mode-roundtrip-design.md`
**Spike:** `docs/superpowers/notes/2026-08-18-tailwind-full-build-spike.md`
**Scope:** Units 1-4. Unit 5 (`/fold`) is `pi-dev-bot`'s and is not planned here.
**Revision:** 5 — A3 answered 2026-08-21 (the full set is fine); scope and dead code updated.
Revision 4 — approved by Jamie 2026-08-19 with two conditions, both answered (D1, D6b).
Revision 2 was the `da-plan` review of 2026-08-19 (7 High, 10 Medium, 7 Low — all
Medium-and-above fixed; see [Review fixes](#review-fixes) for what changed and why).

This plan settles **how**. It does not reopen any product decision. Choices the brief left to
planning are in [Decisions](#decisions). Departures from the brief and additions to a published
contract are in [Flagged to Jamie](#flagged-to-jamie).

Every mechanism below that the plan calls load-bearing was **run on this Pi before it was
written down**. Where a number appears, it was measured on 2026-08-19 against this tree.

---

## What the plan inherits, unarguable

From brief item 116:

- Units 1-4, **dev server only**. Nothing reaches production or preprod (items 6, 7).
- ~~Pre-built **non-colour** stylesheet~~ — **superseded by A3, 2026-08-21.** The stylesheet is
  the full set, all 23,031 classes. **No on-demand rebuild half, and no follow-up brief** —
  item 114's condition never fired.
- ~~No colours offered.~~ **Colours are offered** (A3). **Variants are still not** — they are in
  no built set, and brief item 98 is why offering one would look broken. Anything outside the
  built set is caught and reported, never silent (item 99).
- The session file schema (items 93-96) is a **contract with `pi-dev-bot`** and is not
  paraphrased.
- `/fold` renames a consumed session to `*.json.folded`; the game reads only bare `*.json`
  (item 92).
- The safety assertion is *"every class in the built stylesheet appears in `src/` or
  `index.html`"* — no sentinel — and **lands red until #312 is fixed** (items 101, 102).
- Simplicity is the tie-break (item 82). Jamie is the tester (items 89, 90).

---

## Sequencing — why the order is what it is

Jamie's instruction, 2026-08-19: *the pre-built stylesheet has to reach the iPhone as early as
possible, because it is the measurement that decides whether the on-demand half gets built at
all. Sequence it so that lands before anything that depends on the answer.*

**Stage A is three tasks and ends at the gate.** Nothing before it depends on the overlay, the
catalogue, the panel or the middleware.

What the answer changes downstream:

| iPhone verdict | consequence |
|---|---|
| non-colour set (1.16 MiB) is comfortable | build as planned — Stage B catalogue is the non-colour set |
| **the full set (4.99 MiB) is also comfortable** | **← this is what happened.** Catalogue becomes "everything" (brief item 46), colours are offered, and the follow-up brief for the on-demand half is never needed |
| non-colour set struggles | Stage B narrows to the four stepper families (0.43 MiB, brief item 44), and the on-demand half gets its own brief |

**Answered 2026-08-21: the middle row.** See task A3 for the result, what kind of evidence it
is, and the four consequences.

Task A2 shipped both sets so the whole question could be answered in one sitting. With the
answer in, there is one stylesheet and it is the full set.

---

## Measured on the Pi, 2026-08-19

| set | classes | unminified | gzipped |
|---|---|---|---|
| non-colour (this plan's default) | **8,397** | **1,212,459 bytes (1.16 MiB), 33,702 lines** | **72 kB** |
| everything (spike) | 23,031 | 5,244,578 bytes (5.24 MB) | 193 kB |

8,397 reproduces brief item 44 exactly, which confirms Task A2's filter is the one that produced
the brief's table.

**Gzip changes the shape of the question.** Once the spike's cost 1 is fixed (Task A2), even the
*full* set is 193 kB on the wire. Transfer is no longer what is being measured — parse and
style-recalc on the phone is, and that is the only unknown left.

---

## Module layout

```
edit-mode/                        Node. Imported ONLY by vite.config.ts.
  plugin.ts                       the Vite plugin (apply: 'serve')
  classlist.ts                    design-system class list, colour predicate, family map
  session-write.ts                POST handler -> .edit-sessions/<ts>.json
  session-read.ts                 GET handler -> unconsumed sessions, timestamp order
  readonly-proxy.ts               the second port (GET/HEAD only)
  gzip.ts                         compression for the dev stylesheets
  html.ts                         the index.html rewrite, as a pure function

src/edit-mode/                    Browser. Imported by NOTHING in the game.
  overlay.ts                      entry — the only file the injected <script> names
  panel.ts                        shadow-root UI (hand-written CSS, item 65)
  select.ts                       selection, breadcrumb, nav arrows
  families.ts                     collision rules over the generated family map (pure)
  catalogue.ts                    catalogue + search (pure)
  patches.ts                      patch model + session JSON (pure)
  project.ts                      patch set -> DOM. Shared by editing and by replay.
  history.ts                      back ownership + undo (pure core)
  session-store.ts                sessionStorage persistence

src/tailwind-edit.css             dev-only entry — every class (A3)
.edit-mode/classes/classlist.txt  generated, gitignored, ALONE in its directory
.edit-mode/families.json          generated, gitignored
.edit-sessions/                   generated, gitignored
```

Two directories because one half runs in Node and one in a browser, and keeping them apart
means `src/edit-mode/` can be `@source not`-excluded as a single unit without also excluding
build tooling. (The earlier revision justified the split on `tsconfig.json`; the review showed
that reasoning was wrong — TypeScript follows the import graph and `@types/node` is already
present. The split stands on the exclusion argument, which is real.)

**Nothing in `src/` imports `src/edit-mode/`.** That is brief item 60's guarantee: no dev-only
condition for a bundler to strip, because the game never names edit mode. `vite build` starts
from `index.html` and reaches neither directory.

---

## Decisions

### D1 — the colour predicate

Brief item 43 said colour utilities are identified by *"carrying opacity modifiers"*. Tested,
that needs one word added. `getClassList()` returns `[name, { modifiers }]`:

```
text-sm        modifiers: ["tight","snug","normal","relaxed","loose"]   <- line heights
text-text      modifiers: ["0","5","10", ... ,"100"]                    <- opacity
border-2       modifiers: []
border-accent  modifiers: ["0","5", ... ,"100"]
```

The predicate is **"has modifiers, and every modifier is numeric"** — not "has modifiers". With
that word it reproduces 8,397 exactly.

**What this predicate is now for, after A3.** It no longer filters the stylesheet — edit mode
offers every class, so nothing is filtered. It survives because **the family map needs it**
(D2): telling `text-sm` from `text-accent`, and `border-2` from `border-accent`, is what stops
picking a colour from silently deleting a font size.

The named-scale shadow exemption that revision 4 costed at 3,188 bytes is **deleted**. It
existed to rescue `shadow-box` and friends from the non-colour filter; with no filter there is
nothing to rescue. Recorded rather than quietly dropped, because the measurement was asked for
and answered: it was the right call on the evidence available at the time, and A3 made the
question disappear rather than settling it the other way.

For the record, the classification itself is unchanged and still correct — shadows do carry an
opacity modifier and do classify as colour:

```
shadow-box COLOUR   shadow-box-active COLOUR   shadow-key COLOUR
shadow-lg  COLOUR   shadow-md COLOUR   shadow-sm COLOUR   shadow-none non-colour
```

That matters for the family map, where `shadow-lg` and `shadow-box` both declare `box-shadow`
and so replace one another, exactly as two margin steps do.

### D2 — the family map is derived from CSS properties, not from prefixes

Brief item 38 calls the family map *"the single most likely source of silent wrongness"*, and
the review was right that revision 1 left it as one undefined sentence. Tailwind's own data
cannot supply it: `ClassMetadata` is `{ modifiers: string[] }` and nothing more. And the
obvious prefix rule is **wrong** — `text-sm`, `text-center` and `text-2xl` are all non-colour
with prefix `text`, so a prefix map would delete a font size when you centre text.

**A utility's family is the set of CSS properties it declares.** Two classes collide when their
property sets are *exactly equal*; anything else coexists. The map is built by compiling the
class list once — the same compile the stylesheet already does — and parsing each rule's
declarations, dropping Tailwind's internal `--tw-*` custom properties.

Run on this tree, 2026-08-19:

```
mt-4            margin-top                    p-4             padding
mt-6            margin-top                    px-6            padding-inline
px-4            padding-inline                py-2            padding-block
text-sm         font-size,line-height         text-center     text-align
text-2xl        font-size,line-height         text-accent     color
border-2        border-style,border-width     border-solid    border-style
border-accent   border-color                  rounded-lg      border-radius
w-96            width                         h-96            height
```

Every case the brief and the review raised falls out correctly and without a hand-written list:

- `mt-4` + `mt-6` → equal → **replace** (item 38).
- `p-4` + `px-6` → `padding` vs `padding-inline` → **coexist**, which is item 40's ruling, now
  derived rather than special-cased.
- `px-4` + `px-6` → equal → **replace** — the genuine same-family collision item 40 kept.
- `text-sm` + `text-center` + `text-accent` → three different sets → **coexist**. The prefix
  rule would have destroyed the font size.
- `border-2` + `border-solid` + `border-accent` → three different sets → **coexist** (item 43).

Exact-equality is deliberately strict: `border-2` is a *superset* of `border-solid`, and under
a subset rule adding one would eat the other. Under equality both stay, CSS order settles
`border-style` to the same value either way, and nothing is lost. Item 42's principle — record
what Jamie did, do not be clever on his behalf — points the same way.

The map is generated, gitignored and served with the catalogue, so it cannot drift from the
stylesheet it describes.

### D3 — the session filename format

Item 93 specifies `.edit-sessions/<timestamp>.json` and item 51 requires replay in timestamp
order, but nothing states the format. `/fold` is being written now and has to glob and sort
these, so the plan fixes it:

```
.edit-sessions/2026-08-19T22-41-07-221Z.json
```

`createdAt` with `:` and `.` replaced by `-`. Sorts lexicographically (therefore
chronologically), safe on any filesystem, needs no parsing to order. This **adds to the
published contract; it changes no field.** Flagged below.

### D4 — the patch set is the truth; the DOM is a projection

Item 67 asks planning to establish how back is guaranteed not to let the router re-render and
wipe edits, given `src/router.ts:199` registers its `popstate` listener at boot.

Registration order cannot be the guarantee. `popstate` is dispatched **on `window`**, and for
listeners on the event target itself the DOM spec runs capture and bubble listeners in
registration order — so `{capture: true}` buys nothing and `stopImmediatePropagation()` only
stops listeners registered after ours.

Three things together, and no one of them is relied on alone:

1. **Every entry is pushed at the current URL.** `history.pushState({ clumeralEdit: n }, '',
   location.href)`. So even if the router does run, `resolveRoute(location.pathname, ctx())`
   resolves the screen already on display — a re-render of the same screen, never a navigation
   to a different one. (Revision 1 never said what pushed the entries or what URL they carried;
   the review was right that this was the hole.)
2. **`project.ts` can rebuild the edited DOM from the patch set at any moment.** Back pops one
   entry and re-projects. If the router re-rendered, re-projection puts the remaining edits
   back; if it did not, re-projection is a no-op. Correctness stops depending on listener order.
3. **The overlay is injected ahead of the app entry** so it registers first and the re-render
   does not happen in practice — which keeps Jamie's manual check (item 90.1, "the screen does
   not reload") honest rather than merely survivable.

Point 2 costs nothing extra: it is the same code Dave's replay needs (item 21). One mechanism,
two users.

### D5 — the read-only port, and how the overlay knows which origin it is on

Item 26 settles the mechanism; item 103 says that origin serves the overlay in replay-only mode.
The proxy refuses anything that is not GET or HEAD with a 405, and rewrites the injected overlay
tag to carry `data-edit-mode="replay"`. The overlay reads it and never builds the panel.

The mode comes from **which listener served the page**, not from a header, so nothing Dave's
browser can send changes it. That closes item 25's trap: `cloudflared` making Dave's traffic look
local cannot matter, because the tunnel port has no write handler to reach. If the dev server is
down the proxy answers 503 rather than failing to start (item 107).

### D6 — why `src/tailwind.css` gets three lines

This is the one place the plan touches an existing file, and item 55 says not to.

Tailwind v4 scans everything git does not ignore. That is issue #312, and it is why `mt-7` and
`row-7447` are in the production stylesheet today. **Edit-mode source and its tests will contain
class-name literals** — a family-map test asserting `mt-4` against `mt-6`, for instance — and
every one would land in production CSS. Item 12 says this work must not make #312 worse. Without
an exclusion it makes it worse by design.

I hit this by accident while measuring, which is the cleanest possible demonstration: a
generated class list left in the working tree un-gitignored took the production stylesheet from
**51,218 bytes to 1,412,751** in a single `npm run build`. That is item 59's stated failure mode,
observed.

So `src/tailwind.css` gains exactly three lines, in **Task A1, before any class literal is
committed**:

```css
@source not "./edit-mode";
@source not "../edit-mode";
@source not "../tests";
```

`@source not` only ever **removes** rules, so it cannot break the shipped app by adding
something. Tested: excluding `docs/` and `tests/` drops 26 selectors and 2,459 bytes, and every
one is absent from `src/` and `index.html` — they exist solely because a document mentions them.
(`shadow-key` looks like a false positive but is not: it appears in `src/` only as the token name
`--shadow-key`, never as a class.)

**The spike's own fix is deliberately not taken.** Spike note line 214 suggests narrowing the
whole scan to `@source "./src"` plus `index.html` — one line, no exclusion list, and it would
close #312 outright. Item 82 makes simplicity the tie-break, so it deserves an answer rather
than silence: it is rejected here because it is #312's fix, item 12 puts #312 out of scope, and
the spike itself says it "would want its own check that nothing real gets dropped" — a check
this branch is not scoped to build. Three narrow exclusions are the minimum that satisfies item
12 without doing #312's job badly.

### D6b — this branch and #312 both narrow the same file: who lands first, and what survives

Jamie's condition, 2026-08-19: *say which lands first and how the second avoids undoing it. If
#312 lands first, re-check whether the three lines are still needed at all.*

**This branch lands first.** Issue #312 is open and unstarted — no branch, no work in progress —
and this plan is approved and about to be built. So the three `@source not` lines go in first,
and #312 is the one that has to be careful.

**How #312 would undo it, precisely.** #312's fix (the spike's suggestion, spike note line 214)
is to stop scanning the whole repo and name the real sources instead. Tested on this tree by
building it:

```css
@import "tailwindcss/utilities" layer(utilities) source(none);
@source "../src";
@source "../index.html";
@source not "../src/edit-mode";
```

| class | lives in | in production CSS? |
|---|---|---|
| `mt-9` | `src/probe-real.ts` | **yes** — real source still scanned |
| `mt-11`, `mt-13` | `src/edit-mode/probe.ts` | **no** — the exclusion survives the narrowing |
| `mt-7`, `row-7447` | prose in `docs/` | **no** — #312 closed |

Production CSS goes from 51,218 to **36,750 bytes**, a 14.5 kB saving.

Two things that answers:

1. **`@source not` composes with `source(none)` narrowing.** Tested, not assumed — the
   edit-mode classes stay out with both mechanisms in the same file.
2. **The danger is specific and worth naming in #312's own issue:** narrowing to `@source
   "../src"` puts `src/edit-mode/` back *inside* the scanned set. Without the exclusion line,
   #312 would silently re-admit every class literal in the overlay. It is the exact opposite of
   what #312 is for, and nothing would say so.

**So, for whoever writes #312:**

- **Keep `@source not "./edit-mode"`.** It is load-bearing under the narrowing, not redundant
  with it.
- **Delete the other two** — `@source not "../edit-mode"` and `@source not "../tests"`. Both
  directories sit outside `../src`, so the narrowing excludes them on its own and the lines
  become dead weight.
- Task A4's leak gate is what catches a mistake here: it goes red if any edit-mode class
  literal reaches the built CSS, whichever mechanism let it in.

**And had #312 landed first?** One of the three lines would still be needed —
`@source not "./edit-mode"` — for the reason above. The other two would never have been written.
That is recorded so the answer does not change depending on who reads it.

### D7 — the safety assertions, and honouring item 102 literally

Item 101 wants *"every class selector in the built stylesheet appears literally in `src/` or
`index.html`"*, and item 102 says it **lands red** until #312 is fixed.

Revision 1 tried to make that green with an allowlist of docs-only classes. The review killed
it, correctly and on two counts: the allowlist is far larger than the 26 figure suggested
(measured against `src/` and `index.html`, well over a hundred selectors need escaping-aware
matching before the real count is even knowable), its sources include `.planning/` as well as
`docs/`, and — the deciding one — **making it green overrides a closed brief item without
saying so.** Item 102 chose red deliberately.

So the plan does what item 102 says, and splits the two jobs that revision 1 had conflated:

**The gate that runs — a targeted, exact, green-today leak assertion.** Collect every
class-shaped token in `src/edit-mode/`, `edit-mode/` and `tests/edit-mode-*.spec.ts`. None may
appear as a selector in the built CSS unless it also appears elsewhere in `src/` or
`index.html`. This is precisely "edit mode did not leak", it is green on this tree, it goes red
the moment the `@source not` lines are removed or a new leak appears, and it does not wait on
#312.

**Item 101's general assertion — written, committed, and `describe.skip`ped** with the exact
reason, the issue number and the current failing count in the skip message. It is not a gate
today, and #312's branch turns it on by deleting one word. That is item 102's "lands red and is
the first thing #312's branch turns green", expressed in a way that does not block every pull
request in the meantime.

### D8 — asserting against preprod, now that the real commands are known

Jamie's instruction: *assert against every deployed artefact, preprod included, and against
built output rather than a config flag.*

Jamie supplied the Cloudflare commands on 2026-08-19, which closes the question revision 2 had
to leave open. Production builds with `npm install && npm run build`. **Pre-prod's version step
builds with `CLOUDFLARE_ENV=preprod npm run build`**, then applies the preprod migrations and
uploads a version.

So **preprod is not the same command.** `CLOUDFLARE_ENV=preprod` is a real input that
`@cloudflare/vite-plugin` reads. That kills the review's H1 objection — the comparison is no
longer a tautology, because there is now something that could genuinely make the two artefacts
differ. It also shows revision 1 was pulling the wrong lever: `--mode preprod` was never how
this repo selects an environment.

**Both builds were run on this Pi, 2026-08-19, and diffed.** What `CLOUDFLARE_ENV=preprod`
changes, in full:

| artefact | differs? |
|---|---|
| `dist/client/assets/**` (the CSS and JS) | **byte-identical** |
| `dist/clumeral_game/index.js` (the Worker code) | **byte-identical** |
| `dist/client/sw.js` | one line — `CACHE_NAME`, which is `Date.now()` from `vite.config.ts`, not the environment |
| `dist/clumeral_game/wrangler.json` | **the only real difference** — `ENVIRONMENT`, the two D1 database ids, and `triggers.crons` emptied |

It changes bindings and vars. It changes **no code and no stylesheet**. That is the answer that
matters here: the client CSS and JS are the only places the overlay, the middleware or an
edit-mode utility could hide, and they are provably the same file in both environments.

So the assertion is genuinely two builds, and it is implementable:

- CI runs `npm run build`, snapshots `dist/` aside, then runs `npm run build:preprod` — added to
  `package.json` as `CLOUDFLARE_ENV=preprod npm run build` so it matches Cloudflare's own
  command exactly and cannot drift from it.
- The spec reads both directories from disk rather than shelling out to build, so it stays a
  fast unit test in the `sw-precache.spec.ts` mould, and skips loudly if either is absent.
- **Every absence assertion runs against both.** So the answer to the instruction is literal:
  the overlay, the middleware, the edit-mode stylesheet and the edit-mode-only utilities are
  asserted gone from the production artefact *and* the preprod artefact, from built output,
  never from a config flag.
- Plus a parity assertion: client assets and Worker code byte-identical across the two, `sw.js`
  compared ignoring the `CACHE_NAME` line, `wrangler.json` excluded by name as the one file the
  environment legitimately changes. If anyone ever makes `CLOUDFLARE_ENV` change emitted code,
  that goes red and says so.

Cost: one extra full build in the gate, roughly 40 seconds.

Noted in passing, not acted on: preprod's `wrangler.json` carries `triggers.crons: []`, which
independently confirms CLAUDE.md's claim that pre-prod versions never run `scheduled()` and so
cannot write to the shared `PUZZLES` namespace.

### D9 — the assertions have to actually run

`npm test` runs on a clean checkout in `ci-smoke.yml`, before Playwright builds anything. So
every build-output assertion in the repo currently **skips** in CI — including
`tests/sw-precache.spec.ts`, which has been silently skipping since it was written.

The plan adds a build step to `ci-smoke.yml` before `npm test`. Verified: with `dist/` present,
all 37 files and 751 tests pass and `sw-precache.spec.ts` runs its 5 assertions for real. Fixes
an existing hole as a side effect, at the cost of one build in the gate.

### D10 — the dev server has to be reachable from the phone

`npm run dev` is bare `vite dev` and `vite.config.ts` sets no `server.host`, so Vite binds to
localhost and **Jamie's phone cannot reach the Pi over Tailscale at all**. The A3 gate is the
whole point of the sequencing and it could not have been run. `preview` already carries
`--host`; `dev` does not. Task A2 adds `server.host: true` in the plugin's `config` hook, so it
applies in serve mode only and no committed script changes.

---

## Flagged to Jamie

1. ~~No shadows in edit mode.~~ ~~Costed and exempted 2026-08-19.~~ **Moot as of A3,
   2026-08-21** — you called it. Every shadow is offered because every class is offered, so
   there is no exemption list to maintain and the 3,188-byte question never arises. The
   exemption code is deleted.
2. **`src/tailwind.css` gets three `@source not` lines**, against item 55. Reason in D6: without
   it, edit mode's own test files ship their class literals to the production stylesheet, which
   item 12 forbids. `@source not` can only remove rules, and the selectors it removes on this
   tree are used nowhere in the app.
   **Ordering against #312, as asked (D6b):** this branch lands first — #312 is open and
   unstarted. When #312 narrows the scan it must **keep** `@source not "./edit-mode"`, because
   narrowing to `../src` would otherwise put the overlay's own class literals back in scope; the
   other two lines become redundant and should be deleted then. Tested by building it: the
   exclusion survives the narrowing, and production CSS drops to 36,750 bytes.
3. **The session filename format is now fixed** at `2026-08-19T22-41-07-221Z.json` (D3). **No
   field in items 93-96 changes** — this adds the naming rule the contract was missing, and
   `/fold` needs it to sort.
4. **CI gains a build step** so the safety assertions run at all (D9). About 40 seconds.
5. **Answered 2026-08-19, and it was not the same command.** Preprod runs
   `CLOUDFLARE_ENV=preprod npm run build`. I built both and diffed them: it changes bindings and
   vars only, and the client CSS and JS come out byte-identical, so nothing about the plan's
   shape changes. But the safety test now genuinely builds twice and asserts against both
   artefacts, which is what was asked for and what revision 2 could not honestly promise. D8.

---

## Tasks

One commit each, tests first. Brief item numbers in brackets. Every test is reverted and watched
go red before it counts (item 86).

### Stage A — the stylesheet, and the measurement

**A1 — ignore the generated paths, and close the leak before anything can use it.** [108, 59, 12]
- Modify `.gitignore`: `.edit-mode/`, `.edit-sessions/`.
- Modify `src/tailwind.css`: the three `@source not` lines (D6).
- Test `tests/edit-mode-paths.spec.ts`: `git check-ignore -q` succeeds for
  `.edit-mode/classlist.txt` and `.edit-sessions/x.json` — the property git enforces, not the
  text of the file.
- **Why this is first, ahead of the gate:** A2 commits files full of class literals (`mt-11`,
  `-mt-96`, `bg-accent`). Without the exclusions already in place, every one lands in the
  production stylesheet on the A2 commit, which is what item 12 forbids. Free to order this way,
  and it delays the gate by nothing.

**A2 — the class list, the family map, and the dev stylesheets.** [44, 43, 38, 99, 110, 106]
- Create `edit-mode/classlist.ts`:
  - `loadDesignSystem()` — the call, verified working on this tree:
    ```js
    const ds = await __unstable__loadDesignSystem(
      readFileSync('src/tailwind.css', 'utf8'), { base: process.cwd() })
    ```
    It is **async**, and it needs `base` — without it the call throws. (Revision 1 gave it
    neither; the review caught it.)
  - `isColourUtility([name, meta])` — `modifiers.length > 0 && every(/^\d+$/)` (D1).
  - `buildFamilyMap(classes)` — compile once, parse each rule's declarations, drop `--tw-*`,
    return `class -> sorted property list` (D2).
  - `COMPONENT_CLASSES` — the six, hand-listed here rather than converted to `@utility`
    (item 110): `digit-box`, `burger-btn`, `skip-link`, `toast-msg`, `warn`, `recurring`.
  - `writeArtefacts()` — writes the class list and `families.json` into
    `.edit-mode/` on dev-server start.
- Create `src/tailwind-edit.css` — and, for the A3 gate only, `src/tailwind-edit-all.css`
  (**deleted after A3**, see below). Three lines each: the import,
  one `@source` at the matching list, and a comment recording that the spike proved an explicit
  `@source` is scanned even when the file is gitignored.
  **Two entries rather than one mutating query flag** (revision 1's `?edit-classes=all`): the
  flag regenerated a `@source` file at request time, with no ordering guarantee between the HTML
  response and the CSS request that followed, so Jamie could have compared the same set against
  itself and never known. Two static entries have no server state and cannot race.
- Create `edit-mode/gzip.ts` — gzip for both stylesheets. Spike cost 1; 1.16 MiB → 72 kB.
- Create `edit-mode/html.ts` — `rewriteIndexHtml(html, opts)`, pure. **At this task it swaps the
  stylesheet link only.** The overlay `<script>` tag is not injected until C3, because until then
  `src/edit-mode/overlay.ts` does not exist and every page load at the gate would 404 and log a
  module error. (Revision 1 injected it in A2; the review caught it.)
- Create `edit-mode/plugin.ts` — `editMode()`, `apply: 'serve'`, with `config` (sets
  `server.host: true`, D10), `configureServer` and `transformIndexHtml`.
- Modify `vite.config.ts` — add `editMode()` to `plugins`.
- Tests `tests/edit-mode-classlist.spec.ts`:
  - `text-sm` is not a colour; `text-text` is. `border-2` is not; `border-accent` is. [43]
  - `shadow-box` **is** classified colour — pinned deliberately, so a future change to the
    predicate has to argue with this line (D1).
  - the non-colour set contains `mt-11`, `-mt-96` and `mt-px`, and does not contain `bg-accent`.
  - the non-colour count is within 8,000-9,000 — a band, not `8397`, so a Tailwind patch release
    adding one utility does not turn the suite red for nothing.
  - the catalogue holds every `@theme` spacing step and all six component classes. [85]
- Tests `tests/edit-mode-families.spec.ts` — the D2 map, including the cases a prefix rule gets
  wrong: `mt-4`/`mt-6` equal; `px-4`/`px-6` equal; `p-4`/`px-6` different; **`text-sm`/`text-center`
  different**; **`border-2`/`border-solid` different**; `text-sm`/`text-accent` different. [38, 40, 43]
- Tests `tests/edit-mode-html.spec.ts`: the rewrite swaps the stylesheet link, injects **no**
  script at this stage, and leaves the committed `index.html` untouched. [56]

**A3 — GATE: Jamie measures on the iPhone 16 Pro.** [45, 46, 47, 87] — **ANSWERED 2026-08-21**

**The result: the full set is fine.** Jamie loaded the everything build — 23,031 classes,
5.25 MB — on an iPhone 16 Pro over the LAN, and it felt identical to the normal build:
scrolling, tapping, opening the menu, playing a puzzle.

**What kind of evidence that is, stated plainly because it matters.** It is a *subjective
on-device feel test*, not instrumented numbers. Nobody measured parse time, style-recalc or
memory. What makes it sufficient is not precision but margin: the question was "does this
choke", and the answer was "indistinguishable from normal". A marginal result would have needed
instrumenting; this one does not. Brief item 45 predicted exactly this and called it judgement
rather than measurement — the phone has now confirmed the judgement, on the same terms.

**Four consequences, Jamie 2026-08-21:**

1. **The catalogue is EVERYTHING**, not the non-colour set.
2. **Colours are offered**, which makes the named-scale shadow exemption moot. Dropped — the
   shadows are in because everything is in, not because of a special case.
3. **The on-demand rebuild half is not built and needs no follow-up brief.** Brief item 114's
   conditional never fires. The hybrid decision of 2026-08-18 is fully retired.
4. **The colour predicate survives, for a different job.** It no longer filters the stylesheet;
   it still tells `text-sm` from `text-accent` for the family map (D2), which is what stops
   picking a colour from deleting a font size.

**Dead scope, removed rather than left lying around:**

- `src/tailwind-edit-all.css` — deleted. One stylesheet now, and it is the full set.
- `SHADOW_EXEMPTIONS` and the exemption branch in `isColourUtility` — deleted.
- `classSetFromEnv`, the `EDIT_CLASS_SET` variable and the `dev:all` script — deleted. There is
  nothing left to choose between.
- The second generated class list. One list, in its own subdirectory.
- **The family map is now built over all 23,031 classes**, not the non-colour subset — it has
  to know `text-accent` declares `color` now that colours can be picked.

**Two things A2 learned the hard way, recorded so they are not rediscovered:**

- **An explicit `@source` at a file registers its whole DIRECTORY as a scan root.** With both
  class lists side by side, the non-colour stylesheet swept up the all-colours list next to it
  and compiled 5.24 MB where 1.16 MiB was intended. Found by serving it and measuring, not by
  reading the code. The generated list now sits alone in `.edit-mode/classes/`.
- **The query string never reaches the plugin.** `wrangler.jsonc` puts `/` in
  `run_worker_first`, so the Cloudflare Worker serves the page and rewrites the request on the
  way through. `?classes=all` was gone before `transformIndexHtml`, before a `use()`
  middleware, and before one unshifted to the front of the stack — verified at all three
  positions. Anything in this plan that wants per-request state on a page load has the same
  problem and needs a different mechanism.

**And one operational constraint, Jamie 2026-08-21:** **two `vite dev` servers cannot run in the
same working directory.** They share Miniflare's SQLite state and the second dies with "database
is locked". The pair that served A3 was luck, not design. If both sets ever need serving at once
that needs its own answer — a second checkout, most likely. Nothing in Stage B onwards needs it.

**A4 — the safety assertions.** [7, 59, 101, 102] + Jamie's instruction 2
- Test `tests/edit-mode-safety.spec.ts`, against **built output, never a config flag**:
  - **the leak gate (D7):** no class-shaped token from `src/edit-mode/`, `edit-mode/` or
    `tests/edit-mode-*.spec.ts` appears as a selector in the built CSS unless it also appears
    elsewhere in `src/` or `index.html`.
  - the built JS contains none of the overlay's user-visible strings — item 72's *"Nothing on
    the scale matches."* and item 71's *"Search classes"*. String literals survive minification;
    module paths and identifiers do not, which is why revision 1's "no `src/edit-mode/` marker"
    assertion would have passed even with the overlay bundled.
  - `dist/` contains no `tailwind-edit` asset and no `.edit-sessions` reference.
  - **every assertion above runs against both artefacts** — the production build and the
    `CLOUDFLARE_ENV=preprod` build (D8).
  - **preprod parity:** `dist/client/assets/**` and `dist/clumeral_game/index.js` are
    byte-identical across the two builds; `sw.js` matches ignoring the `CACHE_NAME` line;
    `wrangler.json` is excluded, being the one file the environment legitimately changes.
  - Skips with a loud message if either build directory is absent.
- Add the `package.json` script `build:preprod` — `CLOUDFLARE_ENV=preprod npm run build`, the
  same command Cloudflare's version step runs.
- Test `tests/css-leak.spec.ts` — item 101's general assertion, written in full and
  `describe.skip`ped, with #312, the reason and the current failing count in the skip message
  (D7). Not a gate today; one word turns it on.
- Modify `.github/workflows/ci-smoke.yml` — before `npm test`: `npm run build`, snapshot `dist/`
  aside, then `npm run build:preprod` (D8, D9).

### Stage B — the catalogue and search (Unit 2)

*A3 settled this stage's contents: the catalogue is every class the design system knows,
colours included. Variants are still excluded — brief item 98.*

**B1 — the catalogue and its endpoint.** [35, 36, 59, 98, 99, 110]
- Create `src/edit-mode/catalogue.ts`: `createCatalogue(classes, families)` — takes the list as
  arguments so it is testable without a server, and is built from the same generated list the
  stylesheet used, so **search can only offer what the stylesheet contains** (item 99).
- The plugin serves `/__edit-mode/catalogue.json` (list + family map). The read-only proxy
  forwards it, or Dave's replay origin cannot project (D5).
- Tests: the catalogue is a strict subset of the generated list; **no variant is offered**
  (item 98 — `md:mt-4` composed from `getVariants()` is not in any built set and would look
  broken when tapped); the six component classes are present; nothing is committed (item 59).

**B2 — search.** [35, 72]
- Prefix match on the segment after the last `:`, leading `-` stripped, grouped by family,
  capped.
- Tests: `mt` finds `mt-4` and `-mt-4`; `t-7` does **not** find `mt-7`; results are grouped and
  capped; an empty result set is distinguishable so the panel can show item 72's message.

### Stage C — the overlay (Unit 3)

**C1 — collision rules.** [38, 40, 42, 43]
- Create `src/edit-mode/families.ts`: apply D2's map. Exact property-set equality replaces;
  everything else coexists. No hand-written cross-family rules for padding, margin or inset —
  item 40's ruling now falls out of the map rather than being special-cased.
- Tests [85]: `mt-4` + `mt-6` replaces, and **appending would have been a no-op**, asserted as
  the failing case per the design; `p-4` + `px-6` keeps both; `text-sm` + `text-center` keeps
  both; `border-2` + `border-accent` keeps both.

**C2 — the patch model and session JSON.** [93, 94, 95, 96, 97, 41]
- Create `src/edit-mode/patches.ts`, pure. All three kinds — `classes`, `css`, `raw` — and the
  envelope exactly as items 93-96 publish it. Filename per D3.
- **Populate, not just carry** (revision 1 tested only that fixture values survived):
  `viewport` from `innerWidth`/`innerHeight`/`devicePixelRatio` (item 41); `theme.mode` from
  `documentElement.classList`; `theme.name` from `documentElement.dataset.theme`, which
  `src/colours.ts:58` already sets to the theme name ("Lime").
- Tests: a session round-trips to JSON and back with the before-class list intact, **for all
  three kinds** (item 97 corrects item 87 on exactly this); a captured session reads its
  viewport and theme from the document rather than from a fixture; `version` is 1.

**C3 — the panel shell, mode toggle, and event interception.** [30, 58, 61-65, 71, 76]
- Create `src/edit-mode/overlay.ts` and `panel.ts`. Shadow root, hand-written CSS (item 65).
  Pencil bottom-right, clearing the existing `z-[300]` bottom-centre stack at `index.html:157`
  (item 62). `html.ts` starts injecting the script tag here (see A2).
- **Correction to the brief's item 58, which planning has to make:** `src/shortcuts.ts` registers
  no listeners at all — it exports `matchShortcut`, `modifierLabel` and `isTypingTarget`. The
  keydown handlers are in `src/app.ts` (302, 736 capture, 1348, 1493). So "suspend
  `shortcuts.ts`" is not a thing that can be done. What edit mode does instead: a capture-phase
  keydown listener on `document`, registered before the app entry evaluates (D4 point 3), which
  calls `stopImmediatePropagation()` while edit mode is on. The game's handlers never see the
  event; nothing in the game changes.
- Tests, **behavioural rather than structural**: a synthetic keydown reaches a spy registered
  the way `app.ts` registers, does not reach it in edit mode, and reaches it again after leaving.
  Counting listeners would pass with the keyboard dead — the realistic implementation keeps one
  permanent listener behind a flag (item 104 requires the back interception to outlive the mode
  anyway), so the listener set is identical either way. Item 76 is the one thing in §9 Jamie
  refused to concede (item 81), so this test has to test the behaviour.

**C4 — selection.** [31, 32, 63]
- Create `src/edit-mode/select.ts`: topmost element under the point, breadcrumb, nav arrows.
  Label shows **tag, breadcrumb path and the first few words of text — no source location**
  (brief item 32, approved 2026-08-19 as a deliberate departure from the design).
- The panel is never selectable (item 63).
- Tests: the breadcrumb reaches a wrapper with a pixel-identical box; a tap inside the shadow
  root selects nothing.

**C5 — chips, steppers, applying, and the did-it-work check.** [15, 33, 34, 36, 99]
- Chips, `+` search, steppers; on desktop the raw class field and free-CSS box (item 15 — these
  produce the `raw` and `css` patch kinds, and item 97 requires them built, not deferred).
- **Search-focus behaviour (item 33), which revision 1 traced to three tasks and implemented in
  none:** focusing search collapses the sheet to search and results only, and scrolls the
  selected element above it. It is what makes phone editing work at all — without it the
  keyboard covers the thing being edited.
- **After applying, compare computed style before and after; if nothing moved, say so**
  (item 99) with §8's wording: *"That class is not in this build."*
- Tests: the apply path reports a class that changes nothing; a `css` box entry produces a `css`
  patch and is never applied literally; focusing search collapses the sheet.
- **Known limit, recorded rather than solved:** the computed-style check has a false-positive
  mode — a class that *is* in the build but computes to the value already in force, or whose
  effect lands on a descendant, reports as missing. Item 82 says take the simple thing; the
  message is advisory and Jamie is looking at the screen. Written down so it is a known edge and
  not a bug report later.

**C6 — history, back, undo and reset.** [66, 67, 68, 69, 70, 71, 104, 105]
- Create `src/edit-mode/history.ts` and `project.ts`. Entries pushed at the current URL (D4.1);
  back pops one and re-projects (D4.2). Interception **outlives edit mode** and lifts only when
  the last entry is popped (item 104). When empty, back returns to play mode; one more leaves the
  page (item 70).
- **Reset element** (item 71's footer, named in the brief and missing from revision 1): restores
  one element's original class list and pushes a single entry, so back steps over it like any
  other change.
- Rapid stepper taps on one property collapse into one entry (item 68) — a trailing debounce,
  window stated in the code and pinned by the test.
- Tests (pure, on the history core, with fake timers): ten taps inside the window make one entry
  and a pause makes two; popping the last entry releases back; re-projection restores the
  remaining edits onto a rebuilt DOM; reset element is one entry.
- Jamie's manual check 90.1 covers the browser half.

**C7 — persistence.** [52, 53, 54, 105]
- Create `src/edit-mode/session-store.ts`: patch set, undo stack, **whether edit mode was on, and
  which element was selected** (item 53, missing from revision 1) — all in `sessionStorage`, keyed
  to the branch name the plugin injects (item 113, L3). Nothing unfinished is sent to the Pi
  (item 54).
- Tests: a reload restores all four; a different branch key does not read the other's.

**C8 — runtime-controlled classes.** [37, 57, 73, 109]
- On returning from play mode, re-read the class list of every edited element and flag what
  moved — **the only moment the game has actually rendered** (item 109). Flag
  `"runtime-controlled"` in the patch, and show item 73's message.
- Tests: an element whose class the game reset is flagged; one that was not is not.

### Stage D — the session transport (Unit 4)

**D1 — write.** [49, 74, 75, 87, 93]
- Create `edit-mode/session-write.ts`: POST handler writing `.edit-sessions/<ts>.json` (D3), with
  `branch` and `sha` from `git rev-parse` at request time (item 93).
- Failure returns non-2xx so the overlay shows item 74's message and **keeps the patch set**.
  Success shows item 75's and stays in edit mode.
- Tests: a POST writes a well-formed file carrying all three patch kinds; a write failure is
  non-2xx and the client keeps its patches.

**D2 — replay.** [21, 51, 92]
- Create `edit-mode/session-read.ts`: every `*.json` in `.edit-sessions/`, timestamp order,
  **ignoring `*.json.folded`** (item 92). Applied on load by `project.ts`.
- Tests: three sessions replay oldest-first; a `.folded` one is skipped; **replaying only the
  newest is asserted wrong** — item 51's stated silent failure.

**D3 — the read-only port.** [19, 25, 26, 27, 103, 107]
- Create `edit-mode/readonly-proxy.ts`: second listener started and stopped by the plugin
  (item 107), forwards GET and HEAD including the catalogue endpoint, answers everything else
  405, serves 503 if the dev server is down. Serves the overlay in replay-only mode (item 103,
  D5).
- Tests: a POST to the proxy is refused **as a positive assertion** (item 27); a GET is
  forwarded; the replay-mode HTML carries no pencil.

### Stage E — closing

**E1 — docs and the acceptance checklist.** [90, 91, 113 L5]
- Create `docs/EDIT-MODE.md`: how to start it, how Jamie reaches it, the session schema
  (pointing at brief items 93-96 as the source of truth), the filename rule from D3, and
  **Jamie's three-item manual checklist verbatim from item 90**, with item 91's consequence
  recorded — these are verified once and nothing will resurface them.
- Modify `CLAUDE.md`: a line saying `dev.clumeral.com` is a record on the production zone
  pointing at the Pi, unrelated to the `workers.dev` pre-prod decision (item 113, L5).

---

## Traceability

| items | where |
|---|---|
| 1-5, 9-14, 16-18, 20, 22-23, 28-29, 42, 45-47, 50, 82, 84, 88-89, 91 | context, decisions or Jamie's calls — no code |
| 6, 55, 56, 60 | Module layout, A2 |
| 7, 59, 101, 102 | A1, A4, D6, D7 |
| 8, 19, 24-27, 103, 107 | D3, D5 |
| 15, 34, 95, 96, 97 | C2, C5 |
| 21, 51, 92 | D2 |
| 30, 58, 76 | C3 |
| 31, 32, 63 | C4 |
| 33 | C5 |
| 35, 72 | B2 |
| 36, 99 | B1, C5 |
| 37, 57, 73, 109 | C8 |
| 38, 40, 43 | D2, A2, C1 |
| **39** | superseded by item 44 — the pre-built/on-demand line, answered by measurement |
| 41, 93, 94 | C2 |
| 44, 98, 106, 110 | A2, B1 |
| 48, 83 | n/a — maths and analytics untouched |
| 49, 74, 75, 87 | D1, A3 |
| 52, 53, 54, 105 | C7 |
| 61, 62, 64, 65 | C3 |
| 66-71, 104 | C6 (item 71's copy also in C3 and B2) |
| 77-81 | dropped to "if it falls out for free" by item 81; item 76 excepted and tested in C3 |
| 85, 86 | the test list, distributed across every task above |
| 90 | E1 |
| **100** | honoured by construction — no sentinel class anywhere in D7's assertions |
| 108 | A1 |
| **111, 112** | Jamie's closing answers; carried in "What the plan inherits" |
| 113 L1-L5 | A2 (L1), D8 (L2), C7 (L3), D5 (L4 — header sniffing rejected), E1 (L5) |
| 114, 115, 116 | inherited, above |

---

## Risks

1. **`__unstable__loadDesignSystem` is marked unstable.** A Tailwind minor could rename it and
   Stage A stops working. It has survived every 4.x release, and the spike's route A
   (hand-written `@source inline(...)`) is the fallback. Cost if it goes: half a day, and the
   family list becomes hand-maintained — which D2 exists to avoid, so this is the risk that
   actually hurts.
2. **The iPhone measurement (A3) could say "narrow it".** That is why it is third rather than
   last. The fallback is measured: 0.43 MiB, the four stepper families.
3. ~~Preprod's build command is assumed, not read.~~ **Closed 2026-08-19** — Jamie supplied it,
   both builds were run and diffed, and D8 is rewritten against the measured result.
4. **`@source not` is load-bearing for item 12.** If removed, edit-mode test literals go straight
   to the production stylesheet. A4's leak gate catches it on the next build.
5. **D2's family map is generated, so a Tailwind change to emitted properties changes it
   silently.** The A2 tests pin the cases that matter, including the ones a prefix rule gets
   wrong, so a shift shows up as a red test rather than as a class that quietly stops replacing.

---

## Review fixes

`da-plan`, 2026-08-19: 7 High, 10 Medium, 7 Low. Every Medium-and-above is fixed above. What
changed, and the four places the review was itself wrong:

**High.** H1/H2 — the preprod double-build was a tautology and unimplementable; replaced by D8's
sameness assertion. H3/H4 — the `mt-11` contradiction and the undersized allowlist; both gone
with D7's split. H5 — `loadDesignSystem` needs `await` and `base`; the verified call is now in
A2. **The review also claimed it needs a hand-written `loadStylesheet`; it does not** — the
two-argument form above was run on this tree and returned 23,031 classes. H6 — the gate was
unreachable without `--host`; D10. H7 — the family map was undefined and a prefix rule would have
silently deleted `text-sm` when centring text; D2 derives it from CSS property sets instead, with
the counterexamples pinned as tests.

**Medium.** M1 — `@source not` moved to A1, ahead of the first class literal. M2 — the overlay
script tag no longer injected before the overlay exists. M3 — the JS absence assertion now pins
strings that survive minification. M4 — the teardown test is behavioural, and the brief's "suspend
`shortcuts.ts`" is corrected to the real handlers in `app.ts`. M5 — entries are pushed at the
current URL, so a re-render cannot navigate. M6 — `viewport` and `theme` are populated and
tested from the document; **the review said `theme.name` has no accessible source, which is
wrong** — `src/colours.ts:58` sets `documentElement.dataset.theme`. M7 — the query flag became
two static stylesheet entries. M8 — items 33, 53 and Reset element now have tasks. M9 — D7 no
longer overrides item 102. M10 — the spike's own narrowing is now weighed and explicitly
rejected, with the reason.

**Low.** L1 — `.planning/` is a real leak source and is #312's, noted in D6, deliberately not
excluded here. L2 — the two-directory rationale was false as given and is rewritten. L3 — items
39, 100, 111 and 112 added to the table. L4 — citation corrected: the message is item 99's,
§8's wording. L5 — the computed-style false-positive is recorded in C5. L6 — the catalogue
endpoint exists and the proxy forwards it. L7 — the debounce test uses fake timers and a stated
window.
