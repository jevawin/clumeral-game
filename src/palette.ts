// Clumeral — palette.ts
// The derived palette's declared values. Everything else in the colour system
// computes from these. Contrast is carried by accentL alone, shared across all
// four themes, so a theme cannot fail WCAG AA — see tests/palette-contrast.spec.ts.
//
// Chroma is per-theme because it is contrast-inert: pushing it to the sRGB
// ceiling moves the ratio by at most ~0.5. That is what lets it be a free
// aesthetic dial without reopening the AA question (#255).
//
// Adding a fifth theme means adding a hue angle here plus a chroma per mode.

export const PALETTE = {
  hues: { Lime: 145, Berry: 5, Blue: 262, Violet: 305 },

  semantics: {
    success: { hue: 150, chroma: 0.11 },
    error: { hue: 27, chroma: 0.14 },
  },

  light: {
    bg: '#FAFAFA',
    surface: '#FFFFFF',
    text: '#262624',
    accentL: 0.5,
    // min(today's chroma, the hue's sRGB ceiling at accentL). Lime and Berry are
    // ceiling-capped; Blue and Violet sit at today's value with room to spare.
    accentC: { Lime: 0.157, Berry: 0.201, Blue: 0.178, Violet: 0.237 },
    semanticL: 0.4,
  },

  dark: {
    bg: '#121213',
    surface: '#2A2A2B',
    text: '#FAF8F4',
    accentL: 0.78,
    // All but Lime are at their sRGB ceiling, truncated to 3dp — rounding to
    // nearest puts Berry past its limit of 0.135523 and out of gamut. L=0.78 is
    // what AA on surface requires, and a lighter colour has less room for
    // chroma, so these are gamut limits rather than choices. Lime could reach
    // 0.245 and is held at today's value instead.
    accentC: { Lime: 0.174, Berry: 0.135, Blue: 0.111, Violet: 0.14 },
    semanticL: 0.68,
  },
} as const;
