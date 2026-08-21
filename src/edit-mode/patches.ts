// Clumeral edit mode — the patch model and the session file.
//
// THIS IS A CONTRACT WITH `pi-dev-bot`. The shapes below are brief items 93-96,
// frozen on 2026-08-19 and published so /fold could be written against them in
// the other repo. Do not paraphrase them, do not add a field without saying so
// in the group first. Jamie, 2026-08-19: "if planning changes any field, say so
// explicitly rather than just editing it."
//
// One file per tap of Done.

/** Bumped only if the shape changes, so the other repo can refuse what it cannot read. */
export const SESSION_VERSION = 1;

/** Something the overlay noticed and the bot needs to know about. */
export type PatchFlag = 'runtime-controlled';

interface PatchContext {
  /** `main > .card > .row > button` — how the bot finds it in source. */
  breadcrumb: string;
  tag: string;
  /** The first few words of visible text. Part of the grep evidence. */
  text: string;
}

/** The ordinary case: classes changed. */
export interface ClassesPatch extends PatchContext {
  kind: 'classes';
  before: string[];
  after: string[];
  flags?: PatchFlag[];
}

/** The desktop free-CSS box. Not a class change, so not a classes patch. */
export interface CssPatch extends PatchContext {
  kind: 'css';
  declarations: string;
  note: string;
}

/** The desktop raw class field, where Jamie typed instead of picking. */
export interface RawPatch extends PatchContext {
  kind: 'raw';
  before: string[];
  after: string[];
  /** What he actually typed — which may not be a class this build contains. */
  typed: string;
  flags?: PatchFlag[];
}

export type Patch = ClassesPatch | CssPatch | RawPatch;

export interface Session {
  version: number;
  createdAt: string;
  /** The branch and commit the edit was made against. */
  branch: string;
  sha: string;
  /** Item 41: Jamie cannot see other widths, so the width he used is context. */
  viewport: { width: number; height: number; dpr: number };
  /** Finding M6: an edit made in dark mode changes light mode too, invisibly. */
  theme: { mode: string; name: string };
  patches: Patch[];
}

/** The standing note on a css patch, so the bot never applies it literally. */
export const CSS_PATCH_NOTE = 'not applied literally - the bot converts it';

/**
 * The session filename.
 *
 * The schema says `.edit-sessions/<timestamp>.json` and never says what the
 * timestamp looks like. /fold has to glob these and replay them IN ORDER (brief
 * item 51), so the format is fixed here and flagged as an addition to the
 * contract rather than a change to it:
 *
 *   2026-08-19T22-41-07-221Z.json
 *
 * `createdAt` with `:` and `.` replaced by `-`. Sorts lexicographically, which
 * is therefore chronologically, so ordering needs no parsing. Safe on any
 * filesystem.
 */
export function sessionFilename(createdAt: string): string {
  return `${createdAt.replace(/[:.]/g, '-')}.json`;
}

/** Is this a session file /fold has not consumed yet? */
export function isUnconsumed(filename: string): boolean {
  // /fold renames a session it has taken to `<ts>.json.folded` (brief item 92).
  // Replaying a consumed one re-applies patches on top of source that already
  // carries them, which for a stepper walk compounds invisibly.
  return filename.endsWith('.json');
}

/** Oldest first. Jamie can tap Done several times before anything is folded. */
export function inTimestampOrder(filenames: string[]): string[] {
  return [...filenames].filter(isUnconsumed).sort();
}

/**
 * Where the overlay is running, captured at Done.
 *
 * Read from the document rather than passed in, because every one of these has
 * been got wrong by being passed a fixture:
 *
 *   - viewport is brief item 41 — Jamie cannot see clamp or responsive
 *     behaviour on one device, so the width he judged it at is the missing
 *     context for the conversation afterwards.
 *   - theme.mode: an edit made in dark mode changes light mode too, and the bot
 *     otherwise has no idea which one he was looking at.
 *   - theme.name comes from `documentElement.dataset.theme`, which
 *     src/colours.ts already sets to the palette name ("Lime"). Nothing else in
 *     the DOM carries it.
 */
export function captureEnvironment(doc: Document, win: Window): Pick<Session, 'viewport' | 'theme'> {
  const root = doc.documentElement;
  return {
    viewport: {
      width: win.innerWidth,
      height: win.innerHeight,
      dpr: win.devicePixelRatio,
    },
    theme: {
      mode: root.classList.contains('dark') ? 'dark' : 'light',
      name: root.dataset.theme ?? '',
    },
  };
}

export interface SessionInput {
  createdAt: string;
  branch: string;
  sha: string;
  viewport: Session['viewport'];
  theme: Session['theme'];
  patches: Patch[];
}

export function createSession(input: SessionInput): Session {
  return { version: SESSION_VERSION, ...input };
}

/** Serialise for the POST body. Pretty-printed: a human reads these while /fold is young. */
export function serialiseSession(session: Session): string {
  return JSON.stringify(session, null, 2);
}

/**
 * Read a session back, refusing anything this code does not understand.
 *
 * Deliberately strict about `version`: a file from a future shape must fail
 * loudly here rather than half-apply during Dave's replay.
 */
export function parseSession(json: string): Session {
  const parsed = JSON.parse(json) as Session;
  if (parsed.version !== SESSION_VERSION) {
    throw new Error(`session version ${parsed.version} is not ${SESSION_VERSION}`);
  }
  if (!Array.isArray(parsed.patches)) throw new Error('session has no patches array');
  return parsed;
}
