import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  writeSession, readSessions, projectionFrom, gitInfo,
} from '../edit-mode/sessions.ts';
import { createSession, parseSession, sessionFilename, type Patch } from '../src/edit-mode/patches.ts';

// D1 and D2 — writing the session, and replaying the unconsumed ones
// (brief items 21, 49, 51, 74, 92, 93).

let dir: string;

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'clumeral-sessions-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const patch = (breadcrumb: string, after: string[]): Patch => ({
  kind: 'classes', breadcrumb, tag: 'div', text: '', before: ['mt-4'], after,
});

const session = (createdAt: string, patches: Patch[]) => createSession({
  createdAt, branch: 'dev/edit-mode-roundtrip', sha: 'abc123',
  viewport: { width: 402, height: 874, dpr: 3 },
  theme: { mode: 'dark', name: 'Lime' },
  patches,
});

describe('writing a session (brief item 49)', () => {
  it('writes one file per tap of Done, named by its timestamp', () => {
    const filename = writeSession(dir, session('2026-08-19T22:41:07.221Z', [patch('main > p', ['mt-6'])]));
    expect(filename).toBe('2026-08-19T22-41-07-221Z.json');
    expect(readdirSync(dir)).toEqual([filename]);
  });

  it('writes something the other repo can read back', () => {
    // The file IS the contract. If this cannot round-trip, /fold cannot work.
    const original = session('2026-08-19T22:41:07.221Z', [patch('main > p', ['mt-6'])]);
    const filename = writeSession(dir, original);
    expect(parseSession(readFileSync(join(dir, filename), 'utf-8'))).toEqual(original);
  });

  it('creates the directory if it is not there yet', () => {
    const fresh = join(dir, 'nested', 'deeper');
    expect(() => writeSession(fresh, session('2026-08-19T22:41:07.221Z', [patch('p', ['mt-6'])]))).not.toThrow();
  });
});

describe('branch and sha (brief item 93)', () => {
  it('records where the edit was made', () => {
    // /fold locates elements by grepping the before-class string, so if the
    // tree moves between Done and /fold the grep silently finds nothing, or
    // finds the wrong element.
    const info = gitInfo();
    expect(info.branch).toBeTruthy();
    expect(info.sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('gives empty strings rather than a plausible wrong value off a checkout', () => {
    expect(gitInfo(tmpdir())).toEqual({ branch: '', sha: '' });
  });
});

describe('which sessions replay (brief items 51, 92)', () => {
  it('replays every unconsumed session, oldest first', () => {
    // Jamie can tap Done several times before anything is folded. Replaying
    // only the last would silently drop every earlier element he touched.
    writeSession(dir, session('2026-08-20T01:00:00.000Z', [patch('main > b', ['mt-8'])]));
    writeSession(dir, session('2026-08-19T09:05:00.000Z', [patch('main > a', ['mt-5'])]));

    const loaded = readSessions(dir);
    expect(loaded.map((s) => s.session.createdAt)).toEqual([
      '2026-08-19T09:05:00.000Z',
      '2026-08-20T01:00:00.000Z',
    ]);
  });

  it('ignores one /fold has already consumed', () => {
    // /fold renames a session it has taken to <ts>.json.folded. Replaying a
    // consumed one re-applies patches on top of source that already carries
    // them, which for a stepper walk compounds invisibly.
    writeSession(dir, session('2026-08-19T09:05:00.000Z', [patch('main > a', ['mt-5'])]));
    const taken = sessionFilename('2026-08-20T01:00:00.000Z');
    writeFileSync(join(dir, `${taken}.folded`), JSON.stringify(session('2026-08-20T01:00:00.000Z', [])));

    expect(readSessions(dir)).toHaveLength(1);
  });

  it('skips a file it cannot read rather than losing the rest', () => {
    // Half-written, hand-edited, or from a version this code does not know.
    // One bad session must not stop Dave seeing the other four.
    writeSession(dir, session('2026-08-19T09:05:00.000Z', [patch('main > a', ['mt-5'])]));
    writeFileSync(join(dir, '2026-08-19T10-00-00-000Z.json'), '{ half writ');
    writeFileSync(join(dir, '2026-08-19T11-00-00-000Z.json'), JSON.stringify({ version: 99, patches: [] }));

    expect(readSessions(dir)).toHaveLength(1);
  });

  it('is empty when nothing has been saved', () => {
    expect(readSessions(join(dir, 'never-created'))).toEqual([]);
  });
});

describe('what the replay applies', () => {
  it('merges every session, with the later one winning', () => {
    // If Jamie touched the same element twice, the second is what he last
    // decided was right.
    writeSession(dir, session('2026-08-19T09:00:00.000Z', [patch('main > a', ['mt-5'])]));
    writeSession(dir, session('2026-08-19T10:00:00.000Z', [patch('main > a', ['mt-9'])]));

    expect(projectionFrom(readSessions(dir))).toEqual({ 'main > a': ['mt-9'] });
  });

  it('keeps edits to different elements from every session', () => {
    writeSession(dir, session('2026-08-19T09:00:00.000Z', [patch('main > a', ['mt-5'])]));
    writeSession(dir, session('2026-08-19T10:00:00.000Z', [patch('main > b', ['mt-9'])]));

    expect(projectionFrom(readSessions(dir))).toEqual({
      'main > a': ['mt-5'],
      'main > b': ['mt-9'],
    });
  });

  it('never applies a free-CSS entry literally', () => {
    // A css patch is a note for the bot to convert (brief item 95). Applying
    // its declarations would show Dave something the codebase is never going to
    // contain.
    writeSession(dir, session('2026-08-19T09:00:00.000Z', [
      { kind: 'css', breadcrumb: 'main > c', tag: 'div', text: '', declarations: 'margin-top: 1rem;', note: 'x' },
    ]));
    expect(projectionFrom(readSessions(dir))).toEqual({});
  });

  it('applies a raw-field patch, because that one IS a class change', () => {
    writeSession(dir, session('2026-08-19T09:00:00.000Z', [
      { kind: 'raw', breadcrumb: 'main > d', tag: 'p', text: '', before: [], after: ['tracking-widest'], typed: 'tracking-widest' },
    ]));
    expect(projectionFrom(readSessions(dir))).toEqual({ 'main > d': ['tracking-widest'] });
  });
});
