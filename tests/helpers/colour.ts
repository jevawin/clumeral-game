// OKLCH → sRGB and WCAG 2.1 contrast. Used to assert the palette's AA guarantee
// in CI rather than auditing pairings by hand — the failure mode that shipped
// the #254 AA bug. Matrices are Björn Ottosson's Oklab reference values.

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function srgbToLinear(c: number): number {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

/** Linear-light sRGB triple for an OKLCH colour. Values may fall outside 0..1
 *  when the colour is out of gamut — callers clamp. */
function oklchToLinearRgb(L: number, C: number, H: number): [number, number, number] {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function oklchToHex(L: number, C: number, H: number): string {
  const channel = (v: number): string => {
    const clamped = Math.max(0, Math.min(1, v));
    const byte = Math.round(linearToSrgb(clamped) * 255);
    return Math.max(0, Math.min(255, byte)).toString(16).toUpperCase().padStart(2, '0');
  };
  const [r, g, b] = oklchToLinearRgb(L, C, H);
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** True when the OKLCH colour fits inside sRGB without clipping. Clipping shifts
 *  lightness, which would silently break the contrast guarantee. */
export function inSrgbGamut(L: number, C: number, H: number): boolean {
  const eps = 1e-4;
  return oklchToLinearRgb(L, C, H).every((v) => v >= -eps && v <= 1 + eps);
}

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
