import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { Connect } from 'vite';
import { receiveShutdown, SHUTDOWN_ROUTE } from '../edit-mode/shutdown-route.ts';

// Plan task 3. Brief items 3, 34, 40, 41.
//
// The route that stops Jamie's dev server. Two things are being proved: that
// nothing else can call it, and that the reply goes out BEFORE the process is
// told to exit.

/** A response that behaves like Node's: end() flushes, and flushing emits finish. */
class FakeResponse extends EventEmitter {
  statusCode = 0;
  headers: Record<string, string> = {};
  body = '';
  setHeader(name: string, value: string): void {
    this.headers[name.toLowerCase()] = value;
  }
  end(chunk?: string): this {
    if (chunk) this.body = chunk;
    this.emit('finish');
    return this;
  }
}

function call(headers: Record<string, string>, method = 'POST', url = SHUTDOWN_ROUTE) {
  const stop = vi.fn();
  const res = new FakeResponse();
  const next = vi.fn();
  const req = { url, method, headers } as unknown as Connect.IncomingMessage;
  receiveShutdown(stop)(req, res as never, next);
  return { stop, res, next };
}

const SAME_SITE = { 'sec-fetch-site': 'same-origin', host: 'pi:5173' };
const PHONE = { origin: 'http://pi:5173', host: 'pi:5173' };

describe('only a POST reaches it', () => {
  it('refuses GET with 405 and does not stop anything', () => {
    const { stop, res } = call(SAME_SITE, 'GET');
    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe('POST');
    expect(stop).not.toHaveBeenCalled();
  });

  it('leaves other URLs alone', () => {
    const { next, res } = call(SAME_SITE, 'POST', '/index.html');
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(0);
  });
});

describe('only our own page may stop the server (brief item 41)', () => {
  it('refuses a cross-site request', () => {
    const { stop, res } = call({ 'sec-fetch-site': 'cross-site', host: 'pi:5173' });
    expect(res.statusCode).toBe(403);
    expect(stop).not.toHaveBeenCalled();
  });

  it('refuses an Origin on a different host', () => {
    const { stop, res } = call({ origin: 'http://evil.example', host: 'pi:5173' });
    expect(res.statusCode).toBe(403);
    expect(stop).not.toHaveBeenCalled();
  });

  it('refuses a request carrying neither header', () => {
    const { stop, res } = call({ host: 'pi:5173' });
    expect(res.statusCode).toBe(403);
    expect(stop).not.toHaveBeenCalled();
  });

  it('refuses a malformed Origin rather than throwing', () => {
    const { stop, res } = call({ origin: 'not a url', host: 'pi:5173' });
    expect(res.statusCode).toBe(403);
    expect(stop).not.toHaveBeenCalled();
  });
});

describe('the Host has to be a name that could reach us', () => {
  it('refuses a matching Origin and Host on a public-looking domain', () => {
    // DNS rebinding. Origin matching Host only proves the request is
    // self-consistent: a page on a public domain whose DNS points at the Pi
    // sends a matching pair, and would otherwise stop the server — from the
    // open internet, not just the tailnet.
    const { stop, res } = call({ origin: 'http://attacker.example:5173', host: 'attacker.example:5173' });
    expect(res.statusCode).toBe(403);
    expect(stop).not.toHaveBeenCalled();
  });

  it('accepts a MagicDNS short name, which cannot be a public domain', () => {
    const { stop, res } = call({ origin: 'http://pi:5173', host: 'pi:5173' });
    expect(res.statusCode).toBe(200);
    expect(stop).toHaveBeenCalledOnce();
  });

  it('accepts a Tailscale name and a bare IP', () => {
    expect(call({ origin: 'http://pi.tailnet.ts.net:5173', host: 'pi.tailnet.ts.net:5173' }).res.statusCode).toBe(200);
    expect(call({ origin: 'http://100.64.0.1:5173', host: '100.64.0.1:5173' }).res.statusCode).toBe(200);
  });

  it('accepts localhost', () => {
    expect(call({ origin: 'http://localhost:5173', host: 'localhost:5173' }).res.statusCode).toBe(200);
  });
});

describe('the two branches that do let it through', () => {
  it('accepts Sec-Fetch-Site: same-origin — the desktop-on-localhost case', () => {
    const { stop, res } = call(SAME_SITE);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ stopping: true });
    expect(stop).toHaveBeenCalledOnce();
  });

  it('accepts a matching Origin with NO Sec-Fetch-Site — the phone over Tailscale', () => {
    // The branch that actually runs on Jamie's phone. Fetch Metadata headers
    // are only attached to trustworthy URLs, and the Tailscale address is plain
    // HTTP on 5173 — so Sec-Fetch-Site never arrives and this is the whole
    // guard. Testing only the header branch would leave it uncovered.
    const { stop, res } = call(PHONE);
    expect(res.statusCode).toBe(200);
    expect(stop).toHaveBeenCalledOnce();
  });
});

describe('the reply goes out before the server dies (brief item 40)', () => {
  it('still stops if the socket closes without ever emitting finish', () => {
    // An aborted connection emits close, not finish. Without a backstop the
    // server would live on while the browser — correctly, per item 40 —
    // reported that it had stopped.
    const stop = vi.fn();
    const res = new FakeResponse();
    const req = { url: SHUTDOWN_ROUTE, method: 'POST', headers: PHONE } as unknown as Connect.IncomingMessage;
    res.end = function (this: FakeResponse) { return this; } as FakeResponse['end'];
    receiveShutdown(stop)(req, res as never, vi.fn());
    res.emit('close');
    expect(stop).toHaveBeenCalledOnce();
  });

  it('stops exactly once when both events fire', () => {
    const stop = vi.fn();
    const res = new FakeResponse();
    const req = { url: SHUTDOWN_ROUTE, method: 'POST', headers: PHONE } as unknown as Connect.IncomingMessage;
    receiveShutdown(stop)(req, res as never, vi.fn());
    res.emit('close');
    expect(stop).toHaveBeenCalledOnce();
  });

  it('does not stop until the response has flushed', () => {
    const stop = vi.fn();
    const res = new FakeResponse();
    const req = { url: SHUTDOWN_ROUTE, method: 'POST', headers: PHONE } as unknown as Connect.IncomingMessage;

    // A response that never flushes: the handler runs to completion, but finish
    // never fires. If stop were called inline, this would already have run.
    res.end = function (this: FakeResponse) { return this; } as FakeResponse['end'];
    receiveShutdown(stop)(req, res as never, vi.fn());
    expect(stop, 'stopped before the reply was flushed').not.toHaveBeenCalled();

    res.emit('finish');
    expect(stop).toHaveBeenCalledOnce();
  });
});
