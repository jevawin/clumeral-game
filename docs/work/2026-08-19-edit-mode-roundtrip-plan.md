# Edit-mode round-trip — plan

**Date:** 2026-08-19
**Branch:** `dev/edit-mode-roundtrip`
**Brief:** `docs/work/2026-08-18-edit-mode-roundtrip-brief.md` (closed 2026-08-19, item 116)
**Design:** `docs/superpowers/specs/2026-08-16-edit-mode-roundtrip-design.md`
**Spike:** `docs/superpowers/notes/2026-08-18-tailwind-full-build-spike.md`
**Scope:** Units 1-4. Unit 5 (`/fold`) is `pi-dev-bot`'s and is not planned here.

This plan settles **how**. It does not reopen any product decision. Where it had to choose
something the brief left unspecified, that choice is called out in
[Decisions this plan makes](#decisions-this-plan-makes). Where it departs from the brief or
adds to a published contract, that is in [Flagged to Jamie](#flagged-to-jamie) and needs a
word before build starts.

---

## What the plan inherits, unarguable

From brief item 116:

- Units 1-4, **dev server only**. Nothing reaches production or preprod (items 6, 7).
- Pre-built **non-colour** stylesheet. **No on-demand rebuild half** — it is a separate brief
  if the iPhone measurement calls for it (items 44, 114).
- **No colours and no variants offered.** Anything outside the built set is caught and
  reported, never silent (item 99).
- The session file schema (items 93-96) is a **contract with `pi-dev-bot`** and is not
  paraphrased.
- `/fold` renames a consumed session to `*.json.folded`; the game reads only bare `*.json`
  (item 92).
- The safety assertion is *"every class in the built stylesheet appears in `src/` or
  `index.html`"* — no sentinel (items 101, 102).
- Simplicity is the tie-break (item 82). Jamie is the tester (items 89, 90).

---

## Sequencing — why the order is what it is

Jamie's instruction, 2026-08-19: *the pre-built stylesheet has to reach the iPhone as early as
possible, because it is the measurement that decides whether the on-demand half gets built at
all. Sequence it so that lands before anything that depends on the answer.*

So the plan is deliberately front-loaded. **Stage A is three small tasks and ends at a gate.**
Nothing in Stage A depends on the overlay, the catalogue, the panel or the middleware. At the
end of it Jamie can open the dev server on his phone and get an answer.

What the answer changes downstream:

| iPhone verdict | consequence |
|---|---|
| non-colour set (1.16 MiB) is comfortable | build as planned — Stage B catalogue is the non-colour set |
| the **full** set (4.99 MiB) is also comfortable | catalogue becomes "everything" (brief item 46), colours are offered, and the follow-up brief for the on-demand half is never needed |
| non-colour set struggles | Stage B narrows to the four stepper families (0.43 MiB, brief item 44), and the on-demand half gets its own brief |

Because the middle row is a real possibility and costs nothing to test, **Task A2 ships both
stylesheets behind one query flag**, so Jamie answers the whole question in one sitting rather
than in two rounds a day apart.

---

## Measured on the Pi, 2026-08-19, before writing this

Re-run of the spike's numbers against the exact filter this plan uses, so the plan's central
figures are observed rather than carried forward.

| set | classes | unminified | gzipped |
|---|---|---|---|
| non-colour (this plan's default) | **8,397** | **1,212,459 bytes (1.16 MiB), 33,702 lines** | **72 kB** |
| everything (spike) | 23,031 | 5,244,578 bytes (5.24 MB) | 193 kB |

The non-colour count reproduces brief item 44's 8,397 exactly, which confirms the filter in
Task A2 is the same one that produced the brief's table.

**Gzip changes the shape of the question.** The spike's cost 1 (uncompressed dev serving) is
fixed in Task A2, and once it is, even the *full* set is 193 kB on the wire. So transfer is no
longer the thing being measured — parse and style-recalc on the phone is, and that is the only
unknown left.

---

## Module layout

Two halves, deliberately in two places, because one runs in Node and one runs in a browser.

```
edit-mode/                        Node. Imported ONLY by vite.config.ts.
  plugin.ts                       the Vite plugin (apply: 'serve')
  classlist.ts                    design-system class list + the colour predicate
  session-write.ts                POST handler -> .edit-sessions/<ts>.json
  session-read.ts                 GET handler -> unconsumed sessions, timestamp order
  readonly-proxy.ts               the second port (GET/HEAD only)
  gzip.ts                         compression middleware for the dev stylesheet
  html.ts                         the index.html rewrite, as a pure function

src/edit-mode/                    Browser. Imported by NOTHING in the game.
  overlay.ts                      entry — the only file the injected <script> names
  panel.ts                        shadow-root UI (hand-written CSS, item 65)
  select.ts                       selection, breadcrumb, nav arrows
  families.ts                     family + colour classification (pure)
  catalogue.ts                    catalogue + search (pure)
  patches.ts                      patch model + session JSON (pure)
  project.ts                      patch set -> DOM. Shared by editing and by replay.
  history.ts                      back ownership + undo (pure core)
  session-store.ts                sessionStorage persistence

src/tailwind-edit.css             dev-only stylesheet entry (3 lines)
.edit-mode/classlist.txt          generated, gitignored
.edit-sessions/                   generated, gitignored
```

Why the split rather than one directory: `tsconfig.json` includes `src/**` with DOM libs and
no `@types/node`, so Node code under `src/` would not typecheck. Keeping the Node half at the
repo root avoids adding `@types/node` and changing how every existing file typechecks, for no
benefit. (There is no `typecheck` script in CI today, so this is about editors, not the gate —
but it is free to get right.)

**Nothing in `src/` imports `src/edit-mode/`.** That is brief item 60's guarantee: there is no
dev-only condition for a bundler to strip, because the game never names edit mode. `vite build`
starts from `index.html` and reaches neither directory.

---

## Decisions this plan makes

These are "how" questions the brief left to planning. None of them changes agreed behaviour.

### D1 — the colour predicate, and what it costs

Brief item 43 said colour utilities are identified by *"carrying opacity modifiers"*. Tested on
this build, that is nearly right and needs one word added. `getClassList()` returns
`[name, { modifiers }]`, and:

```
text-sm        modifiers: ["tight","snug","normal","relaxed","loose"]   <- line heights
text-text      modifiers: ["0","5","10", ... ,"100"]                    <- opacity
border-2       modifiers: []
border-accent  modifiers: ["0","5", ... ,"100"]
```

So the predicate is **"has modifiers, and every modifier is numeric"** — not "has modifiers".
With that word, it reproduces the brief's 8,397 exactly, and it splits `text-sm` from
`text-text` and `border-2` from `border-accent` from Tailwind's own data, which is what item 43
asked for. One predicate does both jobs: it filters the stylesheet and it classifies for the
replace map, so the two cannot drift apart.

**The cost, which is real and is not in the brief:** shadow utilities take an opacity modifier
too, so they classify as colour and drop out of the non-colour set. Verified:

```
shadow-box COLOUR   shadow-box-active COLOUR   shadow-key COLOUR
shadow-lg  COLOUR   shadow-md COLOUR   shadow-sm COLOUR   shadow-none non-colour
```

So under "no colours", **edit mode offers no shadows at all**, including the project's own
`shadow-box` and `shadow-key`. Item 99 makes that visible rather than silent — search will not
offer them and the raw field will report them missing — but it is a consequence Jamie would not
predict from the words "no colours". Flagged below.

### D2 — the patch set is the truth; the DOM is a projection

Brief item 67 says back must not let the router re-render and wipe edits, and asks planning to
establish *how* that is guaranteed given `src/router.ts:199` registers its `popstate` listener
at boot.

Registration order cannot be the guarantee. `popstate` is dispatched **on `window`**, and for
listeners on the event target itself the DOM spec runs capture and bubble listeners in
registration order — so `{capture: true}` buys nothing and `stopImmediatePropagation()` only
stops listeners registered *after* ours. Getting in first would work, but it depends on script
evaluation order staying as it is forever, and the failure is silent.

So the plan does not rely on it alone. **`project.ts` can rebuild the whole edited DOM from the
patch set at any moment.** Back pops one entry from the patch set and re-projects. If the
router re-rendered, re-projection puts the remaining edits back; if it did not, re-projection is
a no-op. Correctness stops depending on listener order.

The overlay is still injected ahead of the app entry so it registers first and the re-render
does not happen in practice — belt and braces, cheap, and it keeps Jamie's manual check (item
90.1, "the screen does not reload") honest.

This costs nothing extra, because re-projection is the same code Dave's replay needs (item 21).
One mechanism, two users.

### D3 — the session filename format

Brief item 93 specifies `.edit-sessions/<timestamp>.json` and item 51 requires replay in
timestamp order, but nothing states the timestamp's format. `/fold` is being written now and has
to glob and sort these, so the plan fixes it:

```
.edit-sessions/2026-08-19T22-41-07-221Z.json
```

`createdAt` with `:` and `.` replaced by `-`. Chosen so it sorts lexicographically (which is
therefore also chronologically), is safe on any filesystem, and needs no parsing to order. This
**adds to the published contract rather than changing a field** — flagged below so `/fold` is
written against it.

### D4 — the read-only port, and how the overlay knows which it is on

Brief item 26 settles the mechanism (a second listener with no write handler) and item 103 says
that origin serves the overlay in replay-only mode — no pencil, no panel. The proxy therefore
does two things: it refuses anything that is not GET or HEAD with a 405, and it rewrites the
injected overlay tag to carry `data-edit-mode="replay"`. The overlay reads that attribute and
never builds the panel.

The mode comes from **which listener served the page**, not from a header, so nothing Dave's
browser can send changes it. That is item 25's trap closed: `cloudflared` making Dave's traffic
look local cannot matter, because the tunnel port has no write handler to reach.

If the dev server is down, the proxy answers 503 rather than failing to start (item 107).

### D5 — where the CSS-leak guard has to sit, and why `src/tailwind.css` gets three lines

This is the one place the plan touches an existing file, and brief item 55 says not to. The
reason it has to:

Tailwind v4 scans everything in the project that git does not ignore. That is issue #312, and
it is why `mt-7` and `row-7447` are in the production stylesheet today. **Edit-mode source and
its tests will contain class-name literals** — a family-map test asserting `mt-4` against
`mt-6`, for instance — and every one of those would land in the production CSS. Brief item 12
says this work must not make #312 worse. Without an exclusion, it makes it worse by design.

I hit this by accident while measuring for this plan, which is the cleanest possible
demonstration: a generated class list left in the working tree un-gitignored took the production
stylesheet from **51,218 bytes to 1,412,751** in a single `npm run build`. That is brief item
59's stated failure mode, observed rather than reasoned about.

So `src/tailwind.css` gains exactly three lines:

```css
@source not "./edit-mode";
@source not "../edit-mode";
@source not "../tests";
```

`@source not` only ever **removes** rules from the production stylesheet, so it cannot break the
shipped app by adding something. Tested on this tree: excluding `docs/` and `tests/` drops 26
selectors and 2,459 bytes, and **every one of the 26 is absent from `src/` and `index.html`** —
they exist solely because a document mentions them. (`shadow-key` looks like a false positive
but is not: it appears in `src/` only as the token name `--shadow-key`, never as a class.)

The plan does **not** exclude `docs/`. That is #312's job on #312's branch (item 12).

### D6 — making the safety assertion green today without weakening it

Brief item 101 wants *"every class selector in the built stylesheet appears literally in `src/`
or `index.html`"*, and item 102 says it lands **red** until #312 is fixed. A permanently red
test in CI blocks every pull request, so it cannot land red literally.

The plan writes item 101's assertion exactly as specified, with one addition: a committed
**allowlist of the classes that reach production only via prose in `docs/`** — 26 entries today,
generated once, each one a piece of #312's debt made countable in the repo rather than described
in a document. The test is green today, goes red the moment any *new* class leaks in from
anywhere, and #312's branch deletes the allowlist file and the test turns green on its own
terms.

This is stronger than a skipped test and weaker than nothing. It catches an edit-mode leak on
the first build.

### D7 — asserting against preprod as well as production

Jamie's instruction: *assert against every deployed artefact, preprod included, and against
built output rather than a config flag.*

Preprod and production are one Worker and, as far as this repo can see, one build command. The
brief assumed that (item 113, L2). The plan **tests it instead of assuming it**: a
`build:preprod` script runs `vite build --mode preprod`, and the safety spec asserts the client
CSS and JS assets are byte-identical to the production build's, then runs every absence
assertion against both. If Cloudflare ever builds preprod differently, that test is what says so.

Cost: one extra full build in CI, roughly 40 seconds.

**One thing I cannot check from here, and it needs a yes from Jamie.** The preprod build command
lives in the Cloudflare "Workers Builds" dashboard, not in this repo, so I am assuming it is the
same `npm run build`. If it is not, the parity assertion is testing a build nobody deploys.
Flagged below.

### D8 — the assertions have to actually run

`npm test` runs on a clean checkout in `ci-smoke.yml`, before Playwright builds anything. So
every build-output assertion in the repo currently **skips** in CI — including
`tests/sw-precache.spec.ts`, which has been silently skipping since it was written.

The plan adds a build step to `ci-smoke.yml` before `npm test`. Verified locally: with `dist/`
present, all 37 files and 751 tests pass and `sw-precache.spec.ts` runs its 5 tests for real
rather than skipping. So this fixes an existing hole as a side effect, at the cost of one build
in the gate.

---

## Flagged to Jamie

Five things. Four are consequences, one is a question I cannot answer from here.

1. **No shadows in edit mode.** "No colours" turns out to mean no `shadow-lg`, no `shadow-box`,
   no `shadow-key` — Tailwind's shadow utilities take an opacity modifier and so classify as
   colour (D1). Search will not offer them and the raw field reports them missing. Says so here
   rather than letting you find it by tapping.
2. **`src/tailwind.css` gets three `@source not` lines**, against brief item 55's "no existing
   module changes". Reason in D5: without it, edit mode's own test files ship their class
   literals to the production stylesheet, which item 12 forbids. `@source not` can only remove
   rules, never add them, and the 26 selectors it removes on this tree are used nowhere in the
   app.
3. **The session filename format is now fixed** at `2026-08-19T22-41-07-221Z.json` (D3). The
   schema left `<timestamp>` unspecified and `/fold` has to sort these. **No field in items
   93-96 changes** — this adds a naming rule the contract was missing.
4. **CI gains a build step and one extra build** (D7, D8), so the safety assertions run at all
   and cover preprod. About a minute on the gate.
5. **Question — is the Cloudflare preprod build command the same `npm run build`?** It is set in
   the Workers Builds dashboard, which I cannot read. Everything in D7 assumes yes.

---

## Tasks

Each task is one commit, tests first. Brief item numbers in brackets. Every test is reverted
and watched go red before it counts (item 86).

### Stage A — the stylesheet, and the measurement

**A1 — ignore the generated paths.** [108, 59]
- Modify: `.gitignore` — add `.edit-mode/` and `.edit-sessions/`.
- Test `tests/edit-mode-paths.spec.ts`: `git check-ignore -q` succeeds for
  `.edit-mode/classlist.txt` and `.edit-sessions/x.json`. Asserts the property git enforces,
  not the text of the file.
- Why first: the class list is 386 kB of class names, and an un-ignored one puts every class in
  the project into the production stylesheet (D5, observed).

**A2 — the class list, the colour predicate, and the dev stylesheet.** [44, 43, 99, 110, 106]
- Create `edit-mode/classlist.ts`:
  - `loadClassList()` — `__unstable__loadDesignSystem(readFileSync('src/tailwind.css'))`,
    returns `getClassList()`.
  - `isColourUtility([name, meta])` — `meta.modifiers.length > 0 && every(/^\d+$/)` (D1).
  - `COMPONENT_CLASSES` — the six, hand-listed here and not converted to `@utility` (item 110):
    `digit-box`, `burger-btn`, `skip-link`, `toast-msg`, `warn`, `recurring`.
  - `writeClassList(path, { colours })` — writes one class per line to `.edit-mode/classlist.txt`.
- Create `src/tailwind-edit.css` — three lines: `@import "./tailwind.css";`,
  `@source "../.edit-mode/classlist.txt";`, and a comment saying why it is gitignored (the spike
  proved an explicit `@source` is scanned even when the file is not).
- Create `edit-mode/gzip.ts` — gzip responses for `/src/tailwind-edit.css`. Spike cost 1; takes
  1.16 MiB to 72 kB.
- Create `edit-mode/html.ts` — `rewriteIndexHtml(html, opts)`, pure: swaps the
  `/src/tailwind.css` link for `/src/tailwind-edit.css` and injects the overlay `<script
  type="module">` **before** the app entry (D2). Pure so it is testable without a browser.
- Create `edit-mode/plugin.ts` — `editMode()`, `apply: 'serve'`, `configureServer` +
  `transformIndexHtml`. Generates the class list on server start. Honours
  `?edit-classes=all` to regenerate with colours included, so Jamie can compare both sets on the
  phone without a redeploy (see Sequencing).
- Modify `vite.config.ts` — add `editMode()` to `plugins`.
- Tests `tests/edit-mode-classlist.spec.ts`:
  - `text-sm` is not a colour; `text-text` is. `border-2` is not; `border-accent` is. [43]
  - `shadow-box` **is** classified colour — pinned deliberately, because it is D1's surprising
    consequence and a future change to the predicate should have to argue with this line.
  - the non-colour set contains `mt-11` and `-mt-96` and `mt-px`, and does not contain
    `bg-accent`. [44]
  - the non-colour count is within 8,000-9,000 — a band, not `8397`, so a Tailwind patch
    release that adds one utility does not turn the suite red for no reason.
  - the catalogue holds every `@theme` spacing step and all six component classes. [85]
- Tests `tests/edit-mode-html.spec.ts`: the rewrite swaps the stylesheet link, injects the
  overlay script before the app entry, and leaves the committed `index.html` untouched. [56]

**A3 — GATE: Jamie measures on the iPhone 16 Pro.** [45, 46, 47, 87]
- Not a code task. `npm run dev` on the Pi, Jamie loads it over Tailscale, then loads
  `?edit-classes=all`, and reports whether either or both feel fine.
- **Stage B does not start until this is answered**, because it sets the catalogue's contents.
- Recorded in this file when it comes back.

**A4 — the leak guard and the safety assertions.** [7, 12, 59, 101, 102] + Jamie's instruction 2
- Modify `src/tailwind.css` — the three `@source not` lines (D5).
- Add `package.json` script `build:preprod`: `vite build --mode preprod`.
- Create `tests/fixtures/css-prose-allowlist.txt` — the 26 docs-only selectors, generated once,
  with a header comment naming issue #312 (D6).
- Test `tests/css-leak.spec.ts`: for the built production CSS, every class selector appears
  literally in `src/` or `index.html`, or in the allowlist. Skips with a loud message if `dist/`
  is absent. [101, 102]
- Test `tests/edit-mode-safety.spec.ts`, against **built output, never a config flag**:
  - production and preprod client CSS/JS assets are byte-identical (D7). `sw.js` is excluded —
    it carries a `Date.now()` build hash.
  - neither build's JS contains any `src/edit-mode/` module marker.
  - neither build's CSS contains `mt-11` or any other class outside the production set — which
    is `css-leak.spec.ts`'s assertion, run against both artefacts.
  - `dist/` contains no `tailwind-edit` asset and no `.edit-sessions` reference.
- Modify `.github/workflows/ci-smoke.yml` — `npm run build && npm run build:preprod` before
  `npm test` (D8).

### Stage B — the catalogue and search (Unit 2)

**B1 — the catalogue.** [35, 36, 59, 99, 110]
- Create `src/edit-mode/catalogue.ts`: built from the same generated list the stylesheet used,
  so **search can only ever offer what the stylesheet contains** (item 99, first half). Served
  by the plugin as JSON; never committed (item 59).
- Tests: the catalogue is a strict subset of the class list; no variant is offered (item 98);
  the six component classes are present. [98, 99, 110]

**B2 — search.** [35]
- Create the search function in `src/edit-mode/catalogue.ts`: prefix match on the segment after
  the last `:`, leading `-` stripped, grouped by family, capped.
- Tests: `mt` finds `mt-4` and `-mt-4`; `t-7` does **not** find `mt-7`; results are grouped and
  capped; a query with no hits returns empty so the panel can show item 72's message.

### Stage C — the overlay (Unit 3)

**C1 — families and the replace map.** [38, 40, 43]
- Create `src/edit-mode/families.ts`, pure. Same-family collision replaces (`px-4` → `px-6`).
  **No cross-family rule for padding, margin or inset** — item 40 settled that Tailwind emits
  the shorthand before the axis utility, so `p-4 px-6` is already correct and both are kept.
  Colour-vs-size split reuses A2's predicate (D1).
- Tests [85]: `mt-4` + `mt-6` replaces, and **appending would have been a no-op** — asserted as
  the failing case, per the design; `p-4` + `px-6` keeps both; `text-sm` + `text-accent` keeps
  both; `border-2` + `border-accent` keeps both.

**C2 — the patch model and session JSON.** [93, 94, 95, 96, 97, 41, 92]
- Create `src/edit-mode/patches.ts`, pure. Types for all three kinds — `classes`, `css`, `raw` —
  and the session envelope exactly as items 93-96 publish it. Filename format per D3.
- Tests: a session round-trips to JSON and back with the before-class list intact, **for all
  three kinds** (item 97 corrects item 87 on exactly this); `viewport` and `theme` survive;
  `version` is 1.

**C3 — the panel shell, mode toggle, and event interception.** [30, 58, 61-65, 71, 76]
- Create `src/edit-mode/overlay.ts` and `panel.ts`. Shadow root, hand-written CSS (item 65).
  Pencil bottom-right, clearing the existing `z-[300]` bottom-centre stack (item 62).
- Pointer interception at document level, capture phase (item 30). `shortcuts.ts` suspended by
  swallowing keydown in capture before the app's listener, and **restored on leaving edit
  mode** (item 58).
- Tests: entering and leaving edit mode leaves exactly the listener set it started with — item
  76's silent failure, and the one part of §9 that is not conceded by item 81.

**C4 — selection.** [31, 32, 63]
- Create `src/edit-mode/select.ts`: topmost element under the point, breadcrumb, nav arrows.
  Label shows **tag, breadcrumb path and the first few words of text — no source location**
  (item 32, approved 2026-08-19 as a departure from the design).
- The panel is never selectable (item 63).
- Tests: the breadcrumb reaches a wrapper with a pixel-identical box; a tap inside the shadow
  root selects nothing.

**C5 — chips, steppers, applying, and the did-it-work check.** [33, 34, 36, 99, 15]
- Chips, `+` search, steppers, and on desktop the raw class field and free-CSS box (item 15 —
  these produce the `raw` and `css` patch kinds, and item 97 requires them built).
- **After applying, compare computed style before and after; if nothing moved, say so** (item
  99, second half) with item 8's wording: *"That class is not in this build."*
- Tests: the apply path reports a class that changes nothing; a `css` box entry produces a `css`
  patch and is never applied literally.

**C6 — history, back, and undo.** [66, 67, 68, 69, 70, 104, 105]
- Create `src/edit-mode/history.ts` and `project.ts`. Back pops one patch and re-projects (D2).
  Rapid stepper taps on one property collapse into one entry (item 68). Interception **outlives
  edit mode** and lifts only when the last entry is popped (item 104). When empty, back returns
  to play mode; one more leaves the page (item 70).
- Tests (pure, on the history core): ten stepper taps make one entry; popping the last entry
  releases back; re-projection restores the remaining edits onto a rebuilt DOM.
- Jamie's manual check 90.1 covers the browser half.

**C7 — persistence.** [52, 53, 54, 105]
- Create `src/edit-mode/session-store.ts`: patch set **and** undo stack in `sessionStorage`,
  keyed to the branch name the plugin injects (item 113, L3). Nothing unfinished is sent to the
  Pi (item 54).
- Tests: a reload restores both objects; a different branch key does not read the other's.

**C8 — runtime-controlled classes.** [37, 57, 73, 109]
- On returning from play mode, re-read the class list of every edited element and flag what
  moved — **the only moment the game has actually rendered** (item 109). Flag
  `"runtime-controlled"` in the patch, and show item 73's message.
- Tests: an element whose class the game reset is flagged; one that was not is not.

### Stage D — the session transport (Unit 4)

**D1 — write.** [49, 87, 74, 75]
- Create `edit-mode/session-write.ts`: POST handler writing `.edit-sessions/<ts>.json` (D3),
  with `branch` and `sha` from `git rev-parse` at request time (item 93).
- Failure returns non-2xx so the overlay shows item 74's message and **keeps the patch set**.
  Success shows item 75's and stays in edit mode.
- Tests: a POST writes a well-formed file with all three patch kinds; a write failure leaves the
  response non-2xx.

**D2 — replay.** [21, 51, 92]
- Create `edit-mode/session-read.ts`: every `*.json` in `.edit-sessions/`, timestamp order,
  **ignoring `*.json.folded`** (item 92). Applied on load by `project.ts`.
- Tests: three sessions replay oldest-first; a `.folded` one is skipped; **replaying only the
  newest is asserted wrong** — item 51's stated silent failure.

**D3 — the read-only port.** [26, 27, 103, 107, 19, 25]
- Create `edit-mode/readonly-proxy.ts`: second listener, started and stopped by the plugin
  (item 107), forwards GET and HEAD, answers everything else 405, serves 503 if the dev server
  is down. Serves the overlay in replay-only mode (item 103, D4).
- Tests: a POST to the proxy is refused **as a positive assertion** (item 27); a GET is
  forwarded; the replay-mode HTML carries no pencil.

### Stage E — closing

**E1 — docs and the acceptance checklist.** [90, 91, 113 L5]
- Create `docs/EDIT-MODE.md`: how to start it, how Jamie reaches it, the session schema
  (pointing at brief items 93-96 as the source of truth), and **Jamie's three-item manual
  checklist verbatim from item 90**, with item 91's consequence recorded — these are verified
  once and nothing will resurface them.
- Modify `CLAUDE.md`: a line saying `dev.clumeral.com` is a record on the production zone
  pointing at the Pi, and is unrelated to the `workers.dev` pre-prod decision (item 113, L5).

---

## Traceability

Every numbered brief item, to a task or to a reason it needs no code.

| items | where |
|---|---|
| 1-5, 9-14, 16-18, 20, 22-23, 28-29, 42, 45-47, 50, 82, 84, 88-89, 91 | context, decisions or Jamie's calls — no code |
| 6, 55, 56, 60 | Module layout, A2 |
| 7, 59, 101, 102 | A4 |
| 8, 24, 19, 25, 26, 27, 103, 107 | D3 |
| 15, 34, 95, 96, 97 | C2, C5 |
| 21, 51, 92 | D2 |
| 30, 58, 76 | C3 |
| 31, 32, 63 | C4 |
| 33, 36, 99 | B1, B2, C5 |
| 35 | B2 |
| 37, 57, 73, 109 | C8 |
| 38, 40, 43 | C1 |
| 41, 93, 94 | C2 |
| 44, 98, 106, 110 | A2, B1 |
| 48, 83 | n/a — maths and analytics untouched |
| 49, 74, 75, 87 | D1, A3 |
| 52, 53, 54, 105 | C7 |
| 61, 62, 64, 65 | C3 |
| 66-70, 104 | C6 |
| 71, 72 | C3, B2 |
| 77-81 | dropped to "if it falls out for free" by item 81 |
| 85, 86 | the test list, distributed across every task above |
| 90 | E1 |
| 108 | A1 |
| 113 L1-L5 | A2 (L1), A4 (L2), C4 (L3, via item 32), D3 (L4 — header sniffing rejected), E1 (L5) |
| 114, 115, 116 | inherited, above |

---

## Risks

1. **`__unstable__loadDesignSystem` is marked unstable.** A Tailwind minor could rename it and
   Stage A stops working. It has survived every 4.x release so far, and the spike's route A
   (hand-written `@source inline(...)`) is the fallback. Cost if it goes: half a day, and the
   family list becomes hand-maintained.
2. **The iPhone measurement (A3) could say "narrow it".** That is the point of putting it third
   rather than last. The fallback is measured and known: 0.43 MiB, the four stepper families.
3. **Preprod's build command is assumed, not read** (D7, flagged item 5).
4. **`@source not` is load-bearing for item 12.** If it is ever removed, edit-mode test literals
   go straight to the production stylesheet. `css-leak.spec.ts` catches it on the next build.
