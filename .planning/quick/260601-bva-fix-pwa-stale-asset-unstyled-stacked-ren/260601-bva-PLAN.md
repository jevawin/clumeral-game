---
phase: quick-260601-bva
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - public/sw.js
  - vite.config.ts
  - index.html
  - tests/sw-precache.spec.ts
  - e2e/pwa-render.spec.ts
autonomous: true
requirements: [BVA-PWA-01]
must_haves:
  truths:
    - "A freshly-activated service worker precaches the exact JS/CSS bundles that index.html references."
    - "If a static-asset network fetch fails on resume, the SW serves the cached bundle instead of rejecting."
    - "If the main module or stylesheet fails to load, the page forces exactly one recovery reload, never a loop."
    - "After a deploy + PWA resume, the app renders one styled screen, not three stacked unstyled screens."
  artifacts:
    - path: public/sw.js
      provides: "Precache placeholder token + catch-fallback static handler"
      contains: "__PRECACHE_ASSETS__"
    - path: vite.config.ts
      provides: "Post-build injection of emitted bundle paths into sw.js precache list"
      contains: "__PRECACHE_ASSETS__"
    - path: index.html
      provides: "Capped inline onerror reload guard wired to module script + stylesheet"
      contains: "sessionStorage"
    - path: tests/sw-precache.spec.ts
      provides: "Build-output assertion: built sw.js precache list is non-empty and contains hashed bundles"
    - path: e2e/pwa-render.spec.ts
      provides: "Playwright e2e: SW registers, single styled screen renders (not stacked)"
  key_links:
    - from: vite.config.ts
      to: dist/client/sw.js
      via: "read dist/client/index.html asset refs, replace __PRECACHE_ASSETS__"
      pattern: "__PRECACHE_ASSETS__"
    - from: index.html
      to: "/src/app.ts module + /src/tailwind.css"
      via: "onerror handlers call the inline reload guard"
      pattern: "onerror"
---

<objective>
Fix the iOS PWA stale-asset / unstyled-stacked-render bug that appears on resume after a new deploy.

Root cause (verified): on resume after a deploy, the SW fetches fresh index.html referencing NEW content-hashed bundles, then on `activate` deletes the old cache. STATIC_ASSETS never includes the JS/CSS bundles, so the new cache is empty of them. The static-asset handler is `return cached || fetched` with no catch fallback; an iOS resume network blip makes the bundle fetch reject, so CSS + JS never load. With no CSS, the Tailwind `hidden` class is inert and all three `data-screen` sections render stacked and unstyled.

Apply three targeted levers — do NOT replan the SW architecture:
1. Precache the emitted bundles (the real fix).
2. Add a `.catch` fallback to the static-asset handler (defensive).
3. Add a capped inline onerror reload guard in index.html (last-resort recovery).

Purpose: PWA users get the new working build on resume, not a broken stacked render.
Output: Updated sw.js, vite.config.ts, index.html, plus a build-output unit test and a Playwright render e2e.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md

# Git rules (from CLAUDE.md): never commit to main/staging/new-design. Work on the
# already-created branch fix/pwa-stale-asset-resume. Do NOT create another branch.
# Never run wrangler deploy / npm run deploy.

<interfaces>
<!-- Exact current state of the files being changed. Use directly — no exploration needed. -->

public/sw.js (current, 84 lines):
```js
const CACHE_NAME = 'clumeral-__BUILD_HASH__';
const STATIC_ASSETS = [
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
  '/sprites.svg'
];
// install: caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(skipWaiting)
// activate: delete all caches != CACHE_NAME, clients.claim(), postMessage SW_UPDATED
// fetch: navigate => network-first (has .catch(caches.match)); /api/ => network-only;
//        same-origin => stale-while-revalidate => `return cached || fetched;` (NO catch)
//        external => network-first (has .catch)
```

The stale-while-revalidate branch to change (sw.js ~lines 57-67):
```js
if (url.origin === self.location.origin) {
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return res;
      });
      return cached || fetched;
    })
  );
  return;
}
```

vite.config.ts — existing sw-cache-bust plugin (the hook to extend):
```ts
{
  name: "sw-cache-bust",
  writeBundle(options) {
    const outDir = options.dir || "dist/client";
    const swPath = resolve(outDir, "sw.js");
    try {
      const content = readFileSync(swPath, "utf-8");
      writeFileSync(swPath, content.replace("__BUILD_HASH__", buildHash));
    } catch {
      // sw.js may not exist in server bundle
    }
  },
}
```
NOTE: There is NO Vite manifest configured. The reliable bundle source is the emitted
`dist/client/index.html`, which references exactly `/assets/index-<hash>.js` and
`/assets/index-<hash>.css`. The writeBundle hook fires once per bundle (client + server);
the client run has both sw.js and index.html present in outDir.

