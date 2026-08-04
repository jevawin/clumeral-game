// Contrast guard for /stats.
//
// tests/palette-contrast.spec.ts covers src/palette.ts, and /stats does not use
// it — the dashboard hardcodes its own colours, so the page had no contrast
// coverage at all. The .domain-label token it shipped with measured 2.97:1 against
// the light page, below AA and below even the 3:1 graphics threshold. This test is
// what stops that recurring.
//
// Token values are read out of the rendered stylesheet rather than duplicated
// here, so editing the CSS is what this test reacts to.
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './helpers/colour';
import { renderDashboard } from '../src/worker/stats.ts';
import type { StatsResult } from '../src/worker/analytics-db.ts';

const empty: StatsResult = {
  events: [],
  daily: [],
  uniqueUsers: 0,
  newUsers: 0,
  guessDistribution: [],
  sourceSplit: [],
  firstTs: null,
};
const css = renderDashboard(empty, { days: 30 }, 'clumeral.com', Date.UTC(2026, 7, 4));

const SURFACES = {
  'light page': '#f5edd8',
  'light card': '#fffdf7',
  'dark page': '#262624',
  'dark card': '#2e2e2c',
} as const;

/** Flatten `rgba(r,g,b,a)` onto an opaque background and return the result as hex. */
function flatten(rgba: string, bgHex: string): string {
  const [r, g, b, a] = rgba.match(/[\d.]+/g)!.map(Number);
  const bg = [1, 3, 5].map((i) => parseInt(bgHex.slice(i, i + 2), 16));
  const out = [r, g, b].map((c, i) => Math.round(c * a + bg[i] * (1 - a)));
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Pull `--name: light-dark(<light>, <dark>)` out of the rendered CSS.
 *
 * Split on the top-level comma rather than the first one: both arguments are
 * themselves `rgba(r, g, b, a)`, so a naive split lands inside the first colour.
 */
function token(name: string): { light: string; dark: string } {
  const m = css.match(new RegExp(`--${name}:\\s*light-dark\\((.+)\\);`));
  if (!m) throw new Error(`token --${name} not found in the dashboard stylesheet`);
  let depth = 0;
  for (let i = 0; i < m[1].length; i++) {
    const c = m[1][i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      return { light: m[1].slice(0, i).trim(), dark: m[1].slice(i + 1).trim() };
    }
  }
  throw new Error(`token --${name} is not a two-argument light-dark()`);
}

function ratio(value: string, surface: keyof typeof SURFACES): number {
  const bg = SURFACES[surface];
  return contrastRatio(value.startsWith('rgba') ? flatten(value, bg) : value, bg);
}

describe('/stats colour contrast', () => {
  const ink = token('ink');
  const inkMuted = token('ink-muted');
  const acc = token('acc');

  // Everything the chart writes as text: axis numbers, date labels, the two
  // direct bar labels, the card labels and the period label.
  it.each([
    ['--ink', ink.light, 'light page'],
    ['--ink', ink.light, 'light card'],
    ['--ink', ink.dark, 'dark page'],
    ['--ink', ink.dark, 'dark card'],
    ['--ink-muted', inkMuted.light, 'light page'],
    ['--ink-muted', inkMuted.light, 'light card'],
    ['--ink-muted', inkMuted.dark, 'dark page'],
    ['--ink-muted', inkMuted.dark, 'dark card'],
  ] as const)('%s clears AA text on the %s', (_name, value, surface) => {
    expect(ratio(value, surface)).toBeGreaterThanOrEqual(4.5);
  });

  // Bars and the zero-day stub are graphics, not text: 3:1 under WCAG 1.4.11.
  it.each([
    ['light page', acc.light],
    ['dark page', acc.dark],
  ] as const)('the bar colour clears 3:1 on the %s', (surface, value) => {
    expect(ratio(value, surface)).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ['light page', inkMuted.light],
    ['dark page', inkMuted.dark],
  ] as const)('the zero-day stub clears 3:1 on the %s', (surface, value) => {
    expect(ratio(value, surface)).toBeGreaterThanOrEqual(3);
  });

  // The regression this file exists for. 0.5 alpha ink was what shipped.
  it('rejects the alpha the domain label used to carry', () => {
    expect(ratio('rgba(38,38,36,0.5)', 'light page')).toBeLessThan(4.5);
    expect(ratio(inkMuted.light, 'light page')).toBeGreaterThan(ratio('rgba(38,38,36,0.5)', 'light page'));
  });

  it('uses no accent colour for chart text', () => {
    expect(css).toContain('.axis { fill: var(--ink-muted);');
    expect(css).toContain('.direct { fill: var(--ink);');
  });
});
