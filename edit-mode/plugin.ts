// Clumeral edit mode — the Vite plugin.
//
// `apply: 'serve'` is the load-bearing line: this plugin object is dropped
// entirely from every `vite build`, whatever mode or environment it runs in.
// Combined with nothing under src/ importing src/edit-mode/, that means the
// overlay, the middleware and the edit stylesheets cannot reach a deployed
// artefact — asserted against built output in task A4, not trusted here.

import type { Plugin } from 'vite';
import { writeArtefacts } from './classlist.ts';
import { rewriteIndexHtml } from './html.ts';
import { gzipEditStylesheets } from './gzip.ts';
import { serveCatalogue } from './catalogue-route.ts';

export function editMode(): Plugin {
  return {
    name: 'clumeral-edit-mode',
    apply: 'serve',

    config() {
      return {
        server: {
          // Bind on all interfaces so the Pi is reachable from Jamie's phone
          // over Tailscale. Without this Vite binds to localhost and edit mode
          // has no user — `npm run preview` already does the same thing.
          host: true,
        },
      };
    },

    async configureServer(server) {
      server.middlewares.use(serveCatalogue());
      server.middlewares.use(gzipEditStylesheets());

      // Generate the class lists and the family map once, at startup. The
      // stylesheets @source these files, so they must exist before the first
      // request for CSS arrives.
      try {
        const { classes } = await writeArtefacts();
        server.config.logger.info(
          `  ➜  edit mode: ${classes.toLocaleString()} classes available`
        );
      } catch (err) {
        // Do not take the dev server down with us — the game still works
        // without edit mode, and a silent failure here would look like a
        // stylesheet bug rather than a generator bug.
        server.config.logger.error(
          `  ➜  edit mode: could not generate the class list — ${(err as Error).message}`
        );
      }
    },

    transformIndexHtml: {
      order: 'pre',
      handler: (html) => rewriteIndexHtml(html),
    },
  };
}
