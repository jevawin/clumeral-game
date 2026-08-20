// Clumeral edit mode — the index.html rewrite.
//
// Pure, so it can be tested without a browser or a running server.
//
// The committed index.html carries no edit-mode markup at all (brief items 56,
// 60). The plugin swaps the stylesheet link when serving. Nothing in the repo
// names edit mode, so there is no dev-only condition for a bundler to strip and
// nothing to get wrong on a bundler upgrade.

/** Which class set the page should load. */
export type ClassSet = 'non-colour' | 'all';

/**
 * Two separate stylesheet entries rather than one entry with a switch.
 *
 * The alternative — a query flag that regenerates the class list at request
 * time — has no ordering guarantee between the HTML response and the CSS
 * request that follows it, so the A3 measurement could compare one set against
 * itself and nobody would know. Two static files cannot race.
 */
export const EDIT_STYLESHEETS: Record<ClassSet, string> = {
  'non-colour': '/src/tailwind-edit.css',
  all: '/src/tailwind-edit-all.css',
};

const PRODUCTION_STYLESHEET = '/src/tailwind.css';

/**
 * Swap the stylesheet link for the edit-mode build.
 *
 * Only the href changes — the link's onerror reload guard and everything else
 * on the page are left exactly as they are, so the dev server is the real page
 * with a bigger stylesheet rather than an approximation of it.
 *
 * The overlay <script> is deliberately NOT injected here. src/edit-mode/
 * overlay.ts does not exist until task C3, and injecting a tag that 404s would
 * put a module error on every page load during the A3 measurement — the one
 * task that has to work.
 */
export function rewriteIndexHtml(html: string, opts: { set: ClassSet }): string {
  return html.replace(
    `href="${PRODUCTION_STYLESHEET}"`,
    `href="${EDIT_STYLESHEETS[opts.set]}"`
  );
}

/** Which set a request asked for. `?classes=all` opts into the full build. */
export function classSetFromUrl(url: string | undefined): ClassSet {
  return url && /[?&]classes=all(&|$)/.test(url) ? 'all' : 'non-colour';
}
