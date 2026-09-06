import { describe, it, expect } from 'vitest';
import {
  createSession, serialiseSession, parseSession, captureEnvironment,
  sessionFilename, isUnconsumed, inTimestampOrder,
  SESSION_VERSION, CSS_PATCH_NOTE,
  type Patch, type Session,
} from '../src/edit-mode/patches.ts';

// C2 — the session file (brief items 41, 92, 93-97).
//
// This file is a CONTRACT with pi-dev-bot. /fold is being written against the
// shapes in brief items 93-96 and nothing else, so these tests are as much about
// pinning the contract as about catching bugs.
//
// Brief item 97 is why all three patch kinds appear below: as §11 was written,
// the suite could have gone green with the free-CSS box entirely unbuilt.

const PATCHES: Patch[] = [
  {
    kind: 'classes',
    breadcrumb: 'main > .card > .row > button',
    tag: 'button',
    text: 'Submit',
    before: ['rounded-lg', 'bg-bg', 'px-4', 'mt-4'],
    after: ['rounded-lg', 'bg-bg', 'px-4', 'mt-6'],
    flags: ['runtime-controlled'],
  },
  {
    kind: 'css',
    breadcrumb: 'main > .card',
    tag: 'div',
    text: '',
    declarations: 'margin-top: 1rem;',
    note: CSS_PATCH_NOTE,
  },
  {
    kind: 'raw',
    breadcrumb: 'main > .card > p',
    tag: 'p',
    text: 'Work out the number',
    before: ['text-sm'],
    after: ['text-sm', 'tracking-widest'],
    typed: 'tracking-widest',
  },
];

const session = createSession({
  createdAt: '2026-08-19T22:41:07.221Z',
  branch: 'dev/edit-mode-roundtrip',
  sha: '2896500c1d0e',
  viewport: { width: 402, height: 874, dpr: 3 },
  theme: { mode: 'dark', name: 'Lime' },
  patches: PATCHES,
});

describe('the session round-trips (brief item 85)', () => {
  it('survives JSON with the before-class list intact', () => {
    const back = parseSession(serialiseSession(session));
    const classes = back.patches[0] as Extract<Patch, { kind: 'classes' }>;
    expect(classes.before).toEqual(['rounded-lg', 'bg-bg', 'px-4', 'mt-4']);
    expect(classes.after).toEqual(['rounded-lg', 'bg-bg', 'px-4', 'mt-6']);
  });

  it('carries all three patch kinds (brief item 97)', () => {
    const back = parseSession(serialiseSession(session));
    expect(back.patches.map((p) => p.kind)).toEqual(['classes', 'css', 'raw']);
  });

  it('keeps what the raw field was actually given', () => {
    // Item 96: what he typed may not be a class this build contains, and the bot
    // needs the literal string to work out what he meant.
    const raw = parseSession(serialiseSession(session)).patches[2] as Extract<Patch, { kind: 'raw' }>;
    expect(raw.typed).toBe('tracking-widest');
  });

  it('keeps the free-CSS declarations and the do-not-apply note', () => {
    const css = parseSession(serialiseSession(session)).patches[1] as Extract<Patch, { kind: 'css' }>;
    expect(css.declarations).toBe('margin-top: 1rem;');
    expect(css.note).toBe(CSS_PATCH_NOTE);
  });

  it('keeps the flags a patch was raised with', () => {
    const back = parseSession(serialiseSession(session));
    expect((back.patches[0] as Extract<Patch, { kind: 'classes' }>).flags).toEqual(['runtime-controlled']);
  });

  it('keeps viewport, theme, branch and sha', () => {
    const back = parseSession(serialiseSession(session));
    expect(back.viewport).toEqual({ width: 402, height: 874, dpr: 3 });
    expect(back.theme).toEqual({ mode: 'dark', name: 'Lime' });
    expect(back.branch).toBe('dev/edit-mode-roundtrip');
    expect(back.sha).toBe('2896500c1d0e');
  });

  it('is version 1', () => {
    expect(session.version).toBe(1);
    expect(SESSION_VERSION).toBe(1);
  });
});

