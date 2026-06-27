# Fixed app icon — green octopus on black

Date: 2026-05-31
Branch: new-design

## Goal

Stop the homescreen/app icon and favicon changing with the theme. Lock them to
one design: green octopus with white border on a pure black surround. Always
black, never white, regardless of light/dark mode or the in-app accent colour.

The in-app accent picker (Lime / Berry / Blue / Violet) keeps working — it only
stops touching the icons.

## What changes

### Assets (from Figma export in `NEW_IMAGES/`)

The exported PNGs already have the black surround baked in (full-bleed, opaque,
correct sizes). Copy into `public/`, overwriting:

- `apple-touch-icon.png` (180×180)
- `icon-192.png` (192×192)
- `icon-512.png` (512×512, also serves the maskable purpose — octopus sits
  inside the maskable safe zone, so it won't clip)
- `og-image.png` (1200×630, new black/green branding for social shares)

The exported SVGs are transparent. Build `public/favicon.svg` from
`icon-192.svg` by adding a black background `<rect>` behind the octopus. Octopus
fill `#1EAD52`, border `#FAF8F4` already in the art.

### Code

`src/colours.ts`
- Remove `swapIcons()` and its call inside `applyColour()`.
- Fix the file header comment that mentions swapping the favicon per mode.

`index.html`
- `rel="icon"` → `/favicon.svg` (was `/icons/lime/dark/icon-192.png`).
- Bump `og:image` cache-buster `?v=2` → `?v=3`; add `?v=3` to `twitter:image`.
- `apple-touch-icon` and `manifest` links unchanged (already root paths).

### Explicitly NOT changing

- `manifest.json` `theme_color` / `background_color` — left as-is. The black
  surround comes from the PNGs, not these. Changing `theme_color` would tint the
  installed-app toolbar black in light mode too, which is unwanted.
- `<meta name="theme-color">` in `index.html` — left as-is for the same reason.
- The in-app accent colour system and CSS tokens.

### Cleanup

- Delete `public/icons/` (all per-theme `{lime,berry,blue,violet}/{light,dark}/`
  dirs — now dead).
- Delete `NEW_IMAGES/` once assets are in place (already gitignored).

## QA

Light, per agreement. Build the production bundle, grep for dangling icon
references, eyeball the favicon and og-image. No Playwright — homescreen install
can't be verified headless. User tests on-device after push.

Review gates: DA review → self-review before PR (touches >1 file + theming
logic).
