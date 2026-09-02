// Clumeral — stats-style-diff.mjs
//
// A THROWAWAY one-off (stats-Tailwind plan, Task 5a). It records the styling
// every element of the completion panel resolves to, so the same run on the
// commit before the Tailwind conversion and the commit after can be diffed.
// Every difference must appear in section 2 of the plan; anything else is a bug
// in the conversion. Delete it once the numbers are in the pull request.
//
// It does NOT use getComputedStyle. The plan assumed jsdom could resolve the
// built stylesheet; it cannot — jsdom throws "Could not parse CSS stylesheet"
// on Tailwind v4's output and every element then reads back as browser
// defaults, on both commits, which is a diff of nothing against nothing. So the
// DOM comes from jsdom (which works fine) and the declarations are resolved by
// walking the built stylesheet with postcss instead.
//
// What it can and cannot see. It reports DECLARED values, so it catches colour,
// weight, spacing, radius, border width and opacity — the exact swaps, which is
// most of the risk. It has no layout engine, so it cannot resolve a fluid font
// size or a breakpoint. Those are the browser's job, in e2e/specs/stats-overflow.spec.ts.
//
//   npx vite build && node scripts/stats-style-diff.mjs > /tmp/after.json
//
// Then the same two commands in a worktree at the pre-conversion commit, and:
//
//   node scripts/stats-style-diff.mjs --compare /tmp/before.json /tmp/after.json
//
// The comparison is part of this script rather than a shell one-liner because
// most of it is knowing which differences are not differences: `margin-block-end`
// and `margin-bottom` are the same edge on a horizontal LTR document, a
// shorthand and its longhands are the same declaration, and `.5rem` and `0.5rem`
// are the same length.

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';

// The declarations worth diffing: everything section 2 of the plan claims is
// either exact or moves by a stated amount.
// The shorthands are listed as well as the longhands. Without `border` and
// `background` the old stylesheet's `border: 1.5px solid ...` was dropped
// silently and read back as "no border at all", which made an exact swap look
// like a change. Tailwind v4 also uses the standalone `rotate` and `translate`
// properties rather than `transform`, so both spellings are here.
const WATCHED = [
  'font-size', 'line-height', 'font-weight', 'font-family', 'color',
  'background', 'background-color', 'border', 'border-width', 'border-style',
  'border-color', 'border-radius', 'padding', 'margin', 'gap', 'display',
  'flex', 'flex-basis', 'flex-grow', 'flex-wrap', 'row-gap', 'column-gap',
  'justify-content',
  'align-items', 'grid-template-columns', 'opacity', 'transform', 'rotate',
  'translate', 'scale', 'position', 'inset', 'overflow', 'inline-size',
  'block-size', 'width', 'height', 'text-align',
];

// Longhands roll up under the shorthand they belong to, so `padding-inline` and
// `padding` land on the same line of the diff rather than looking like a change.
function watchedName(prop) {
  const bare = prop.replace(/^-(webkit|moz|ms)-/, '');
  return WATCHED.find((w) => bare === w || bare.startsWith(w + '-'))
    ? bare
    : null;
}

function builtStylesheet() {
  const dir = resolve(import.meta.dirname, '../dist/client/assets');
  const css = readdirSync(dir).filter((f) => f.endsWith('.css'));
  if (css.length !== 1) {
    throw new Error(`expected one built stylesheet in ${dir}, found ${css.length}. Run: npx vite build`);
  }
  return readFileSync(resolve(dir, css[0]), 'utf8');
}

/**
 * Every rule in the stylesheet, in source order, paired with its selector list.
 *
 * Rules inside a media or container query are skipped and COUNTED, not silently
 * dropped: without a layout engine there is no viewport to test them against,
 * and a quiet skip would read as "nothing conditional left" when there might be
 * plenty. The count is reported alongside the elements.
 */
/**
 * The theme's custom properties, so the two runs are comparable.
 *
 * Without this the old commit reports `gap: 1.5rem` and the new one reports
 * `gap: calc(var(--spacing) * 6)`, and every single line looks like a change.
 * They are the same 1.5rem, and the diff should say so.
 */
function themeVars(css) {
  const vars = new Map();
  postcss.parse(css).walkRules((rule) => {
    // Root-level only. Anything scoped to an element is resolved per element,
    // walking down the tree, because that is how inheritance actually works.
    if (!rule.selectors.some((s) => /^(:root|html|\*|:host)\b/.test(s.trim()))) return;
    rule.walkDecls((d) => { if (d.prop.startsWith('--')) vars.set(d.prop, d.value.trim()); });
  });
  return vars;
}

