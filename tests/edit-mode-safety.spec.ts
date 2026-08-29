import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

// A4 — edit mode is absent from every deployed artefact.
//
// Asserted against BUILT OUTPUT, never a config flag (Jamie, 2026-08-18 and
// 2026-08-19; brief item 7). A config flag is a promise; a built file is a fact.
//
// Two artefacts, because preprod is not the same build command:
//   production  npm install && npm run build
//   preprod     CLOUDFLARE_ENV=preprod npm run build && …versions upload
// Measured 2026-08-19: CLOUDFLARE_ENV changes bindings and vars only — the
// client CSS and JS come out byte-identical. This spec is what keeps that true.
//
// Precondition: both builds must have run. CI does it in ci-smoke.yml before
// `npm test`. Missing directories skip loudly rather than passing quietly.

const REPO_ROOT = resolve(__dirname, '..');
const PROD = resolve(REPO_ROOT, 'dist');
const PREPROD = resolve(REPO_ROOT, 'dist-preprod');

/** Every file under a directory, recursively, as absolute paths. */
function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

function readAll(dir: string): { path: string; text: string }[] {
  return walk(dir)
    .filter((p) => /\.(js|css|html|json)$/.test(p))
    .map((p) => ({ path: p.slice(dir.length + 1), text: readFileSync(p, 'utf-8') }));
}

/** Class-shaped tokens in a file: the things Tailwind's scanner would find. */
function classTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/['"`]([-a-z0-9:/[\]().]+)['"`]/gi)) {
    const token = m[1];
    // Utility-shaped: has a dash or a colon, no spaces, not a path or a URL.
    if (!/^-?[a-z]/.test(token)) continue;
    if (token.includes('/') || token.includes('.')) continue;
    if (token.length < 3 || token.length > 40) continue;
    if (!token.includes('-') && !token.includes(':')) continue;
    out.add(token);
  }
  return out;
}

