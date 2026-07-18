import { describe, it, expect } from 'vitest';
import { oklchToHex, contrastRatio } from './helpers/colour';

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
