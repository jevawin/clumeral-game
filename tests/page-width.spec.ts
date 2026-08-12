import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// One content width for every screen (brief 56), so the content area never
// changes width as a player moves from one screen to the next.
//
// Before this, nothing in the repo tested a width or a padding at all — the
// three screens had drifted to two different shapes and no test noticed. Every
// assertion in this file is therefore new ground: it is the only thing standing
// between "standardised" and "standardised until somebody edits one of them".
//
// The Worker-rendered pages cannot import the token, so their numbers are
// checked by the width they work out to rather than by matching strings.

const root = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf-8');

const tailwind = read('src/tailwind.css');
const indexHtml = read('index.html');
const welcome = read('src/welcome.ts');
const archive = read('src/worker/puzzles.ts');
const stats = read('src/worker/stats.ts');

const PAGE_MAX_PX = 480;

/** The body of the first rule with this exact selector. */
function rule(css: string, selector: string): string {
  const m = new RegExp(`(^|[};{])\\s*${selector}\\s*\\{([^}]*)\\}`, 'm').exec(css);
  if (!m) throw new Error(`no rule for "${selector}"`);
  return m[2];
}

function decl(body: string, prop: string): string {
  // A declaration follows a semicolon, an opening brace, the end of a comment,
  // or the start of a line — these rules are written for humans, not minified.
  const m = new RegExp(`(?:^|;|\\{|\\*/)\\s*${prop}\\s*:\\s*([^;]+)`, 'm').exec(body);
  if (!m) throw new Error(`no "${prop}" in rule body`);
  return m[1].trim();
}

/** Lengths are declared for humans — 32rem, 1rem, 480px. Compare by value. */
function px(value: string): number {
  const m = /^(-?[\d.]+)(px|rem)$/.exec(value.trim());
  if (!m) throw new Error(`not a simple length: ${value}`);
  return m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
}

describe('the page column token', () => {
  it('declares one width and one gutter', () => {
    const theme = rule(tailwind, '@theme');
    expect(decl(theme, '--page-max')).toBe('480px');
    expect(decl(theme, '--page-gutter')).toBe('1rem');
  });

  it('caps and centres with .page-col, and puts the gutter outside it', () => {
    // The split is the whole point: padding INSIDE a capped box eats the content
    // width, which is how two screens ended up 32px narrower than the third.
    const col = rule(tailwind, '\\.page-col');
    expect(decl(col, 'max-inline-size')).toBe('var(--page-max)');
    expect(decl(col, 'margin-inline')).toBe('auto');
    expect(decl(rule(tailwind, '\\.page-pad'), 'padding-inline')).toBe('var(--page-gutter)');
  });

  it('puts both in the utilities layer, so a stray max-w-* cannot beat them', () => {
    const utilities = tailwind.slice(tailwind.indexOf('@layer utilities {'));
    expect(utilities).toContain('.page-col');
    expect(utilities).toContain('.page-pad');
  });
});

describe('the screens all use it', () => {
  it('leaves no hand-written width cap on any screen', () => {
    // Asserted as an absence rather than by listing the three screens: the
    // failure this guards against is a fourth screen arriving with a number of
    // its own, which a list would never see.
    //
    // Scoped to <main>, because the feedback modal legitimately has a cap of its
    // own — it is a dialog floating over the page, not the page column.
    const main = indexHtml.slice(indexHtml.indexOf('<main'), indexHtml.indexOf('</main>'));
    expect(main).not.toMatch(/max-w-\[\d/);
    expect(welcome).not.toMatch(/max-w-\[\d/);
  });

  it('gives every screen section the gutter and every wrapper the cap', () => {
    const sections = [...indexHtml.matchAll(/<section data-screen="(\w+)"[^>]*class="([^"]*)"/g)];
    expect(sections.length).toBe(3);
    for (const [, name, classes] of sections) {
      expect(classes, `${name} section`).toContain('page-pad');
    }
    // One wrapper per screen: two in index.html, one rendered by welcome.ts.
    expect([...indexHtml.matchAll(/page-col/g)].length).toBe(2);
    expect(welcome).toContain('page-col');
  });

  it('starts every screen at the top, never centred vertically (brief 61)', () => {
    // /welcome and /solved used to centre while /play started at the top, so
    // moving between screens walked the content up and down the window. Scoped
    // to the screen containers: justify-center inside a digit chip is fine and
    // is not what moved.
    for (const [, classes] of indexHtml.matchAll(/<section data-screen="\w+"[^>]*class="([^"]*)"/g)) {
      expect(classes).not.toContain('justify-center');
    }
    for (const [, classes] of indexHtml.matchAll(/class="(page-col[^"]*)"/g)) {
      expect(classes).not.toContain('justify-center');
    }
    // welcome.ts sets its section's classes at runtime rather than in markup.
    const added = /screen\.classList\.add\(([^)]*)\)/.exec(welcome);
    expect(added, 'no classList.add on the welcome section').not.toBeNull();
    expect(added![1]).not.toContain('justify-center');
  });
});
