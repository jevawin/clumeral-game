# Unit 1 spike — a full-Tailwind dev build

**Date:** 2026-08-18
**Branch:** `dev/edit-mode-roundtrip`
**Answers:** open question 1 of `2026-08-16-edit-mode-roundtrip-design.md` (Unit 1), and
Unit 2's enumeration question as a side effect.
**Status:** research only. Nothing was built, no product change, no PR.

## Answer

It can be done cleanly. There are two routes, both of which I ran on this Pi against this
repo. The fallback in the design (a separate stylesheet built from the token cross-product)
is not needed.

**This answer rests on testing.** Every number below came from running the thing. Tailwind's
own docs corroborate one half of route A — `@source inline()`, its brace expansion and its
variant expansion are documented at
https://tailwindcss.com/docs/detecting-classes-in-source-files — but the docs say nothing
about pointing `@source` at a single file, and nothing about whether an explicit `@source`
beats `.gitignore`. Both of those are true, and I know that because I tested them, not
because a doc says so.

### Route A — `@source inline(...)`, hand-written

A dev-only stylesheet that imports the real one and lists what to force:

```css
@import "./tailwind.css";
@source inline("mt-{0..96}");
@source inline("{hover:,md:,}skew-x-12");
```

Documented, no generated file, no build step. Brace ranges and variant prefixes both work.
The catch is that you write the family list by hand, which is exactly the maintenance drift
the design wanted to avoid.

### Route B — `@source` at a generated class list (recommended)

Generate every class the design system knows about into a plain text file, and point one
`@source` at it:

```css
@import "./tailwind.css";
@source "../.edit-mode/classlist.txt";
```

The list comes from Tailwind's own design system, so it cannot drift from `@theme`:

```js
import { __unstable__loadDesignSystem } from '@tailwindcss/node'
import { readFileSync, writeFileSync } from 'node:fs'

const ds = await __unstable__loadDesignSystem(
  readFileSync('src/tailwind.css', 'utf8'), { base: process.cwd() }
)
writeFileSync('.edit-mode/classlist.txt',
  ds.getClassList().map(([n]) => n).join('\n'))
```

That is the same API Tailwind's own IntelliSense and Prettier plugin use. It is marked
unstable, which is the one real risk in route B: a Tailwind minor could rename it. It has
survived every 4.x release so far, and if it ever goes, route A still works.

Two behaviours worth writing down, because neither is documented and both are load-bearing:

- `@source` accepts a **single file**, not just a directory.
- An explicit `@source` **is scanned even when the file is gitignored**. That is what keeps
  the generated list out of the production build: gitignore it, and Tailwind's automatic
  scanning skips it, while the dev entry still reads it.

## Proof

The proof class is **`mt-11`**, not `mt-7`. `mt-7` turned out to be useless as a test,
which is itself the most interesting thing I found — see the footnote below.

`mt-11` appears nowhere in the repository:

```
$ git grep -c -- 'mt-11'
$ echo $?
1
```

The normal dev stylesheet does not contain it:

```
$ curl -s 'http://localhost:5199/src/tailwind.css?direct' | grep -A2 -F '.mt-11 {'
$ echo $?
1
```

The edit-mode dev stylesheet does:

```
$ curl -s 'http://localhost:5199/src/tailwind-edit.css?direct' | grep -A2 -F '.mt-11 {'
  .mt-11 {
    margin-top: calc(var(--spacing) * 11);
  }
```

Both are served by the real `vite dev` on this Pi, through the real `@tailwindcss/vite`
plugin, from the real `src/tailwind.css`. `src/tailwind-edit.css` was three lines: the
import, the `@source`, and a comment.

### Production is unaffected

Built before and after, with the edit entry sitting in `src/`:

```
$ npm run build
dist/client/assets/index-CW3VXwdu.css  50.55 kB │ gzip: 10.08 kB   (before)
dist/client/assets/index-CW3VXwdu.css  50.55 kB │ gzip: 10.08 kB   (after)
$ grep -l '\.mt-11' dist/client/assets/*.css
(nothing)
```

Same content hash, same 50,555 bytes, no `mt-11`. Production is untouched because nothing
imports the edit entry — Vite never sees it. **That is the whole gate, and it is thinner
than it looks:** the moment `index.html` is made to point at the edit entry in dev, the
gate becomes "the swap only happens in dev", and the design's safety test (assert the built
bundle contains no overlay code) should assert no `mt-11` in the built CSS too.

## Costs, measured on this Pi

Raspberry Pi 5 Model B (4 cores, 4 GB), aarch64, Node 22.23.2, Vite 8.0.3, Tailwind 4.2.2.

