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

  it.each(modes)('%s semantics clear AA and stay clear of the accent band', (mode) => {
    const { accentL, semanticL, bg, surface } = PALETTE[mode];
    for (const [name, { hue, chroma }] of Object.entries(PALETTE.semantics)) {
      const hex = oklchToHex(semanticL, chroma, hue);
      expect(contrastRatio(hex, bg), `${name} on bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(hex, surface), `${name} on surface`).toBeGreaterThanOrEqual(4.5);
    }
    // The lightness gap is what keeps success readable under Lime and error
    // readable under Berry, where hue separation alone is 5 deg and 22 deg.
    //
    // Light runs a narrower band (0.06) than dark (0.10). Green's sRGB ceiling
    // at L=0.40 is 0.110 — exactly the declared chroma — so the light success
    // green is already as vivid as the gamut allows and can only be lifted by
    // raising L, which spends the band. Dark has headroom to 0.187 and needs no
    // such trade. Anything below 0.06 was visibly too close to Lime.
    const floor = mode === 'light' ? 0.06 : 0.09;
    expect(Math.abs(accentL - semanticL)).toBeGreaterThanOrEqual(floor);
  });

  it('bg text clears AA on both bg and surface in both modes', () => {
    for (const mode of modes) {
      const { text, bg, surface } = PALETTE[mode];
      expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
