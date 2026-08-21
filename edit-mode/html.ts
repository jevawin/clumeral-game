// Clumeral edit mode — the index.html rewrite.
//
// Pure, so it can be tested without a browser or a running server.
//
// The committed index.html carries no edit-mode markup at all (brief items 56,
// 60). The plugin swaps the stylesheet link when serving. Nothing in the repo
// names edit mode, so there is no dev-only condition for a bundler to strip and
// nothing to get wrong on a bundler upgrade.

/**
 * The one dev stylesheet.
 *
 * There used to be two — a non-colour build and a full one — so Jamie could
 * compare them on the phone for A3. A3 answered on 2026-08-21 (the full set is
 * comfortable), so the second entry, the class-set type and the environment
 * variable that chose between them are all gone. One file, one path, nothing to
 * pick wrong.
 */
export const EDIT_STYLESHEET = '/src/tailwind-edit.css';

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
 * put a module error on every page load.
 */
export function rewriteIndexHtml(html: string): string {
  return html.replace(
    `href="${PRODUCTION_STYLESHEET}"`,
    `href="${EDIT_STYLESHEET}"`
  );
}