/** Expand `var(--x)`, then fold the `calc(<length> * <number>)` Tailwind emits. */
function expand(value, vars, depth = 0) {
  if (depth > 8) return value;
  let out = value.replace(/var\((--[\w-]+)(?:\s*,\s*([^()]*))?\)/g, (whole, name, fallback) =>
    vars.has(name) ? expand(vars.get(name), vars, depth + 1) : (fallback ?? whole));
  out = out.replace(/calc\(\s*(-?[\d.]+)([a-z%]*)\s*([*/])\s*(-?[\d.]+)\s*\)/g, (whole, a, unit, op, b) => {
    const n = op === '*' ? Number(a) * Number(b) : Number(a) / Number(b);
    return Number.isFinite(n) ? `${Math.round(n * 100000) / 100000}${unit}` : whole;
  });
  return out === value ? out : expand(out, vars, depth + 1);
}

function flatRules(css) {
  const root = postcss.parse(css);
  const rules = [];
  let conditional = 0;
  root.walkRules((rule) => {
    let parent = rule.parent;
    while (parent && parent.type !== 'root') {
      if (parent.type === 'atrule' && /^(media|container|supports)$/.test(parent.name)) {
        conditional += 1;
        return;
      }
      parent = parent.parent;
    }
    const decls = [];
    const vars = [];
    rule.walkDecls((d) => {
      if (d.prop.startsWith('--')) { vars.push([d.prop, d.value.trim()]); return; }
      const name = watchedName(d.prop);
      if (name) decls.push([name, d.value.trim(), d.important]);
    });
    if (decls.length || vars.length) rules.push({ selectors: rule.selectors, decls, vars });
  });
  return { rules, conditional };
}

/**
 * Resolve one element against the stylesheet, in source order — later wins.
 *
 * This is deliberately not a specificity implementation. Tailwind emits its
 * layers in cascade order already, and the question here is "did any declared
 * value move", which source order answers well enough for a one-off diff. An
 * !important declaration wins outright, which is the one case source order gets
 * wrong often enough to matter.
 */
function resolveElement(el, rules, inherited) {
  const out = {};
  const important = new Set();
  // Custom properties inherit, so an element sees its ancestors' as well as its
  // own. This is what makes --section-accent readable: it is set once per block
  // and every icon, border and number inside that block resolves through it. A
  // single file-wide map would hand all four blocks whichever value happened to
  // be declared last, and quietly report three of them as the wrong colour.
  const vars = new Map(inherited);
  for (const { selectors, decls, vars: ruleVars } of rules) {
    let hit = false;
    for (const sel of selectors) {
      try {
        if (el.matches(sel)) { hit = true; break; }
      } catch {
        // nwsapi rejects selectors it does not implement. Skipping one is
        // honest; pretending it matched is not.
      }
    }
    if (!hit) continue;
    for (const [name, value] of ruleVars) vars.set(name, value);
    for (const [prop, value, isImportant] of decls) {
      if (important.has(prop) && !isImportant) continue;
      out[prop] = value;
      if (isImportant) important.add(prop);
    }
  }
  for (const key of Object.keys(out)) out[key] = expand(out[key], vars);
  return { style: out, vars };
}

/** A stable address for an element, so the two runs line up row by row. */
function path(el, root) {
  const steps = [];
  for (let node = el; node && node !== root; node = node.parentElement) {
    const siblings = [...node.parentElement.children];
    steps.unshift(`${node.tagName.toLowerCase()}:${siblings.indexOf(node)}`);
  }
  return steps.join(' > ');
}

// Five countable games ending today — the same history the browser tests seed,
// so the panel renders all four blocks with real numbers in them.
function history(today) {
  const day = (back) => {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() - back);
    return d.toISOString().slice(0, 10);
  };
  return [
    { date: day(0), tries: 2, seconds: 221 },
    { date: day(1), tries: 1, seconds: 48 },
    { date: day(2), tries: 3, seconds: 300 },
    { date: day(3), tries: 2, seconds: 260 },
    { date: day(4), tries: 4, seconds: 400 },
  ];
}

// ---------------------------------------------------------------------------
// --compare: read two captures and print only the differences that are real.

/** Property groups that are two spellings of one thing on this document. */
const EQUIVALENT = [
  ['margin-block', 'margin-top', 'margin-bottom'],
  ['margin-block-start', 'margin-top'],
  ['margin-block-end', 'margin-bottom'],
  ['margin-inline', 'margin-left', 'margin-right'],
  ['padding', 'padding-block', 'padding-inline', 'padding-top', 'padding-bottom'],
  ['padding-block', 'padding-top', 'padding-bottom'],
  ['inline-size', 'width'],
  ['block-size', 'height'],
  ['border', 'border-width', 'border-style', 'border-color'],
  ['background', 'background-color'],
  ['gap', 'row-gap', 'column-gap'],
  ['transform', 'rotate', 'translate', 'scale'],
];

