import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Build-output assertion for the SW precache list.
//
// Precondition: a production build must have run (`npm run build`) before these
// tests execute. If dist/client/sw.js is absent the tests are skipped with a
// warning so `npm test` stays green on a clean checkout. CI/QA must build first.
//
// Assertions when the built sw.js is present:
//   1. The __PRECACHE_ASSETS__ token was fully replaced (no stale marker left).
//   2. STATIC_ASSETS contains at least one /assets/index-*.js and one /assets/index-*.css.
//   3. Every /assets/* path found in the built index.html is present in sw.js (parity).

const REPO_ROOT = resolve(__dirname, '..');
const SW_PATH = resolve(REPO_ROOT, 'dist/client/sw.js');
const INDEX_PATH = resolve(REPO_ROOT, 'dist/client/index.html');

const swExists = existsSync(SW_PATH);

describe('sw-precache build-output assertions (BVA-PWA-01)', () => {
  if (!swExists) {
    it.skip('dist/client/sw.js not found — run `npm run build` before this test suite', () => {});
    return;
  }

  const swContent = readFileSync(SW_PATH, 'utf-8');
  const indexContent = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf-8') : '';

  it('built sw.js is syntactically valid JavaScript', () => {
    // Guards against a malformed precache injection (e.g. a missing comma
    // between STATIC_ASSETS entries) shipping a SW that fails to parse — which
    // breaks registration entirely, worse than the bug being fixed. new Function
    // parses the source without executing it, so it throws on a syntax error.
    expect(() => new Function(swContent)).not.toThrow();
  });

  it('__PRECACHE_ASSETS__ token is fully replaced in built sw.js', () => {
    expect(swContent).not.toContain('__PRECACHE_ASSETS__');
  });

  it('built sw.js STATIC_ASSETS contains at least one hashed /assets/index-*.js bundle', () => {
    expect(swContent).toMatch(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
  });

  it('built sw.js STATIC_ASSETS contains at least one hashed /assets/index-*.css bundle', () => {
    expect(swContent).toMatch(/\/assets\/index-[A-Za-z0-9_-]+\.css/);
  });

  it('every /assets/* path in built index.html is present in built sw.js (parity)', () => {
    const indexAssets = [...new Set((indexContent.match(/\/assets\/[^"' ]+\.(?:js|css)/g) ?? []))];
    expect(indexAssets.length).toBeGreaterThan(0);
    for (const assetPath of indexAssets) {
      expect(swContent, `sw.js is missing ${assetPath} referenced in index.html`).toContain(assetPath);
    }
  });
});
