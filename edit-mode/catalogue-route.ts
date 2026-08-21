// Clumeral edit mode — serve the generated catalogue to the browser.
//
// NODE SIDE. The overlay needs the class list and the family map, and both are
// generated at dev-server start into gitignored files (brief item 59 — a
// committed 386 kB list of class names is issue #312's failure mode at full
// volume). So they are read from disk and served, never bundled.
//
// GET-only by construction, which matters for the read-only origin: Dave's
// replay page has to fetch this too, and the proxy forwards GET (plan D5).

import { readFileSync, existsSync } from 'node:fs';
import type { Connect } from 'vite';
import { ARTEFACTS } from './classlist.ts';

export const CATALOGUE_ROUTE = '/__edit-mode/catalogue.json';

export function serveCatalogue(): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (!req.url || req.url.split('?')[0] !== CATALOGUE_ROUTE) return next();

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      res.setHeader('Allow', 'GET, HEAD');
      return res.end('Method Not Allowed');
    }

    if (!existsSync(ARTEFACTS.classes) || !existsSync(ARTEFACTS.families)) {
      // The generator failed at startup and said so in the server log. Answer
      // honestly rather than serving an empty catalogue, which would look like
      // "no class matches anything you type".
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'catalogue not generated — see the dev server log' }));
    }

    const classes = readFileSync(ARTEFACTS.classes, 'utf-8').split('\n').filter(Boolean);
    const families = JSON.parse(readFileSync(ARTEFACTS.families, 'utf-8'));

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    // Regenerated on every server start, so a stale cached copy would offer
    // classes a changed @theme no longer builds.
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ classes, families }));
  };
}