describe('a session from a shape this code does not know', () => {
  it('is refused rather than half-applied', () => {
    const future = JSON.stringify({ ...session, version: 2 });
    expect(() => parseSession(future)).toThrow(/version 2 is not 1/);
  });

  it('is refused if it carries no patches array', () => {
    expect(() => parseSession(JSON.stringify({ version: 1 }))).toThrow(/no patches array/);
  });
});

describe('the environment is read from the page, not passed in (brief item 41)', () => {
  it('captures the viewport Jamie was actually looking at', () => {
    document.documentElement.className = 'dark';
    document.documentElement.dataset.theme = 'Lime';
    const win = { innerWidth: 402, innerHeight: 874, devicePixelRatio: 3 } as Window;

    const env = captureEnvironment(document, win);
    expect(env.viewport).toEqual({ width: 402, height: 874, dpr: 3 });
  });

  it('captures which mode the edit was judged in', () => {
    // An edit made in dark mode changes light mode too, invisibly. Without this
    // the bot has no idea which one he was looking at when he called it right.
    document.documentElement.className = 'dark';
    document.documentElement.dataset.theme = 'Cherry';
    expect(captureEnvironment(document, window).theme).toEqual({ mode: 'dark', name: 'Cherry' });

    document.documentElement.className = 'light';
    expect(captureEnvironment(document, window).theme.mode).toBe('light');
  });

  it('reads the theme name from where colours.ts puts it', () => {
    // src/colours.ts:58 sets documentElement.dataset.theme. Nothing else in the
    // DOM carries the palette name, so if that line ever moves, this goes red.
    document.documentElement.dataset.theme = 'Grape';
    expect(captureEnvironment(document, window).theme.name).toBe('Grape');
  });

  it('does not invent a theme name when there is none', () => {
    delete document.documentElement.dataset.theme;
    expect(captureEnvironment(document, window).theme.name).toBe('');
  });
});

describe('the session filename (plan D3)', () => {
  it('is the timestamp with colons and dots made filesystem-safe', () => {
    expect(sessionFilename('2026-08-19T22:41:07.221Z')).toBe('2026-08-19T22-41-07-221Z.json');
  });

  it('sorts lexicographically into chronological order', () => {
    // This is the whole reason the format is fixed: /fold and the replay both
    // order sessions by name, with no parsing.
    const names = [
      sessionFilename('2026-08-19T22:41:07.221Z'),
      sessionFilename('2026-08-19T09:05:00.000Z'),
      sessionFilename('2026-08-20T01:00:00.000Z'),
    ];
    expect([...names].sort()).toEqual([
      '2026-08-19T09-05-00-000Z.json',
      '2026-08-19T22-41-07-221Z.json',
      '2026-08-20T01-00-00-000Z.json',
    ]);
  });
});

describe('which sessions replay (brief items 51, 92)', () => {
  it('ignores one /fold has already consumed', () => {
    expect(isUnconsumed('2026-08-19T22-41-07-221Z.json')).toBe(true);
    expect(isUnconsumed('2026-08-19T22-41-07-221Z.json.folded')).toBe(false);
  });

  it('replays every unconsumed session, oldest first', () => {
    // Item 51 flags this as the kind of thing that fails quietly: Jamie can tap
    // Done several times before anything is folded, and replaying only the
    // newest silently drops every earlier element he touched.
    const files = [
      '2026-08-20T01-00-00-000Z.json',
      '2026-08-19T09-05-00-000Z.json.folded',
      '2026-08-19T22-41-07-221Z.json',
    ];
    expect(inTimestampOrder(files)).toEqual([
      '2026-08-19T22-41-07-221Z.json',
      '2026-08-20T01-00-00-000Z.json',
    ]);
  });

  it('is not just the newest', () => {
    const files = ['2026-08-19T09-05-00-000Z.json', '2026-08-20T01-00-00-000Z.json'];
    expect(inTimestampOrder(files)).toHaveLength(2);
  });
});