/** Selectors in a built stylesheet, unescaped. */
function selectors(css: string): Set<string> {
  const out = new Set<string>();
  for (const m of css.matchAll(/\.((?:\\.|[A-Za-z0-9_-])+)(?=[\s,:.[{>~+])/g)) {
    out.add(m[1].replace(/\\(.)/g, '$1'));
  }
  return out;
}

const prodBuilt = existsSync(PROD) && walk(PROD).length > 0;

describe('edit mode is absent from the production artefact (brief item 7)', () => {
  if (!prodBuilt) {
    it.skip('dist/ not found — run `npm run build` before this suite', () => {});
    return;
  }

  const files = readAll(PROD);

  it('ships no edit-mode stylesheet', () => {
    for (const f of files) {
      expect(f.path, `${f.path} looks like an edit-mode stylesheet`).not.toContain('tailwind-edit');
    }
  });

  it('names no edit-mode module', () => {
    for (const f of files) {
      expect(f.text, `${f.path} references edit-mode source`).not.toContain('src/edit-mode/');
      expect(f.text, `${f.path} references the session directory`).not.toContain('.edit-sessions');
    }
  });

  it('contains none of the overlay strings a user would see', () => {
    // Pinned as STRING LITERALS, not module paths. Production JS is minified and
    // bundled — paths and identifiers are gone, so asserting on them would pass
    // even with the overlay bundled in. Copy survives minification.
    const OVERLAY_COPY = [
      'Nothing on the scale matches.',
      'Search classes',
      'That class is not in this build.',
      'Reset element',
    ];
    for (const f of files.filter((x) => x.path.endsWith('.js'))) {
      for (const phrase of OVERLAY_COPY) {
        expect(f.text, `${f.path} contains overlay copy: ${phrase}`).not.toContain(phrase);
      }
    }
  });
});

describe('the edit-mode leak gate (plan D6, D7)', () => {
  if (!prodBuilt) {
    it.skip('dist/ not found — run `npm run build` before this suite', () => {});
    return;
  }

  it('ships no class that exists only because edit mode names it', () => {
    // Tailwind v4 scans every file git does not ignore, so a class literal in
    // edit-mode source or its tests would land in the PRODUCTION stylesheet.
    // The three `@source not` lines in src/tailwind.css are what stop it; this
    // is the test that goes red if they are ever removed.
    //
    // Deliberately narrow: a class is a leak only if EDIT MODE IS THE ONLY
    // REASON it is there. A class the app uses is in the sheet on the app's
    // account; a class a document mentions is in the sheet on issue #312's
    // account, which brief item 12 puts out of scope for this branch. Both are
    // subtracted, or this test reports #312's debt as edit mode's and lands red
    // on work it does not own.
    const editModeSource = [
      ...readAll(resolve(REPO_ROOT, 'edit-mode')),
      ...readAll(resolve(REPO_ROOT, 'src/edit-mode')),
      ...walk(resolve(REPO_ROOT, 'tests'))
        .filter((p) => /edit-mode-.*\.spec\.ts$/.test(p))
        .map((p) => ({ path: p, text: readFileSync(p, 'utf-8') })),
    ];
    const editModeTokens = new Set<string>();
    for (const f of editModeSource) for (const t of classTokens(f.text)) editModeTokens.add(t);

    // Everything else Tailwind scans: the app itself, plus the documents and
    // planning notes that #312 has not narrowed away yet.
    const isEditModeFile = (p: string) =>
      p.includes('/edit-mode/') || /edit-mode-.*\.spec\.ts$/.test(p);
    const otherText = ['src', 'docs', '.planning', 'e2e', 'scripts']
      .flatMap((dir) => walk(resolve(REPO_ROOT, dir)))
      .filter((p) => !isEditModeFile(p))
      .map((p) => {
        try { return readFileSync(p, 'utf-8'); } catch { return ''; }
      })
      .join('\n') + readFileSync(resolve(REPO_ROOT, 'index.html'), 'utf-8');

    const cssFiles = readAll(PROD).filter((f) => f.path.endsWith('.css'));
    expect(cssFiles.length, 'no built CSS found').toBeGreaterThan(0);

    const shipped = new Set<string>();
    for (const f of cssFiles) for (const sel of selectors(f.text)) shipped.add(sel);

    const leaked = [...editModeTokens].filter(
      (token) => shipped.has(token) && !otherText.includes(token)
    );
    expect(leaked, `these classes reached production only via edit-mode source: ${leaked.join(', ')}`)
      .toEqual([]);
  });
});

describe('preprod deploys the same artefact (plan D8)', () => {
  const preprodBuilt = existsSync(PREPROD) && walk(PREPROD).length > 0;

  if (!prodBuilt || !preprodBuilt) {
    it.skip('needs both dist/ and dist-preprod/ — see ci-smoke.yml', () => {});
    return;
  }

  it('produces byte-identical client assets', () => {
    // If CLOUDFLARE_ENV ever starts changing emitted code, the single set of
    // absence assertions above stops covering both environments, and this is
    // what says so.
    const prod = readAll(resolve(PROD, 'client/assets'));
    const pre = readAll(resolve(PREPROD, 'client/assets'));
    expect(pre.map((f) => f.path).sort()).toEqual(prod.map((f) => f.path).sort());
    for (const f of prod) {
      const other = pre.find((x) => x.path === f.path);
      expect(other?.text, `client asset differs between environments: ${f.path}`).toBe(f.text);
    }
  });

  it('produces byte-identical Worker code', () => {
    const prod = readFileSync(resolve(PROD, 'clumeral_game/index.js'), 'utf-8');
    const pre = readFileSync(resolve(PREPROD, 'clumeral_game/index.js'), 'utf-8');
    expect(pre).toBe(prod);
  });

  it('differs only in the wrangler config, and differs there on purpose', () => {
    // The bindings and vars SHOULD differ — separate D1 databases, ENVIRONMENT,
    // and no crons on preprod. Asserting that keeps "identical everywhere else"
    // meaningful rather than vacuous.
    const prod = JSON.parse(readFileSync(resolve(PROD, 'clumeral_game/wrangler.json'), 'utf-8'));
    const pre = JSON.parse(readFileSync(resolve(PREPROD, 'clumeral_game/wrangler.json'), 'utf-8'));
    expect(prod.vars.ENVIRONMENT).toBe('production');
    expect(pre.vars.ENVIRONMENT).toBe('preprod');
    expect(pre.triggers.crons).toEqual([]);
  });

  it('keeps edit mode out of the preprod artefact too', () => {
    for (const f of readAll(PREPROD)) {
      expect(f.path).not.toContain('tailwind-edit');
      expect(f.text, `${f.path}`).not.toContain('src/edit-mode/');
    }
  });
});
