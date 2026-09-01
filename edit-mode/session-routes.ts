// Clumeral edit mode — the Done endpoint and the replay endpoint.
//
// Done POSTs the patch set here and the middleware writes it into the working
// tree. Jamie then taps /fold in Telegram and the bot picks it up as an ordinary
// turn (brief item 49, design Unit 4).
//
// Chosen over having the browser message Telegram directly: one tap either way,
// no new trigger plumbing, and the bot's token stays on the Pi and never goes
// near a browser.

import type { Connect } from 'vite';
import { SESSIONS_DIR, gitInfo, writeSession, readSessions, projectionFrom } from './sessions.ts';
import { createSession, type Patch } from '../src/edit-mode/patches.ts';

export const DONE_ROUTE = '/__edit-mode/session';
export const REPLAY_ROUTE = '/__edit-mode/replay.json';

/** Body of a Done request: what the browser knows, without branch or sha. */
interface DoneBody {
  createdAt: string;
  viewport: { width: number; height: number; dpr: number };
  theme: { mode: string; name: string };
  patches: Patch[];
}

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function json(res: Parameters<Connect.NextHandleFunction>[1], status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/**
 * Write a session when Done is tapped.
 *
 * A failure must return non-2xx, because the overlay keeps the patch set on any
 * non-2xx and tells Jamie his changes are still there (brief item 74). Replying
 * 200 to a write that did not happen is the one outcome that loses work.
 */
export function receiveSession(dir = SESSIONS_DIR): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (!req.url || req.url.split('?')[0] !== DONE_ROUTE) return next();

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Allow', 'POST');
      return res.end('Method Not Allowed');
    }

    readBody(req)
      .then((raw) => {
        const body = JSON.parse(raw) as DoneBody;
        if (!Array.isArray(body.patches) || body.patches.length === 0) {
          return json(res, 400, { error: 'no patches' });
        }

        const { branch, sha } = gitInfo();
        const filename = writeSession(dir, createSession({
          createdAt: body.createdAt,
          branch,
          sha,
          viewport: body.viewport,
          theme: body.theme,
          patches: body.patches,
        }));

        json(res, 200, { filename, patches: body.patches.length });
      })
      .catch((err: Error) => {
        // The disk is full, the tree is read-only, the body was not JSON. Say
        // so rather than pretending it saved.
        json(res, 500, { error: err.message });
      });
  };
}

/**
 * Hand every unconsumed session to any page load.
 *
 * This was Dave's route and is now Jamie's reload safety net (plan task 1). The
 * read-only origin it was built for is gone — Dave previews on Cloudflare — but
 * the route stays, because the overlay fetches it on every load and projects
 * the result. It is how saved edits survive a refresh, a route change and a
 * wake from background. Deleting it with the rest of Dave's machinery would
 * have looked tidy and quietly broken that.
 */
export function serveReplay(dir = SESSIONS_DIR): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (!req.url || req.url.split('?')[0] !== REPLAY_ROUTE) return next();

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      res.setHeader('Allow', 'GET, HEAD');
      return res.end('Method Not Allowed');
    }

    const sessions = readSessions(dir);
    res.setHeader('Cache-Control', 'no-store');
    json(res, 200, {
      sessions: sessions.map((s) => s.filename),
      projection: projectionFrom(sessions),
    });
  };
}
