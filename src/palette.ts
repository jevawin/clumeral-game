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
  hues: { Lime: 145, Cherry: 5, Blueberry: 262, Grape: 305 },

  // success and error are not colours of their own: they alias two of the themes
  // and resolve at the accent lightness and that theme's chroma. Meaning is
  // carried by the wording ("Solved in N tries!" vs "Not quite") and by the tick
  // and cross icons, so they do not need to stay distinguishable from the active
  // accent — colour is the third signal here, not the only one (WCAG 1.4.1).
  //
  // This removes the semantic lightness band, both semantic hues and both
  // semantic chromas, and with them the tightest pairing in the system — error
  // dark on surface was 4.70; the worst semantic ratio is now 5.36.
  semantics: { success: 'Lime', error: 'Cherry' },

  light: {
    bg: '#FAFAFA',
    surface: '#FFFFFF',
    text: '#262624',
    accentL: 0.5,
    // min(today's chroma, the hue's sRGB ceiling at accentL). Lime and Cherry are
    // ceiling-capped; Blueberry and Grape sit at today's value with room to spare.
    accentC: { Lime: 0.157, Cherry: 0.201, Blueberry: 0.178, Grape: 0.237 },
  },

  dark: {
    bg: '#121213',
    surface: '#2A2A2B',
    text: '#FAF8F4',
    accentL: 0.78,
    // All but Lime are at their sRGB ceiling, truncated to 3dp — rounding to
    // nearest puts Cherry past its limit of 0.135523 and out of gamut. L=0.78 is
    // what AA on surface requires, and a lighter colour has less room for
    // chroma, so these are gamut limits rather than choices. Lime could reach
    // 0.245 and is held at today's value instead.
    accentC: { Lime: 0.174, Cherry: 0.135, Blueberry: 0.111, Grape: 0.14 },
  },
} as const;
