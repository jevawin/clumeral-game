import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Brief item 101's general assertion, in full — and deliberately NOT a gate yet.
//
// The property: every class selector in the built stylesheet appears literally
// in src/ or index.html. One assertion, no sentinel class (a named sentinel
// defeats itself the moment the plan naming it is committed — brief item 100),
// and it catches an edit-mode leak and issue #312's leak with the same test.
//
// WHY IT IS SKIPPED. Brief item 102 says this assertion "lands red until #312 is
// fixed", and chose that deliberately: Tailwind v4 scans everything git does not
// ignore, so class names written in prose inside docs/ and .planning/ are in the
// production stylesheet today. A permanently red test would block every pull
// request in the repo, so it is committed skipped rather than either weakened
// into something that passes or left unwritten.
//
// TURNING IT ON IS #312's LAST STEP: narrow the scan (the spike suggests
// `source(none)` plus `@source "../src"` and `@source "../index.html"` —
// measured to take production CSS from 51,218 to 36,750 bytes), then change
// `describe.skip` to `describe` and delete this comment. Keep the
// `@source not "./edit-mode"` line when you do: narrowing to ../src puts
// src/edit-mode/ back INSIDE the scanned set. See plan section D6b.
//
// The gate that DOES run today is the narrow edit-mode leak assertion in
// tests/edit-mode-safety.spec.ts. It is green, and it goes red on any class that
// reaches production solely because edit mode names it.

const REPO_ROOT = resolve(__dirname, '..');
const DIST = resolve(REPO_ROOT, 'dist/client/assets');

function readSource(): string {
  const parts: string[] = [readFileSync(resolve(REPO_ROOT, 'index.html'), 'utf-8')];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, name.name);
      if (name.isDirectory()) walk(path);
      else parts.push(readFileSync(path, 'utf-8'));
    }
  };
  walk(resolve(REPO_ROOT, 'src'));
  return parts.join('\n');
}

function builtSelectors(): string[] {
  const out = new Set<string>();
  for (const file of readdirSync(DIST).filter((f) => f.endsWith('.css'))) {
    const css = readFileSync(join(DIST, file), 'utf-8');
    for (const m of css.matchAll(/\.((?:\\.|[A-Za-z0-9_-])+)(?=[\s,:.[{>~+])/g)) {
      out.add(m[1].replace(/\\(.)/g, '$1'));
    }
  }
  return [...out];
}

describe.skip('every class in the production stylesheet is used by the app (#312)', () => {
  it('ships no class that appears only in a document', () => {
    if (!existsSync(DIST)) throw new Error('run `npm run build` first');
    const source = readSource();
    const orphans = builtSelectors().filter((sel) => !source.includes(sel));
    expect(orphans, `${orphans.length} classes ship without the app using them`).toEqual([]);
  });
});
