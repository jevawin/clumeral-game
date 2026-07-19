import { describe, it, expect } from 'vitest';
import { oklchToHex, contrastRatio, inSrgbGamut } from './helpers/colour';
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

  // Colour is not the only signal for success/error — the tick and cross icons
  // carry the meaning (WCAG 1.4.1), which is what lets the semantics sit at the
  // same lightness as the accent. If those icons are ever removed, this aliasing
  // has to be revisited.
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
