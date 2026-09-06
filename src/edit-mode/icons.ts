// Clumeral edit mode — icons.
//
// Lucide (lucide.dev), ISC licensed, inlined as SVG path data rather than
// pulled from a package. Jamie, 2026-08-27: "don't use characters for icons
// only lucide.dev icons, undo is tiny for example."
//
// Text glyphs were the wrong tool: a character renders at whatever size and
// weight the font gives it, so the undo arrow came out tiny next to a tick. An
// SVG is the size you tell it to be.
//
// Inlined because the panel lives in a sealed shadow root with no build step of
// its own, and a dev tool should not fetch an icon font to draw six buttons.

const ICONS: Record<string, string> = {
  // lucide: undo-2
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
  // lucide: rotate-ccw
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  // lucide: save
  save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  // lucide: trash-2. The floppy above is Jamie's Save (2026-09-01: "Floppy for
  // save. Trash for discard."). public/sprites.svg is the GAME's sheet and a
  // production artefact, so neither icon goes anywhere near it.
  trash: '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  // lucide: plus
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  // lucide: minus
  minus: '<path d="M5 12h14"/>',
  // lucide: chevron-left
  back: '<path d="m15 18-6-6 6-6"/>',
  // lucide: chevron-up / down / left / right
  parent: '<path d="m18 15-6-6-6 6"/>',
  child: '<path d="m6 9 6 6 6-6"/>',
  prev: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  // lucide: chevron-right / chevron-down, for the picker's family rows
  collapsed: '<path d="m9 18 6-6-6-6"/>',
  expanded: '<path d="m6 9 6 6 6-6"/>',
  // lucide: pencil
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
  // lucide: eye-off, for a class switched off rather than removed
  off: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.8 10.8 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
};

/**
 * One icon, sized in em so it scales with the label beside it.
 *
 * `currentColor` so a chip's icons inherit whatever the chip's colour is —
 * white on the solid steppers, dark on a plain button.
 */
export function icon(name: keyof typeof ICONS | string, size = '1.15em'): string {
  const path = ICONS[name];
  if (!path) return '';
  return (
    `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    `stroke-linejoin="round" aria-hidden="true">${path}</svg>`
  );
}

export const ICON_NAMES = Object.keys(ICONS);