| | normal | full build |
|---|---|---|
| stylesheet, unminified | 63,487 bytes | **5,244,578 bytes** (5.24 MB, 108,518 lines) |
| gzipped | 10.7 kB | **193 kB** |
| `vite dev` startup | 3,475 ms | 3,475 ms — unchanged |
| first request for the sheet | 0.28 s | **2.24 s** |
| repeat request, nothing changed | 0.003 s | **0.05 s** |
| rebuild after editing a `.ts` file | 0.03 s | **0.32 s** |
| rebuild after editing `tailwind.css` | 0.18 s | **1.93 s** |

Startup is unchanged because the stylesheet compiles lazily, on the first request for it.

Two things that are not free:

1. **Vite dev serves it uncompressed.** 5.24 MB on the wire per page load, confirmed with
   `curl --compressed` — no `Content-Encoding` header comes back. Over Tailscale to a phone
   that is the dominant cost of edit mode, not the compile. A gzip middleware in the dev
   server takes it to ~193 kB and is a few lines.
2. **I have not measured what a phone browser does with 108,518 lines of CSS.** Parse and
   style-recalc cost is unknown. I could not measure it: Playwright is CI-only here, and
   this box does not run it. It is the one open risk in the whole spike, and it is
   measurable in ten minutes by whoever next runs the browser suite.

### Variants are the real limit

The full build contains every base utility and **no variants**. `md:mt-11`, `dark:bg-lime-300`
and `hover:mt-11` are all absent. Adding them is a multiplication, and it hurts:

| | candidates | stylesheet | gzipped | compile |
|---|---|---|---|---|
| base utilities only | 23,031 | 5.24 MB | 193 kB | 2.2 s |
| plus `dark:`, `md:`, `hover:` on everything | 92,124 | **24.6 MB** | 751 kB | 8.2 s |

All 88 variants across all 23,031 classes is roughly two million rules and is not worth
costing. So the design has a decision to make that it does not currently know it has:
**which variants edit mode can produce.** My recommendation is base utilities everywhere
plus a chosen handful of variants (`dark:`, `md:`, `hover:`, `focus:`) on a chosen handful
of families (spacing, size, colour, text) — a few hundred kilobytes rather than twenty-five
megabytes. It fits the design's existing logic exactly: hitting the edge is information, and
a variant edit mode cannot make is a thing Jamie says in words instead.

## Unit 2 falls out of the same mechanism

Yes — the same call enumerates the catalogue, and it is fast:

```
$ time node .edit-mode/gen.mjs
classes: 23031  bytes: 385869
real 0m0.532s
```

`getClassList()` returns `[name, { modifiers }]` pairs; `getVariants()` returns the 88
variants separately, so search can compose `md:` + `mt-4` without either list enumerating
the product. Every project token is in there — I checked `bg-accent`, `text-text`,
`bg-surface`, `border-border`, `shadow-box`, `shadow-box-active`, `shadow-key`, `font-mono`,
`text-success`, `text-error`. The spacing scale arrives complete, negatives included:
`-mt-96` through `mt-96`, `mt-px`, `mt-auto`.

**The component classes are not in it**, as expected — `digit-box`, `burger-btn`,
`skip-link`, `toast-msg`, `warn` and `recurring` are plain CSS rules, not Tailwind
utilities, so the design system does not know them. Two ways to fix that, both cheap:
list those six by hand in the catalogue generator, or convert them to `@utility` in
`src/tailwind.css` so they enumerate themselves. The second is tidier and is a real
source change, so it belongs in planning, not here.

## The fallback, costed

Not needed, but for completeness: an edit-mode-only stylesheet built from the token
cross-product is about a day's work and then permanent maintenance. You would hand-write
the family list (`mt`, `mb`, `px`, `text`, `bg`, …), cross it with the `@theme` scales, and
keep it in step by hand every time a token or a Tailwind version changes — with nothing to
tell you it has drifted. Route B gets a better list, for free, from the source of truth.
There is no reason to take the fallback.

## Footnote — why `mt-7` was no good as a test

`mt-7` is **already in the production stylesheet**, and the only place it appears in the
repo is prose inside `2026-08-16-edit-mode-roundtrip-design.md` — the design doc that names
it as an example of a class that is *not* built.

Tailwind v4's automatic source detection scans everything in the project that git does not
ignore, and that includes markdown. So writing `mt-7` in a sentence shipped `mt-7` to
production. The same is true of every class name mentioned in `docs/` and `.planning/`.

It is small — the production sheet is 50.55 kB and this is a handful of rules inside it —
and it is not what the spike was for. But it is worth someone deciding about, because right
now the way to add a rule to the production stylesheet is to write its name in a document.
Narrowing the scan (`@source "./src"` plus `index.html`) would close it, and would want its
own check that nothing real gets dropped.

## Reproducing this

Nothing from the spike is committed — the working tree is back to clean and the dev server
is stopped. To redo it: create `.edit-mode/` with a `.gitignore` containing `*`, drop the
generator above in it, add the three-line `src/tailwind-edit.css`, run `npx vite dev`, and
curl `/src/tailwind-edit.css?direct`.
