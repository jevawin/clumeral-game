---
phase: quick-260531-qjn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - CLAUDE.md
  - README.md
autonomous: true
requirements: [GH-215]
must_haves:
  truths:
    - "CLAUDE.md contains no duplicated architecture/conventions/stack content — only rules, workflow, hygiene, doc-routing table, and project brief"
    - "CLAUDE.md still routes readers to docs/ARCHITECTURE.md, docs/CONVENTIONS.md, docs/STACK source via the doc-routing table"
    - "README.md ### Project structure block matches the actual current src/ tree"
    - "No broken doc links in either file"
  artifacts:
    - path: "CLAUDE.md"
      provides: "Thinned operating-rules file — rules + pointers only"
      contains: "## When working in specific areas, read the relevant doc first"
    - path: "README.md"
      provides: "Refreshed project structure section matching src/ layout"
      contains: "tailwind.css"
  key_links:
    - from: "CLAUDE.md"
      to: "docs/ARCHITECTURE.md, docs/CONVENTIONS.md"
      via: "doc-routing table links (not inlined dumps)"
      pattern: "docs/ARCHITECTURE.md"
---

<objective>
Close GitHub issue #215: two doc-hygiene fixes.

1. Thin CLAUDE.md — remove the inlined auto-generated Technology Stack / Conventions / Architecture dumps that duplicate docs/ and will drift. Keep rules, workflow, context hygiene, the doc-routing table, and the project brief. Point to the docs instead of copying.
2. Refresh README.md `### Project structure` block — it is stale (lists app.ts, style.css, octo.ts in an old layout) and no longer matches src/ (screens.ts, router.ts, welcome.ts, completion.ts, tailwind.css).

Purpose: Stop documentation drift. CLAUDE.md should be the operating contract, not a copy of generated docs. README structure should reflect reality so contributors can navigate src/.
Output: Updated CLAUDE.md and README.md.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<!-- The blocks to DELETE from CLAUDE.md are wrapped in GSD HTML comment markers: -->
<!-- GSD:stack-start ... GSD:stack-end -->
<!-- GSD:conventions-start ... GSD:conventions-end -->
<!-- GSD:architecture-start ... GSD:architecture-end -->

<!-- The blocks to KEEP as-is (managed/generated, NOT part of the duplicated dump): -->
<!-- GSD:project-start ... GSD:project-end  (the Project brief) -->
<!-- GSD:workflow-start ... GSD:workflow-end (GSD Workflow Enforcement) -->
<!-- GSD:profile-start ... GSD:profile-end  (Developer Profile) -->

<!-- Verified actual src/ tree (find src -type f, 2026-05-31): -->
<!--
src/app.ts            client UI — fetches puzzle, renders clues, handles guesses
src/route-resolver.ts pure route resolver (no side effects/I/O)
src/router.ts         client-side router — history, title, analytics, scroll restoration
src/screens.ts        three-screen state machine (welcome/game/completion) + fade transitions
src/welcome.ts        welcome screen content + Play button
src/completion.ts     completion screen — stats grid, countdown, feedback button
src/date.ts           shared client date helpers (epoch, puzzle-day keying)
src/storage.ts        localStorage helpers (history, prefs)
src/theme.ts          light/dark toggle
src/colours.ts        accent colour picker
src/modals.ts         how-to-play + feedback modals
src/bubbles.ts        correct-answer effect
src/octo.ts           mascot animations
src/tailwind.css      Tailwind styles (replaces the old style.css)
src/types.ts          shared client type definitions
src/global.d.ts       global/window type declarations
src/worker/index.ts   Worker entry — API routes, static page handlers, cron
src/worker/puzzle.ts  puzzle generation (server-only)
src/worker/crypto.ts  AES-GCM token signing for random puzzles
src/worker/puzzles.ts Worker-rendered /puzzles archive page
src/worker/stats.ts   Analytics Engine queries for /stats dashboard
src/worker/date-guard.ts worker-side future-puzzle date guard (+1 day tolerance)
public/               static assets (icons, sprites.svg, manifest.json, sw.js)
index.html            game shell (Vite entry)
-->
</context>

<tasks>