index.html — the existing inline <script> block (placement reference, lines 32-38, in <head>):
```html
<link rel="stylesheet" href="/src/tailwind.css" />
<script>
  (function () {
    var t = localStorage.getItem("dlng_theme");
    if (!t) t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.classList.add(t);
  })();
</script>
```
The module script is the last line before </body> (line 307):
```html
<script type="module" src="/src/app.ts"></script>
```
The three screens that stack when CSS fails (lines 185, 189, 277):
`<section data-screen="welcome" class="hidden ...">`, `data-screen="game"`, `data-screen="completion"` — all rely on Tailwind `hidden` (display:none).

SW registration (src/app.ts:757-769) and worker no-store header for /sw.js
(src/worker/index.ts:293-298) already exist — do NOT change them.

Playwright config: e2e runs against the PRODUCTION build via `npm run preview`
(vite build && vite preview --port 4173), baseURL http://localhost:4173,
reuseExistingServer:false. e2e specs live in ./e2e, use `page.goto("/welcome")`
and `expect(locator).toBeVisible()`. Unit tests live in ./tests, run via `vitest run`.
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1 (Lever 1): Precache emitted bundles via build-step injection</name>
  <files>public/sw.js, vite.config.ts</files>
  <action>
In public/sw.js, add a precache placeholder so the build can inject the real bundle
paths. Add a new line inside the STATIC_ASSETS array immediately after `'/sprites.svg'`
containing exactly the token `__PRECACHE_ASSETS__` (no quotes around the token — the
build step replaces the whole token with one or more quoted, comma-separated path
literals). Keep all existing static entries (favicon, icons, manifest, sprites). The
default (unbuilt) value must NOT crash the SW if it ever ships unreplaced: make the
placeholder a standalone comment-safe sentinel. Concretely: leave the array as
`'/sprites.svg', __PRECACHE_ASSETS__` and have the build step ALWAYS run on every
client build so the token is replaced before ship; the build-output test (Task 4)
guards against an unreplaced token reaching dist.

In vite.config.ts, extend the existing `sw-cache-bust` writeBundle hook (do NOT add a
second plugin). After the existing `__BUILD_HASH__` replacement, discover the emitted
bundle paths by reading `dist/client/index.html` from the same `outDir`:
- Read the emitted index.html (resolve(outDir, "index.html")).
- Extract every `/assets/*.js` and `/assets/*.css` reference with a regex
  (e.g. match `/assets/[^"']+\.(?:js|css)`), dedupe into an array.
- Build a replacement string: each path wrapped in single quotes, joined by `, `.
- Replace the `__PRECACHE_ASSETS__` token in the sw.js content with that string,
  in the same writeFileSync pass as the hash replacement.

