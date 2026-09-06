// Clumeral edit mode — gzip for the dev stylesheets.
//
// The spike measured this as the dominant cost of edit mode: Vite dev serves
// CSS uncompressed, so the full build is 5.24 MB on the wire per page load,
// over Tailscale, to a phone. Compression takes that to 193 kB — and the
// non-colour build from 1.16 MiB to 72 kB.
//
// Scoped to the two edit-mode stylesheets by exact path. Everything else on the
// dev server, including HMR, is untouched.

import { gzipSync } from 'node:zlib';
import type { Connect } from 'vite';

/** Paths worth compressing. Anything else passes straight through. */
const COMPRESSIBLE = ['/src/tailwind-edit.css', '/src/tailwind-edit-all.css'];

function wantsGzip(req: Connect.IncomingMessage): boolean {
  const accept = req.headers['accept-encoding'];
  return typeof accept === 'string' && accept.includes('gzip');
}

function isTarget(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0];
  return COMPRESSIBLE.includes(path);
}

/**
 * Buffer the response for our two stylesheets and send it gzipped.
 *
 * Vite generates this CSS through its own transform pipeline, so there is no
 * file on disk to serve directly — the response has to be captured as it is
 * written. write/end are replaced for the matching requests only, and restored
 * implicitly because the wrappers live on that one response object.
 */
export function gzipEditStylesheets(): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (!isTarget(req.url) || !wantsGzip(req)) return next();

    const chunks: Buffer[] = [];
    const write = res.write.bind(res);
    const end = res.end.bind(res);

    res.write = ((chunk: unknown, ...rest: unknown[]) => {
      if (chunk) chunks.push(Buffer.from(chunk as Buffer | string));
      // Swallow the write: the real body goes out in one piece from end().
      if (typeof rest[rest.length - 1] === 'function') (rest[rest.length - 1] as () => void)();
      return true;
    }) as typeof res.write;

    res.end = ((chunk?: unknown, ...rest: unknown[]) => {
      if (chunk && typeof chunk !== 'function') {
        chunks.push(Buffer.from(chunk as Buffer | string));
      }
      const body = Buffer.concat(chunks);
      // Nothing to compress (an error response, say) — send it as it came.
      if (body.length === 0) return end();

      const zipped = gzipSync(body);
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', String(zipped.length));
      // Byte ranges and caching both key on the encoding, so tell caches.
      res.setHeader('Vary', 'Accept-Encoding');
      res.write = write;
      res.end = end;
      return end(zipped);
    }) as typeof res.end;

    next();
  };
}
