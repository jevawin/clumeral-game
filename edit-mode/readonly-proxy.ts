// Clumeral edit mode — the read-only port Dave's link points at.
//
// THE TRAP THIS EXISTS FOR, stated flatly because it is inverted from what you
// would expect (brief item 25): `cloudflared` connects to the dev server as a
// normal local client, so a request that started on Dave's phone arrives from
// 127.0.0.1. A guard reading "allow writes from localhost and the tailnet"
// would therefore ALLOW DAVE, and no-one would notice.
//
// So the guarantee is structural rather than a matter of trusting an address or
// a header: the tunnel points at a SECOND PORT WITH NO WRITE HANDLER AT ALL.
// Nothing reaching this port can write, whatever it claims to be. Jamie keeps
// using the dev server's own port over Tailscale (brief item 26).
//
// Header sniffing was considered and REJECTED outright (finding L4): if a
// cloudflared change stops setting cf-connecting-ip the guard silently stops
// guarding, and brief item 91 says nothing would notice.

import { createServer, request, type Server } from 'node:http';

/** Only these reach the dev server. Everything else is refused. */
const SAFE_METHODS = ['GET', 'HEAD'];

export interface ReadOnlyProxyOptions {
  /** The port this proxy listens on — the one the tunnel points at. */
  port: number;
  /** The dev server's own port. */
  target: number;
  host?: string;
}

/**
 * Start the read-only proxy.
 *
 * Started and stopped by the Vite plugin, not by anyone remembering to run it
 * (brief item 107). If the dev server is not up it serves 503 rather than
 * failing to start, so the tunnel URL stays valid across a dev-server restart.
 */
export function startReadOnlyProxy(options: ReadOnlyProxyOptions): Server {
  const { port, target, host = '127.0.0.1' } = options;

  const server = createServer((req, res) => {
    if (!SAFE_METHODS.includes(req.method ?? '')) {
      // The whole point. Not a check that can be argued with — this port has
      // nowhere to forward a write to.
      res.statusCode = 405;
      res.setHeader('Allow', SAFE_METHODS.join(', '));
      res.end('This is a read-only view. Edits are made on the dev server itself.');
      return;
    }

    const upstream = request(
      { host, port: target, path: req.url, method: req.method, headers: req.headers },
      (proxied) => {
        // Tell the overlay it is on the read-only origin, so it renders in
        // replay-only mode: no pencil, no panel (brief item 103). It comes from
        // WHICH LISTENER SERVED THE PAGE, so nothing Dave's browser sends can
        // change it.
        res.setHeader('X-Clumeral-Edit-Mode', 'replay');
        res.writeHead(proxied.statusCode ?? 502, proxied.headers);
        proxied.pipe(res);
      }
    );

    upstream.on('error', () => {
      // The dev server is not running. 503 rather than dying, so the tunnel
      // survives a restart and Dave gets a message rather than a dead link.
      res.statusCode = 503;
      res.end('The dev server is not running.');
    });

    req.pipe(upstream);
  });

  server.listen(port);
  return server;
}

/** Would this request be refused? Exported so the guard can be tested directly. */
export function isRefused(method: string): boolean {
  return !SAFE_METHODS.includes(method);
}
