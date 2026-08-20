import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rewriteIndexHtml, EDIT_STYLESHEETS } from '../edit-mode/html.ts';

// A2 — the dev-server HTML rewrite (plan A2, brief items 56, 60).
//
// The committed index.html carries NO edit-mode markup. The plugin swaps the
// stylesheet link when serving, so nothing in the repo names edit mode and there
// is no dev-only condition for a bundler to strip.

const INDEX = readFileSync(resolve(__dirname, '..', 'index.html'), 'utf-8');

describe('the stylesheet swap (brief item 56)', () => {
  it('swaps the production stylesheet for the non-colour edit build', () => {
    const out = rewriteIndexHtml(INDEX, { set: 'non-colour' });
    expect(out).toContain(EDIT_STYLESHEETS['non-colour']);
    expect(out).not.toContain('href="/src/tailwind.css"');
  });

  it('swaps it for the full build when asked', () => {
    const out = rewriteIndexHtml(INDEX, { set: 'all' });
    expect(out).toContain(EDIT_STYLESHEETS.all);
    expect(out).not.toContain('href="/src/tailwind.css"');
  });

  it('changes nothing else about the page', () => {
    const out = rewriteIndexHtml(INDEX, { set: 'non-colour' });
    // Same document, one attribute different.
    expect(out.length).toBeCloseTo(INDEX.length, -2);
    expect(out).toContain('<title>Clumeral</title>');
    expect(out).toContain('data-fb-modal');
  });

  it('keeps the onerror reload guard on the swapped link', () => {
    // index.html's stylesheet link carries a reload guard for a failed asset
    // fetch. Dropping it while swapping would remove a production safety net
    // from the dev server, and the difference would only show up on a bad load.
    const out = rewriteIndexHtml(INDEX, { set: 'non-colour' });
    expect(out).toContain('__clumeralReloadGuard');
  });

  it('is a no-op on HTML that does not link the stylesheet', () => {
    expect(rewriteIndexHtml('<html></html>', { set: 'all' })).toBe('<html></html>');
  });
});

describe('the overlay script is NOT injected yet (plan A2)', () => {
  it('injects no script tag, because src/edit-mode/overlay.ts does not exist', () => {
    // Injecting it here would 404 on every page load and log a module error
    // during the A3 iPhone measurement — the one task that has to work. C3
    // starts injecting it, once there is something to inject.
    const out = rewriteIndexHtml(INDEX, { set: 'non-colour' });
    expect(out).not.toContain('edit-mode/overlay');
  });
});

describe('the committed index.html stays clean (brief item 60)', () => {
  it('names nothing to do with edit mode', () => {
    expect(INDEX).not.toContain('edit-mode');
    expect(INDEX).not.toContain('tailwind-edit');
  });
});