/** `.5rem` and `0.5rem`, `0` and `0rem`, and runs of whitespace, are the same. */
function canonical(value) {
  if (value == null) return null;
  return String(value)
    .replace(/(^|[^\d])\.(\d)/g, '$10.$2')
    .replace(/^0[a-z%]+$/, '0')
    .replace(/\s+/g, ' ')
    .trim();
}

function compare(beforePath, afterPath) {
  const before = JSON.parse(readFileSync(beforePath, 'utf8')).elements;
  const after = JSON.parse(readFileSync(afterPath, 'utf8')).elements;
  if (before.length !== after.length) {
    console.log(`ELEMENT COUNT DIFFERS: ${before.length} then ${after.length}. The markup changed shape, so the rows below do not line up.`);
  }
  const rows = new Map();
  for (let i = 0; i < Math.min(before.length, after.length); i += 1) {
    const x = before[i], y = after[i];
    for (const prop of [...new Set([...Object.keys(x.style), ...Object.keys(y.style)])].sort()) {
      const p = canonical(x.style[prop]), q = canonical(y.style[prop]);
      if (p === q) continue;
      // A property can belong to more than one group — margin-top is in both the
      // margin-block group and the margin-block-start pair — so check them all.
      const groups = EQUIVALENT.filter((g) => g.includes(prop));
      const joined = (el, g) => g.map((n) => canonical(el.style[n])).filter(Boolean).join(' ');
      if (groups.some((g) => joined(x, g) === joined(y, g))) continue;
      const row = `${y.label || y.tag} | ${prop} | ${p ?? '(none)'} -> ${q ?? '(none)'}`;
      rows.set(row, (rows.get(row) ?? 0) + 1);
    }
  }
  for (const [row, n] of [...rows].sort()) console.log(`${n > 1 ? 'x' + n : '  '}\t${row}`);
  console.log(`\nelements compared: ${before.length}, distinct differences: ${rows.size}`);
}

if (process.argv[2] === '--compare') {
  compare(process.argv[3], process.argv[4]);
  process.exit(0);
}

const TODAY = '2026-08-10';

/**
 * The panel container's real opening tag, lifted out of index.html.
 *
 * Read rather than hardcoded, because the container's own class list is one of
 * the things the conversion changes — `text-text` moved onto it from the
 * stylesheet — and hardcoding it here would hide exactly that.
 */
function panelTag() {
  const html = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8');
  const tag = /<div data-completion-panel[^>]*>/.exec(html);
  if (!tag) throw new Error('no data-completion-panel div in index.html');
  return tag[0];
}

const dom = new JSDOM(`<!doctype html><html data-theme="lime"><body>
  <div data-completion-octo></div>
  <h2 data-completion-heading></h2>
  <p data-completion-subheading></p>
  ${panelTag()}</div>
  <p data-completion-live></p>
  <p data-completion-countdown></p>
  <button data-completion-feedback></button>
  <div data-completion-links></div>
</body></html>`, { url: 'https://clumeral.com/solved' });

// `navigator` is a getter-only global on modern Node, so it is defined rather
// than assigned; the rest are plain assignments.
for (const key of ['window', 'document', 'localStorage', 'CustomEvent', 'Node', 'HTMLElement', 'Element']) {
  globalThis[key] = dom.window[key];
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

localStorage.setItem('dlng_history', JSON.stringify(history(TODAY)));
localStorage.setItem('dlng_prefs', JSON.stringify({ saveScore: true }));

const { renderCompletion } = await import('../src/completion.ts');
renderCompletion(157, 2, false, { seconds: 221 });
document.dispatchEvent(new CustomEvent('screens:enter', { detail: { screen: 'completion' } }));

const panel = document.querySelector('[data-completion-panel]');
const sheet = builtStylesheet();
const { rules, conditional } = flatRules(sheet);

// Top-down, so each element inherits the custom properties its ancestors set.
const elements = [];
(function walk(el, inherited) {
  const { style, vars } = resolveElement(el, rules, inherited);
  elements.push({
    path: path(el, panel.parentElement),
    tag: el.tagName.toLowerCase(),
    label: el.getAttributeNames().filter((a) => a.startsWith('data-stat') || a.startsWith('data-goes')).join(' '),
    style,
  });
  for (const child of el.children) walk(child, vars);
})(panel, themeVars(sheet));

console.log(JSON.stringify({ conditionalRulesSkipped: conditional, count: elements.length, elements }, null, 2));
