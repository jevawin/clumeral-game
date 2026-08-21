// Clumeral edit mode — the panel, in a sealed shadow root.
//
// SEALED, and Jamie's edits cannot reach it (brief items 64, 65). The failure
// this prevents: he selects <body>, adds a text size or a colour, and by design
// that inherits into everything — including the panel. A bad edit could make the
// panel unreadable, and the only way out of an unreadable panel is the panel.
//
// The cost, accepted knowingly: inside a shadow root the panel CANNOT use the
// project's Tailwind classes or tokens, so every value below is hand-written and
// will not follow the app's look. That is the trade Jamie sealed on 2026-08-18.
//
// `mode: 'closed'` so page scripts cannot reach in either.
//
// The panel is NOT held to the game's accessibility bar (brief item 81 — "only
// me using it, no accessibility needs, prioritise simplicity"). Item 76 is the
// exception and lives in intercept.ts: the GAME's keyboard must survive.

/** Big enough for a thumb, per the design's nav-arrow sizing. */
const TAP_TARGET = '44px';

/**
 * Hand-written, because the shadow root cannot see @theme.
 *
 * Deliberately plain: no gradients, no animation, no theming. It has one user,
 * it is never shipped, and item 82 makes simplicity the tie-break.
 */
const PANEL_CSS = `
  :host {
    all: initial;
    font-family: system-ui, -apple-system, sans-serif;
    /* Above everything the game uses. index.html's bottom-centre stack is
       z-[300], and the pencil must clear it on a narrow screen (item 62). */
    position: fixed;
    inset: 0;
    z-index: 2147483000;
    pointer-events: none;
  }
  * { box-sizing: border-box; }

  .pencil {
    position: fixed;
    right: 16px;
    /* Clear of the bottom-centre stack, and above the home indicator. */
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 2px solid #1a1a1a;
    background: #ffffff;
    color: #1a1a1a;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    pointer-events: auto;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  .pencil[data-mode="edit"] { background: #1a1a1a; color: #ffffff; }

  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 60vh;
    overflow-y: auto;
    padding: 12px 12px calc(12px + env(safe-area-inset-bottom, 0px));
    background: #ffffff;
    color: #1a1a1a;
    border-top: 2px solid #1a1a1a;
    pointer-events: auto;
    font-size: 15px;
  }
  .sheet[hidden] { display: none; }

  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .row + .row { margin-top: 10px; }

  button {
    min-width: ${TAP_TARGET};
    min-height: ${TAP_TARGET};
    padding: 0 12px;
    border: 1px solid #1a1a1a;
    border-radius: 8px;
    background: #ffffff;
    color: #1a1a1a;
    font: inherit;
    cursor: pointer;
  }
  button:active { background: #ebebeb; }

  .status { margin-top: 10px; font-size: 13px; line-height: 1.4; }
  .status:empty { display: none; }
`;

export interface Panel {
  /** The host element in the page. Used to tell the tool's events from the game's. */
  readonly host: HTMLElement;
  /** The shadow root, for the pieces C4 and C5 mount inside. */
  readonly root: ShadowRoot;
  readonly sheet: HTMLElement;
  setMode(mode: 'play' | 'edit'): void;
  /** Say something to Jamie. The copy lives in copy.ts. */
  say(message: string): void;
  onToggle(handler: () => void): void;
  destroy(): void;
}

export interface PanelOptions {
  /** Replay mode serves Dave: no pencil, no panel, just the applied edits. */
  replayOnly?: boolean;
}

export function createPanel(doc: Document, options: PanelOptions = {}): Panel {
  const host = doc.createElement('div');
  host.dataset.clumeralEditMode = '';
  const root = host.attachShadow({ mode: 'closed' });

  const style = doc.createElement('style');
  style.textContent = PANEL_CSS;
  root.appendChild(style);

  const pencil = doc.createElement('button');
  pencil.className = 'pencil';
  pencil.type = 'button';
  pencil.dataset.mode = 'play';
  pencil.textContent = '✎';
  // Brief item 71's wording. Also the string tests/edit-mode-safety.spec.ts
  // looks for in the production bundle, so it had better be distinctive.
  pencil.setAttribute('aria-label', 'Edit mode');

  const sheet = doc.createElement('div');
  sheet.className = 'sheet';
  sheet.hidden = true;

  const status = doc.createElement('p');
  status.className = 'status';
  sheet.appendChild(status);

  // Dave's origin gets the replayed edits and nothing to press (brief item 103).
  // Otherwise he edits, taps Done, and receives the one message written
  // carefully because it loses work — telling him to check a dev server he
  // cannot see and retry forever.
  if (!options.replayOnly) {
    root.appendChild(pencil);
    root.appendChild(sheet);
  }

  doc.body.appendChild(host);

  return {
    host,
    root,
    sheet,
    setMode(mode) {
      pencil.dataset.mode = mode;
      pencil.setAttribute('aria-label', mode === 'edit' ? 'Exit edit mode' : 'Edit mode');
      sheet.hidden = mode !== 'edit';
      if (mode !== 'edit') status.textContent = '';
    },
    say(message) {
      status.textContent = message;
    },
    onToggle(handler) {
      pencil.addEventListener('click', handler);
    },
    destroy() {
      host.remove();
    },
  };
}
