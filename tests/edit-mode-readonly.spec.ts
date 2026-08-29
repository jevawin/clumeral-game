// @vitest-environment node
//
// Real sockets, so this file needs Node's fetch rather than jsdom's stub. The
// rest of the suite is jsdom because it is testing browser code; this one is
// testing a server.
import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import { startReadOnlyProxy, isRefused } from '../edit-mode/readonly-proxy.ts';

// D3 — the read-only port (brief items 19, 25, 26, 27, 103, 107).
//
// Brief item 27: test it as a POSITIVE. Assert that a POST to the read-only
// port is REFUSED, not merely that a POST to the dev port succeeds. This is
// also Jamie's manual check 90.3, and the brief says plainly why it needs a
// test: a broken write guard looks exactly like a working one from Jamie's
// side, because his own saves come in over Tailscale and succeed either way.

let proxy: Server | undefined;
let upstream: Server | undefined;

afterEach(async () => {
  await Promise.all([proxy, upstream].map((s) => s && new Promise((r) => s.close(r))));
  proxy = undefined;
  upstream = undefined;
});

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve((server.address() as { port: number }).port);
    });
  });
}

/** startReadOnlyProxy listens itself, so wait for it rather than listening again. */
function started(server: Server): Promise<number> {
  proxy = server;
  return new Promise((resolve) => {
    if (server.listening) return resolve((server.address() as { port: number }).port);
    server.once('listening', () => resolve((server.address() as { port: number }).port));
  });
}

async function startUpstream(): Promise<number> {
  upstream = createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end(`upstream saw ${req.method} ${req.url}`);
  });
  return listen(upstream);
}

async function call(port: number, method: string, path = '/'): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    ...(method === 'POST' ? { body: '{}' } : {}),
  });
}

describe('the write guard is structural, not a check (brief items 25, 26)', () => {
  it('refuses a POST', async () => {
    // THE assertion. cloudflared connects as a normal local client, so Dave's
    // request arrives from 127.0.0.1 — an address-based guard would allow him
    // and nobody would notice. This port has nowhere to forward a write to.
    const target = await startUpstream();
    const port = await started(startReadOnlyProxy({ port: 0, target }));

    const res = await call(port, 'POST', '/__edit-mode/session');
    expect(res.status).toBe(405);
    expect(await res.text()).toContain('read-only');
  });

  it('refuses every other write method too', async () => {
    const target = await startUpstream();
    const port = await started(startReadOnlyProxy({ port: 0, target }));

    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      expect((await call(port, method)).status, method).toBe(405);
    }
  });

  it('cannot be talked out of it by a header', async () => {
    // Header sniffing was rejected outright (finding L4): if a cloudflared
    // change stops setting cf-connecting-ip the guard silently stops guarding.
    const target = await startUpstream();
    const port = await started(startReadOnlyProxy({ port: 0, target }));

    const res = await fetch(`http://127.0.0.1:${port}/__edit-mode/session`, {
      method: 'POST',
      headers: { 'cf-connecting-ip': '127.0.0.1', 'x-forwarded-for': '127.0.0.1' },
      body: '{}',
    });
    expect(res.status).toBe(405);
  });

  it('says which methods are allowed', async () => {
    const target = await startUpstream();
    const port = await started(startReadOnlyProxy({ port: 0, target }));
    expect((await call(port, 'POST')).headers.get('allow')).toBe('GET, HEAD');
  });

  it('is a plain function of the method, testable without a socket', () => {
    expect(isRefused('POST')).toBe(true);
    expect(isRefused('GET')).toBe(false);
    expect(isRefused('HEAD')).toBe(false);
  });
});

describe('reading still works', () => {
  it('forwards a GET to the dev server', async () => {
    const target = await startUpstream();
    const port = await started(startReadOnlyProxy({ port: 0, target }));

    const res = await call(port, 'GET', '/play');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('upstream saw GET /play');
  });

  it('forwards the catalogue and replay endpoints Dave needs', async () => {
    // Without these his page loads with no classes to apply and no catalogue,
    // which looks exactly like "the edits did not happen".
    const target = await startUpstream();
    const port = await started(startReadOnlyProxy({ port: 0, target }));

    for (const path of ['/__edit-mode/catalogue.json', '/__edit-mode/replay.json']) {
      expect((await call(port, 'GET', path)).status, path).toBe(200);
    }
  });
});

describe('what Dave-s browser is told (brief item 103)', () => {
  it('marks the response as the replay origin', async () => {
    // From WHICH LISTENER SERVED THE PAGE, so nothing his browser sends can
    // change it. The overlay reads this and renders no pencil and no panel —
    // otherwise Dave edits, taps Done, and gets the message written carefully
    // because it loses work, telling him to check a dev server he cannot see.
    const target = await startUpstream();
    const port = await started(startReadOnlyProxy({ port: 0, target }));

    expect((await call(port, 'GET')).headers.get('x-clumeral-edit-mode')).toBe('replay');
  });
});

describe('when the dev server is not running (brief item 107)', () => {
  it('answers 503 rather than dying', async () => {
    // The tunnel URL has to survive a dev-server restart, or Dave gets a dead
    // link every time Jamie touches the config.
    const port = await started(startReadOnlyProxy({ port: 0, target: 1 }));
    const res = await call(port, 'GET');
    expect(res.status).toBe(503);
    expect(await res.text()).toContain('not running');
  });

  it('still refuses writes while the dev server is down', async () => {
    const port = await started(startReadOnlyProxy({ port: 0, target: 1 }));
    expect((await call(port, 'POST')).status).toBe(405);
  });
});