Resilience (REQUIRED — must not silently ship an empty precache list): if index.html
is missing OR zero asset paths are discovered, throw an Error from the hook with a
clear message (e.g. "sw-cache-bust: no /assets bundles found in index.html — refusing
to ship an empty precache list"). This fails the build loud rather than shipping a
broken SW. Keep the existing try/catch ONLY for the "sw.js absent in server bundle"
case (the server writeBundle run has no sw.js) — distinguish: if sw.js is absent, skip
quietly (existing behaviour); if sw.js IS present but bundles are not discoverable,
throw. Implement by checking sw.js existence first and only running discovery + the
throw-on-empty path when sw.js exists.
  </action>
  <verify>
    <automated>npm run build && grep -E "/assets/index-[A-Za-z0-9_-]+\.js" dist/client/sw.js && grep -E "/assets/index-[A-Za-z0-9_-]+\.css" dist/client/sw.js && ! grep -q "__PRECACHE_ASSETS__" dist/client/sw.js</automated>
  </verify>
  <done>Built dist/client/sw.js STATIC_ASSETS contains the exact hashed /assets/*.js and /assets/*.css paths that dist/client/index.html references, the __PRECACHE_ASSETS__ token is fully replaced, existing static entries remain, and a build with no discoverable bundles fails loud.</done>
</task>

<task type="auto">
  <name>Task 2 (Lever 2): Catch fallback on the static-asset handler</name>
  <files>public/sw.js</files>
  <action>
In the stale-while-revalidate branch of the fetch handler (the `if (url.origin ===
self.location.origin)` block), make the network fetch resilient. Add
`.catch(() => caches.match(e.request))` to the `fetched` promise so a failed network
fetch resolves to the cached response instead of rejecting. Preserve cache-first
behaviour: still `return cached || fetched`, so when a cached copy exists it is served
immediately, and only when there is no cache do we await the network — and if that
network fetch fails, the catch yields whatever is cached (possibly undefined, matching
prior worst case, but now bundles ARE precached by Lever 1 so the cache hit is the
normal path). Do not change the navigate, /api/, or external branches.
  </action>
  <verify>
    <automated>node -e "const s=require('fs').readFileSync('public/sw.js','utf8'); const b=s.slice(s.indexOf('Stale-while-revalidate')); if(!/\.catch\(\(\)\s*=>\s*caches\.match\(e\.request\)\)/.test(b)) {console.error('no catch fallback in SWR branch');process.exit(1)} if(!/return cached \|\| fetched/.test(b)){console.error('cache-first return missing');process.exit(1)} console.log('ok')"</automated>
  </verify>
  <done>The same-origin static-asset handler returns cached first and, on a network fetch failure, falls back to the cached response via .catch; other fetch branches unchanged.</done>
</task>

<task type="auto">
  <name>Task 3 (Lever 3): Capped inline onerror reload guard in index.html</name>
  <files>index.html</files>
  <action>
Add a small inline reload guard so a failed bundle load self-recovers once. Place a new
inline `<script>` in `<head>` BEFORE the module script — put it right after the existing
theme inline-script block (after line 38, still inside head), so the guard function is
defined before any onerror could fire. The guard:
- Define a global function (e.g. `window.__clumeralReloadGuard`) that, on call, reads a
  sessionStorage counter key (e.g. `clumeral_asset_reload`). If the counter is < 1,
  increment it and call `location.reload()` (force one reload). If it is already >= 1,
  do nothing (cap = one reload, can never loop).
- Reset the cap on a SUCCESSFUL load: add a `window.addEventListener('load', ...)` (or a
  small DOMContentLoaded/load handler) that, once the page has loaded successfully,
  removes the sessionStorage counter key — so a genuine failure on a LATER resume can
  still trigger one fresh reload. (A successful module execution implies CSS+JS loaded.)

Wire the triggers:
- On the stylesheet link `<link rel="stylesheet" href="/src/tailwind.css" />` add
  `onerror="window.__clumeralReloadGuard && window.__clumeralReloadGuard()"`.
- On the module script `<script type="module" src="/src/app.ts">` add the same
  `onerror="window.__clumeralReloadGuard && window.__clumeralReloadGuard()"`.

Keep the guard tiny and dependency-free (vanilla, ES2022-safe, IIFE-wrapped like the
existing theme script). Do not touch the theme inline script's behaviour.
  </action>
  <verify>
    <automated>node -e "const h=require('fs').readFileSync('index.html','utf8'); const checks=[/__clumeralReloadGuard/, /sessionStorage/, /onerror=\"window\.__clumeralReloadGuard/, /addEventListener\(['\"]load['\"]/]; const bad=checks.filter(r=>!r.test(h)); if(bad.length){console.error('missing:',bad.map(String));process.exit(1)} const onerr=(h.match(/onerror=\"window\.__clumeralReloadGuard/g)||[]).length; if(onerr<2){console.error('expected onerror on both link and module script, got',onerr);process.exit(1)} console.log('ok')"</automated>
  </verify>
  <done>index.html defines a sessionStorage-capped reload guard before the module script, wires it to both the stylesheet link and module script onerror, resets the cap on successful load, and the existing theme script is untouched.</done>
</task>

<task type="auto">
  <name>Task 4 (QA): Build-output assertion + Playwright render e2e</name>
  <files>tests/sw-precache.spec.ts, e2e/pwa-render.spec.ts</files>
  <action>
Keep QA light and targeted — this is SW caching logic that affects all users, but full
iOS SW-update simulation is impractical in Playwright. Deliver two cheap, high-signal
checks.

(a) tests/sw-precache.spec.ts (vitest, runs in `npm test`): a build-output assertion.
The test reads the BUILT `dist/client/sw.js` (path from repo root). Precondition: the
test assumes a build has run; if `dist/client/sw.js` is absent, skip with a clear
message OR fail with guidance to run `npm run build` first — prefer skip-with-warning so
`npm test` stays green on a clean checkout, but document that CI/QA must build first.
Assertions when present: (1) the file does NOT contain the literal `__PRECACHE_ASSETS__`
(token was replaced); (2) the STATIC_ASSETS list contains at least one
`/assets/index-*.js` and one `/assets/index-*.css` entry matching the hashed pattern;
(3) every `/assets/*` path found in the built `dist/client/index.html` is present in the
built sw.js (parity — the SW precaches exactly what the HTML references). Use plain
fs.readFileSync + regex; no new deps.

(b) e2e/pwa-render.spec.ts (Playwright, runs against the production preview build per
playwright.config.ts): assert the styled SINGLE-screen render and SW registration.
- `await page.goto("/welcome")`.
- Assert the SW registers: `await page.waitForFunction(() => navigator.serviceWorker &&
  navigator.serviceWorker.controller !== null || navigator.serviceWorker.getRegistration)`
  — practically, wait for `navigator.serviceWorker.ready` to resolve
  (use page.evaluate(() => navigator.serviceWorker.ready.then(() => true))).
- Assert ONLY ONE screen is effectively visible (not three stacked): the game digit box
  `[data-digit="0"]` resolves to visible on the active screen, and assert that the
  non-active screens are display:none. Concretely: count `section[data-screen]` elements
  whose computed `display` !== 'none' and assert it is exactly 1 (proves `hidden`/CSS is
  applied — the bug rendered all three in flow). Use page.$$eval over
  `section[data-screen]` reading getComputedStyle(el).display.
- This is the regression oracle for "stacked unstyled" — if CSS fails to load, more than
  one section would be in flow.
Model imports/structure on e2e/octopus-walkthrough.spec.ts (same `test`, `expect`,
baseURL-relative goto).
  </action>
  <verify>
    <automated>npm run build && npm test -- sw-precache && npx playwright test pwa-render</automated>
  </verify>
  <done>`npm test sw-precache` passes (built sw.js precache parity with index.html, no leftover token) and `playwright test pwa-render` passes (SW ready, exactly one data-screen section rendered, not stacked).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| build-time → shipped SW | vite.config.ts injects bundle paths into sw.js; a wrong/empty injection ships a broken cache to all users. |
| client → cache/network | SW decides cached vs network for every same-origin asset on resume. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-bva-01 | Tampering | vite.config.ts precache injection | mitigate | Fail the build loud when zero bundles discovered (Task 1) + Task 4 build-output parity test. |
| T-bva-02 | Denial of Service | index.html reload guard | mitigate | sessionStorage cap = one reload, reset on successful load — cannot loop (Task 3). |
| T-bva-03 | Information Disclosure | SW cache contents | accept | Only public static bundles + icons cached; no PII, no auth tokens, /api/ is network-only. |
| T-bva-SC | Tampering | npm/pip/cargo installs | accept | No new packages — all changes use existing vite/fs and existing vitest/playwright deps. |
</threat_model>

<verification>
- `npm run build` succeeds and dist/client/sw.js precaches the exact hashed bundles index.html references (no `__PRECACHE_ASSETS__` left).
- `npm test` passes (existing suite + new sw-precache build-output test).
- `npx playwright test pwa-render` passes (SW registers, single styled screen, not stacked).
- Manual iOS verification note (cannot be automated): after merge to new-design + deploy, install the PWA to home screen, background it, deploy a new build, resume — the app must show the styled single screen, not three stacked unstyled screens.
</verification>

<success_criteria>
- Freshly-activated SW precaches the JS/CSS bundles its HTML references (Lever 1).
- Static-asset handler falls back to cache on a failed network fetch (Lever 2).
- A failed bundle load forces exactly one capped recovery reload (Lever 3).
- Build fails loud if no bundles are discovered (no silent empty precache).
- QA: build-output parity test + Playwright single-screen render test both green.
- Four atomic commits scoped `(260601-bva)`: Lever 1, Lever 2, Lever 3, QA.
- No changes to worker /sw.js headers or src/app.ts SW registration. No branch creation. No deploy.
</success_criteria>

<output>
Create `.planning/quick/260601-bva-fix-pwa-stale-asset-unstyled-stacked-ren/260601-bva-SUMMARY.md` when done.
</output>
