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
 * The overlay <script> is injected BEFORE the app entry, which is load-bearing
 * rather than tidy: for listeners on the same target the DOM runs them in
 * REGISTRATION order regardless of phase, so registering first is what lets edit
 * mode take a keypress before app.ts sees it, and take back before the router
 * re-renders (plan D2, D4).
 *
 * The branch is injected because the browser cannot know it, and the session
 * store is keyed to it — restoring one branch's patch set against another's
 * markup would apply edits to whatever happened to match (finding L3).
 */
export const OVERLAY_ENTRY = '/src/edit-mode/overlay.ts';

export function rewriteIndexHtml(html: string, opts: { branch?: string } = {}): string {
  const withStylesheet = html.replace(
    `href="${PRODUCTION_STYLESHEET}"`,
    `href="${EDIT_STYLESHEET}"`
  );

  // Fully escaped. A branch name reaches here from `git rev-parse` and lands in
  // an HTML attribute, so escaping only the quote would leave angle brackets
  // sitting in the document.
  const branch = (opts.branch ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const tag = `<script type="module" src="${OVERLAY_ENTRY}" data-branch="${branch}"></script>`;

  // Ahead of every other module script on the page.
  const firstScript = withStylesheet.indexOf('<script type="module"');
  if (firstScript !== -1) {
    return withStylesheet.slice(0, firstScript) + tag + '\n    ' + withStylesheet.slice(firstScript);
  }
  return withStylesheet.replace('</head>', `  ${tag}\n  </head>`);
}
