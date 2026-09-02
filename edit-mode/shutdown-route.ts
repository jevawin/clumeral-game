// Clumeral edit mode — the route that stops the dev server.
//
// Jamie starts and stops his own dev server now (design 2026-08-31). Save & Stop
// writes the session and then asks the server to exit, so he never has to
// remember a second command in a second app.
//
// `apply: 'serve'` on the plugin keeps this out of every build, and
// tests/edit-mode-safety.spec.ts asserts the route string is absent from both
// built artefacts. A shutdown endpoint reaching a deployed Worker is the worst
// thing this feature could do, so it is checked against built files rather than
// trusted to a config flag.

import type { Connect } from 'vite';

export const SHUTDOWN_ROUTE = '/__edit-mode/shutdown';

/**
 * Is this request from the page we served, rather than from something else that
 * can reach us?
 *
 * TWO BRANCHES, BOTH LIVE, and the second is the one that matters. Fetch
 * Metadata headers are only attached to requests for trustworthy URLs — HTTPS,
 * localhost or 127.0.0.1. Jamie reaches the Pi over Tailscale at a plain-HTTP
 * name on port 5173, which is none of those, so `Sec-Fetch-Site` NEVER ARRIVES
 * ON THE PHONE. The Origin fallback is what actually guards his server; the
 * header branch only covers a desktop browser on localhost.
 *
 * Comparing `.host` rather than the raw string is deliberate: Origin is
 * `http://pi:5173` and Host is `pi:5173`, so a string comparison never matches.
 * It also survives the dev server ever sitting behind `tailscale serve` on
 * HTTPS, where a naive comparison would refuse every shutdown and look exactly
 * like an attack.
 *
 * AND THE HOST ITSELF HAS TO BE PLAUSIBLE, because Origin matching Host only
 * proves the request is self-consistent, not that it came from us. A page on
 * http://attacker.example:5173 whose DNS is rebound to the Pi sends a matching
 * pair and would otherwise be obeyed — from the open internet, not just the
 * tailnet. So the host must be loopback, an IP literal, a Tailscale name, or a
 * single-label name with no dots in it. A public domain always has a dot; a
 * MagicDNS short name like `pi` never does.
 *
 * WHAT THIS STILL DOES NOT STOP: curl, from a machine on the tailnet, which can
 * set every one of these headers to whatever it likes. Accepted knowingly — it
 * is a personal tailnet, the damage is a stopped dev server, and /dev starts
 * another.
 */
function sameOrigin(req: Connect.IncomingMessage): boolean {
  const site = req.headers['sec-fetch-site'];
  if (typeof site === 'string') return site === 'same-origin';

  const origin = req.headers.origin;
  const host = req.headers.host;
  if (typeof origin !== 'string' || typeof host !== 'string') return false;
  try {
    return new URL(origin).host === host && plausibleHost(host);
  } catch {
    // A malformed Origin is a refusal, not a crash that takes the dev server
    // down — which would be a rather ironic way to stop it.
    return false;
  }
}

/** Could this Host be a name that reaches this dev server? See sameOrigin. */
function plausibleHost(host: string): boolean {
  const name = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
  if (name === 'localhost' || name === '127.0.0.1' || name === '::1') return true;
  // An IP literal, v4 or v6 — the tailnet address, or a LAN one.
  if (/^[0-9.]+$/.test(name) || name.includes(':')) return true;
  if (name.endsWith('.ts.net')) return true;
  // A single-label name cannot be a public domain, so MagicDNS short names and
  // plain hostnames are fine.
  return !name.includes('.');
}

/**
 * @param stop what to do once the reply has actually gone out.
 */
export function receiveShutdown(stop: () => void): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (!req.url || req.url.split('?')[0] !== SHUTDOWN_ROUTE) return next();

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Allow', 'POST');
      return res.end('Method Not Allowed');
    }

    if (!sameOrigin(req)) {
      res.statusCode = 403;
      return res.end('Forbidden');
    }

    // STOP ONLY ONCE THE RESPONSE HAS FLUSHED. If the process exits first the
    // browser sees a dropped connection, which is indistinguishable from a
    // failure — and the overlay would then tell Jamie the server did not stop,
    // as the last thing that page ever says.
    // finish, with close as a backstop: if the socket dies between end() and
    // the flush Node emits close and never finish, and the server would live on
    // while the browser — correctly, per item 40 — reported it stopped.
    let done = false;
    const once = (): void => {
      if (done) return;
      done = true;
      stop();
    };
    res.once('finish', once);
    res.once('close', once);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ stopping: true }));
  };
}
