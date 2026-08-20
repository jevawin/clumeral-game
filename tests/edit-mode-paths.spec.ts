import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A1 — the two generated paths must be gitignored, and edit-mode source must be
// excluded from Tailwind's scan.
//
// Why this is the FIRST task rather than a tidy-up (plan D6, brief items 12, 59,
// 108): Tailwind v4 scans everything git does not ignore, so a generated class
// list left in the working tree puts EVERY class in the project into the
// production stylesheet. Observed while planning: an un-ignored 8,397-line list
// took the production sheet from 51,218 bytes to 1,412,751 in one build.
//
// The same mechanism applies to class-name literals in edit-mode source and its
// tests, which land in the next commit. Both guards have to exist before that
// code does, or the first commit of Stage A ships the leak.

const REPO_ROOT = resolve(__dirname, '..');

/** git's own answer, not a substring search of .gitignore. A rule can be present
 *  and still not match — trailing slashes, negations and ordering all bite. */
function isIgnored(path: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '-q', '--', path], { cwd: REPO_ROOT });
    return true;
  } catch {
    return false;
  }
}

describe('edit-mode generated paths are gitignored (A1)', () => {
  it('ignores the generated class list', () => {
    expect(isIgnored('.edit-mode/classlist.txt')).toBe(true);
  });

  it('ignores the generated family map', () => {
    expect(isIgnored('.edit-mode/families.json')).toBe(true);
  });

  it('ignores written session files', () => {
    expect(isIgnored('.edit-sessions/2026-08-19T22-41-07-221Z.json')).toBe(true);
  });

  it('does not ignore the committed edit-mode source', () => {
    // src/edit-mode/ and edit-mode/ are real, committed code. If a broad rule
    // ever swallows them the build silently loses the overlay.
    expect(isIgnored('src/edit-mode/overlay.ts')).toBe(false);
    expect(isIgnored('edit-mode/plugin.ts')).toBe(false);
  });
});

describe('edit-mode source is excluded from the Tailwind scan (A1)', () => {
  const css = readFileSync(resolve(REPO_ROOT, 'src/tailwind.css'), 'utf-8');

  // Paths are relative to the stylesheet, which lives in src/.
  const REQUIRED = ['"./edit-mode"', '"../edit-mode"', '"../tests"'];

  for (const target of REQUIRED) {
    it(`excludes ${target} from source detection`, () => {
      expect(css).toContain(`@source not ${target};`);
    });
  }
});
