import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { oklchToHex, contrastRatio, inSrgbGamut, mixSrgb } from './helpers/colour';
import { PALETTE } from '../src/palette';

describe('colour maths helpers', () => {
  it('converts a known OKLCH triple to sRGB hex', () => {
    expect(oklchToHex(0.5, 0.14, 145)).toBe('#1E7729');
  });

  it('computes WCAG contrast symmetrically', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
  });

  it('matches a known real-world ratio', () => {
    // Lime light accent on the page background — the tightest pairing in the
    // palette, so the one worth pinning as a regression anchor.
    expect(contrastRatio('#00791E', '#FAFAFA')).toBeCloseTo(5.36, 1);
  });
});

type ThemeName = keyof typeof PALETTE.hues;
const themes = Object.keys(PALETTE.hues) as ThemeName[];

describe('palette AA guarantee', () => {
  const modes = ['light', 'dark'] as const;

  it.each(modes)('every %s accent clears AA on bg and surface', (mode) => {
    const { accentL, accentC, bg, surface } = PALETTE[mode];
    for (const name of themes) {
      const hex = oklchToHex(accentL, accentC[name], PALETTE.hues[name]);
      expect(contrastRatio(hex, bg), `${name} on bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(hex, surface), `${name} on surface`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // Chroma is per-theme and five of the eight values sit on the sRGB ceiling, so
  // this is the check that stops a hand-tweak drifting out of gamut. Clipping
  // shifts lightness, which is the one thing the AA guarantee rests on.
  it.each(modes)('every %s accent fits inside sRGB', (mode) => {
    const { accentL, accentC } = PALETTE[mode];
    for (const name of themes) {
      expect(inSrgbGamut(accentL, accentC[name], PALETTE.hues[name]), `${name} out of gamut`).toBe(
        true
      );
    }
  });

  // Semantics alias two of the themes rather than carrying their own hue,
  // chroma and lightness, so there is no separate band to police — they inherit
  // the accent guarantee. What is worth asserting is that the aliasing actually
  // holds, since a hand-edited literal here would silently reintroduce a colour
  // that has never been contrast-checked.
  it.each(modes)('%s semantics alias a real theme and clear AA', (mode) => {
    const { accentL, accentC, bg, surface } = PALETTE[mode];
    for (const [name, theme] of Object.entries(PALETTE.semantics)) {
      expect(themes, `${name} aliases an unknown theme`).toContain(theme);
      const hex = oklchToHex(accentL, accentC[theme], PALETTE.hues[theme]);
      expect(contrastRatio(hex, bg), `${name} on bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(hex, surface), `${name} on surface`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // Colour is not the only signal for success/error — the wording differs and a
  // tick/cross sits beside it (WCAG 1.4.1), which is what lets the semantics sit
  // at the same lightness and hue as the accent. If success and error ever stop
  // differing in words AND icon, colour becomes the only signal and there is
  // none left to read under the aliased theme — revisit the aliasing then.
  it('success and error are distinct from each other', () => {
    for (const mode of modes) {
      const { accentL, accentC } = PALETTE[mode];
      const { success, error } = PALETTE.semantics;
      expect(oklchToHex(accentL, accentC[success], PALETTE.hues[success])).not.toBe(
        oklchToHex(accentL, accentC[error], PALETTE.hues[error])
      );
    }
  });

  it('bg text clears AA on both bg and surface in both modes', () => {
    for (const mode of modes) {
      const { text, bg, surface } = PALETTE[mode];
      expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

// The Undo/Reset shortcut hint renders at 80% of the text colour on the button
// surface (.board-ctrl__key, via color-mix). It is 13px — normal text for WCAG,
// so the 4.5:1 bar applies, not 3:1. Nothing else pins that number, so a token
// tweak could quietly drop it below AA with the whole suite still green.
describe('shortcut hint tint (.board-ctrl__key)', () => {
  const KEY_ALPHA = 0.8;

  // color-mix(in srgb, currentColor 80%, transparent) over an opaque backdrop
  // composites to the same colour as an 80/20 blend of the two.
  function blend(fg: string, bg: string, alpha: number): string {
    const rgb = (h: string) =>
      [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [fr, fg_, fb] = rgb(fg);
    const [br, bg_, bb] = rgb(bg);
    const mix = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha));
    return (
      '#' +
      [mix(fr, br), mix(fg_, bg_), mix(fb, bb)]
        .map((v) => v.toString(16).padStart(2, '0').toUpperCase())
        .join('')
    );
  }

  it.each(['light', 'dark'] as const)('clears AA for normal text in %s', (mode) => {
    const { text, surface } = PALETTE[mode];
    const tinted = blend(text, surface, KEY_ALPHA);
    expect(contrastRatio(tinted, surface), `${mode} hint on surface`).toBeGreaterThanOrEqual(4.5);
  });

  // The figures Jamie signed off, pinned so a drift is visible rather than merely
  // still-passing. 80% was chosen as roughly half the distance from full strength
  // to the point where each theme would touch 4.5:1 (63% light, 50% dark).
  //
  // These are the 8-bit values — blend() rounds to whole channels, as a rasteriser
  // ultimately does. Compositing color-mix at higher precision gives 7.902 / 9.197,
  // which is why the prose elsewhere says "about 7.9" rather than a false-precise
  // figure. The arithmetic here is exact for fixed tokens, so a tight tolerance is
  // safe: it can only move if a token moves, which is the point.
  it('holds the agreed ratios', () => {
    expect(
      contrastRatio(blend(PALETTE.light.text, PALETTE.light.surface, KEY_ALPHA), PALETTE.light.surface),
    ).toBeCloseTo(7.9465, 3);
    expect(
      contrastRatio(blend(PALETTE.dark.text, PALETTE.dark.surface, KEY_ALPHA), PALETTE.dark.surface),
    ).toBeCloseTo(9.2037, 3);
  });
});

// The "Everyone today" card's two derived tokens (time chart brief items 64, 69,
// 80, 97). The card sits on the page background, so every ratio is against bg.
// Others' dots are data, not decoration, so they meet 3:1 like the axis.
describe('time chart tokens', () => {
  const DOT_PCT = 72;
  const LINE_PCT = 55;
  const combos = (['light', 'dark'] as const).flatMap((mode) => themes.map((name) => [mode, name] as const));

  it.each(combos)('%s %s clears every chart floor on bg', (mode, name) => {
    const { accentL, accentC, bg, text } = PALETTE[mode];
    const accent = oklchToHex(accentL, accentC[name], PALETTE.hues[name]);
    expect(contrastRatio(mixSrgb(accent, bg, DOT_PCT), bg), '--chart-dot').toBeGreaterThanOrEqual(3);
    expect(contrastRatio(mixSrgb(text, bg, LINE_PCT), bg), '--chart-line').toBeGreaterThanOrEqual(3);
    expect(contrastRatio(accent, bg), 'your dot').toBeGreaterThanOrEqual(3);
    expect(contrastRatio(text, bg), 'chart text').toBeGreaterThanOrEqual(4.5);
  });

  // The maths above holds only for the percentages it names. Pin the CSS to them,
  // so a hand-edit of one cannot pass with the test still green.
  it('declares the tokens with exactly these mixes', () => {
    const css = readFileSync(resolve(__dirname, '..', 'src/tailwind.css'), 'utf-8');
    expect(css).toContain(`--chart-dot:  color-mix(in srgb, var(--color-accent) ${DOT_PCT}%, var(--color-bg));`);
    expect(css).toContain(`--chart-line: color-mix(in srgb, var(--color-text) ${LINE_PCT}%, var(--color-bg));`);
  });
});