<task type="auto">
  <name>Task 1: Thin CLAUDE.md to rules + pointers</name>
  <files>CLAUDE.md</files>
  <action>
    Delete three inlined auto-generated dump blocks from CLAUDE.md, each bounded by GSD HTML comment markers (delete the markers too):
    - `<!-- GSD:stack-start ... -->` through `<!-- GSD:stack-end -->` (the `## Technology Stack` block)
    - `<!-- GSD:conventions-start ... -->` through `<!-- GSD:conventions-end -->` (the `## Conventions` block)
    - `<!-- GSD:architecture-start ... -->` through `<!-- GSD:architecture-end -->` (the `## Architecture` block)

    These duplicate docs/ARCHITECTURE.md and docs/CONVENTIONS.md and drift over time. The doc-routing table already points to those docs, so no replacement content is needed — the table IS the pointer.

    KEEP exactly as-is (do NOT touch): the header/intro (lines 1–5), `## Rules (non-negotiables)`, `## Workflow`, `## Context hygiene`, `## When working in specific areas, read the relevant doc first` table, the `<!-- GSD:project-start -->`...`<!-- GSD:project-end -->` Project brief block, the `<!-- GSD:workflow-start -->`...`<!-- GSD:workflow-end -->` GSD Workflow Enforcement block, and the `<!-- GSD:profile-start -->`...`<!-- GSD:profile-end -->` Developer Profile block.

    Clean up resulting whitespace: collapse any run of 3+ blank lines left by deletions into a single blank line, and ensure the file ends with exactly one trailing newline. The end-state ordering: intro → Rules → Workflow → Context hygiene → doc-routing table → Project brief → GSD Workflow Enforcement → Developer Profile.
  </action>
  <verify>
    <automated>test $(grep -c 'GSD:stack-start\|GSD:conventions-start\|GSD:architecture-start' CLAUDE.md) -eq 0 && grep -q 'GSD:project-start' CLAUDE.md && grep -q 'GSD:workflow-start' CLAUDE.md && grep -q 'GSD:profile-start' CLAUDE.md && grep -q 'read the relevant doc first' CLAUDE.md && echo PASS</automated>
  </verify>
  <done>The three dump blocks (stack/conventions/architecture) are gone with their markers. Rules, Workflow, Context hygiene, doc-routing table, Project brief, GSD Workflow Enforcement, and Developer Profile all remain. No run of 3+ consecutive blank lines.</done>
</task>

<task type="auto">
  <name>Task 2: Refresh README.md project structure block</name>
  <files>README.md</files>
  <action>
    Replace the fenced code block inside `### Project structure` (currently the stale tree listing app.ts/style.css and missing the redesign files) with an accurate tree matching the verified src/ layout in the context block above.

    Required corrections vs the current stale block:
    - Replace `style.css` with `tailwind.css` (style.css no longer exists).
    - Add the redesign client modules: `screens.ts`, `router.ts`, `route-resolver.ts`, `welcome.ts`, `completion.ts`, `date.ts`, `types.ts`, `global.d.ts`.
    - Add the worker module `date-guard.ts` under `worker/`.
    - Keep existing accurate entries: app.ts, storage.ts, theme.ts, colours.ts, modals.ts, bubbles.ts, octo.ts, worker/index.ts, worker/puzzle.ts, worker/crypto.ts, worker/puzzles.ts, worker/stats.ts, public/, index.html.

    Use the one-line descriptions from the verified context block. Group worker/ files together under the worker/ folder and client modules at the src/ root, matching the existing block's two-level indentation style. Do NOT change any other README section (How it works, Tech stack, Puzzle generation, Design system, etc.) — only the fenced tree inside `### Project structure`.
  </action>
  <verify>
    <automated>grep -q 'tailwind.css' README.md && grep -q 'screens.ts' README.md && grep -q 'router.ts' README.md && grep -q 'welcome.ts' README.md && grep -q 'completion.ts' README.md && grep -q 'date-guard.ts' README.md && ! grep -q 'style.css' README.md && echo PASS</automated>
  </verify>
  <done>The `### Project structure` tree lists every current src/ file with accurate descriptions. style.css is gone, tailwind.css and all redesign modules are present. No other README section changed.</done>
</task>

</tasks>

<verification>
- `grep -c 'GSD:stack-start\|GSD:conventions-start\|GSD:architecture-start' CLAUDE.md` returns 0.
- README structure tree matches `find src -type f` output.
- Doc links intact: every `docs/*.md` reference in CLAUDE.md points to a file that exists in docs/ (ARCHITECTURE, CONVENTIONS, DESIGN-SYSTEM, GIT-WORKFLOW, URL-ARCHITECTURE, DA-REVIEW, SELF-REVIEW, ROADMAP, ROADMAP-ISSUES all present).
- This is a multi-file doc change >30 lines → DA review + self-review gates apply before PR (per CLAUDE.md rules).
</verification>

<success_criteria>
- CLAUDE.md contains no duplicated architecture/conventions/stack content — only rules + pointers.
- README `### Project structure` matches the actual src/ tree.
- No broken doc links in either file.
- Managed sections (Project brief, GSD Workflow Enforcement, Developer Profile) preserved as-is.
</success_criteria>

<output>
Create `.planning/quick/260531-qjn-docs-cleanup-thin-claude-md-to-rules-poi/260531-qjn-SUMMARY.md` when done.
</output>
