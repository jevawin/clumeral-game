// Clumeral edit mode — reading and writing session files.
//
// NODE SIDE. `.edit-sessions/<timestamp>.json` in the game working tree, one
// file per tap of Done, gitignored (brief item 49).
//
// This is the seam between the two repos. /fold reads what is written here and
// nothing else, so the shapes come from src/edit-mode/patches.ts — the published
// contract — rather than being restated.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sessionFilename, parseSession, serialiseSession, inTimestampOrder,
  type Session,
} from '../src/edit-mode/patches.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SESSIONS_DIR = resolve(REPO_ROOT, '.edit-sessions');

/**
 * Which branch and commit the edit was made against.
 *
 * The fix for a failure nobody had noticed (brief item 93): /fold locates
 * elements by grepping the before-class string, so if the tree moves between
 * Done and /fold the grep silently finds nothing — or finds the wrong element.
 * Recording both means the other repo can refuse to fold against a tree that
 * has moved on.
 */
export function gitInfo(cwd = REPO_ROOT): { branch: string; sha: string } {
  const run = (args: string[]): string =>
    execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
  try {
    return { branch: run(['rev-parse', '--abbrev-ref', 'HEAD']), sha: run(['rev-parse', 'HEAD']) };
  } catch {
    // Not a git checkout, or git is unavailable. Better an empty string that
    // /fold can refuse than a plausible-looking wrong value.
    return { branch: '', sha: '' };
  }
}

/** Write one session. Returns the filename, for the reply and for the log. */
export function writeSession(dir: string, session: Session): string {
  mkdirSync(dir, { recursive: true });
  const filename = sessionFilename(session.createdAt);
  writeFileSync(join(dir, filename), serialiseSession(session));
  return filename;
}

export interface LoadedSession {
  filename: string;
  session: Session;
}

/**
 * Every session /fold has not consumed, oldest first.
 *
 * Not just the newest, and brief item 51 says why: Jamie can tap Done several
 * times before anything is folded, and replaying only the last one would
 * silently drop every earlier element he touched.
 *
 * A file that will not parse is skipped rather than throwing. One bad session
 * must not stop Dave seeing the other four.
 */
export function readSessions(dir: string): LoadedSession[] {
  if (!existsSync(dir)) return [];

  const loaded: LoadedSession[] = [];
  for (const filename of inTimestampOrder(readdirSync(dir))) {
    try {
      loaded.push({ filename, session: parseSession(readFileSync(join(dir, filename), 'utf-8')) });
    } catch {
      // Half-written, hand-edited, or from a version this code does not know.
      continue;
    }
  }
  return loaded;
}

/**
 * The class lists to apply, flattened across every unconsumed session.
 *
 * Later sessions win, which is what "oldest first" means once they are merged:
 * if Jamie touched the same element in two sessions, the second is what he last
 * decided was right.
 *
 * Only `classes` and `raw` patches project. A `css` patch is a note for the bot
 * to convert (brief item 95) — applying its declarations literally would show
 * Dave something the codebase is never going to contain.
 */
export function projectionFrom(sessions: LoadedSession[]): Record<string, string[]> {
  const projection: Record<string, string[]> = {};
  for (const { session } of sessions) {
    for (const patch of session.patches) {
      if (patch.kind === 'css') continue;
      projection[patch.breadcrumb] = patch.after;
    }
  }
  return projection;
}
