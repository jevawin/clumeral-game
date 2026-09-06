import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rewriteIndexHtml, EDIT_STYLESHEET, OVERLAY_ENTRY } from '../edit-mode/html.ts';

// A2 — the dev-server HTML rewrite (plan A2, brief items 56, 60).
//
// The committed index.html carries NO edit-mode markup. The plugin swaps the
// stylesheet link when serving, so nothing in the repo names edit mode and there
// is no dev-only condition for a bundler to strip.

const INDEX = readFileSync(resolve(__dirname, '..', 'index.html'), 'utf-8');

describe('the stylesheet swap (brief item 56)', () => {
  it('swaps the production stylesheet for the edit build', () => {
    const out = rewriteIndexHtml(INDEX);
    expect(out).toContain(EDIT_STYLESHEET);
    expect(out).not.toContain('href="/src/tailwind.css"');
  });

  it('changes nothing else about the page', () => {
    // One href swapped and one script tag added — nothing else touched, so the
    // dev server is the real page rather than an approximation of it.
    const out = rewriteIndexHtml(INDEX);
    expect(out).toContain('<title>Clumeral</title>');
    expect(out).toContain('data-fb-modal');
    expect(out).toContain('/src/app.ts');
    expect(out.length - INDEX.length).toBeLessThan(200);
  });

  it('keeps the onerror reload guard on the swapped link', () => {
    // index.html's stylesheet link carries a reload guard for a failed asset
    // fetch. Dropping it while swapping would remove a production safety net
    // from the dev server, and it would only show up on a bad load.
    expect(rewriteIndexHtml(INDEX)).toContain('__clumeralReloadGuard');
  });

  it('is a no-op on HTML that does not link the stylesheet', () => {
    expect(rewriteIndexHtml('<html></html>')).toBe('<html></html>');
  });
});

describe('the overlay script (plan D2, D4, finding L3)', () => {
  it('is injected', () => {
    expect(rewriteIndexHtml(INDEX)).toContain(OVERLAY_ENTRY);
  });

  it('goes BEFORE the app entry', () => {
    // Load-bearing rather than tidy: for listeners on the same target the DOM
    // runs them in REGISTRATION order regardless of phase. Registering first is
    // what lets edit mode take a keypress before app.ts sees it, and take back
    // before the router re-renders.
    const out = rewriteIndexHtml(INDEX);
    const overlayAt = out.indexOf(OVERLAY_ENTRY);
    const appAt = out.indexOf('/src/app.ts');
    expect(overlayAt).toBeGreaterThan(-1);
    expect(appAt).toBeGreaterThan(-1);
    expect(overlayAt).toBeLessThan(appAt);
  });

  it('carries the branch, which the browser cannot know', () => {
    // The session store is keyed to it: restoring one branch's patch set
    // against another's markup would apply edits to whatever happened to match.
    expect(rewriteIndexHtml(INDEX, { branch: 'dev/edit-mode-roundtrip' }))
      .toContain('data-branch="dev/edit-mode-roundtrip"');
  });

  it('does not let a branch name break out of the attribute', () => {
    const out = rewriteIndexHtml(INDEX, { branch: 'dev/"><script>bad()</script>' });
    expect(out).not.toContain('<script>bad()');
  });
});

describe('the committed index.html stays clean (brief item 60)', () => {
  it('names nothing to do with edit mode', () => {
    expect(INDEX).not.toContain('edit-mode');
    expect(INDEX).not.toContain('tailwind-edit');
  });
});
