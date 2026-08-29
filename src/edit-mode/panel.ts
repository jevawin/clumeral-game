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

/**
 * Big enough for a thumb, small enough to fit several across a phone.
 *
 * 44px each plus 8px gaps put three controls on a row and pushed everything
 * else into a column — Jamie's screenshot, 2026-08-26: "everything is very
 * spaced and columns, there's room left-to-right for more."
 */
const TAP_TARGET = '38px';

/**
 * Hand-written, because the shadow root cannot see @theme.
 *
 * Deliberately plain: no gradients, no animation, no theming. It has one user,
 * it is never shipped, and item 82 makes simplicity the tie-break.
 */
const PANEL_CSS = `
  :host {
    all: initial;
    --keyboard-inset: 0px;
    font-family: system-ui, -apple-system, sans-serif;
    /* Above everything the game uses. index.html's bottom-centre stack is
       z-[300], and the pencil must clear it on a narrow screen (item 62). */
    position: fixed;
    inset: 0;
    z-index: 2147483000;
    pointer-events: none;
  }
  * { box-sizing: border-box; }
  /* the hidden attribute only sets display:none as a DEFAULT, and .row sets display:flex,
     which beats it — so a hidden row stayed on screen. That is the stray
     "Close" under the footer in Jamie's screenshot, 2026-08-26. */
  [hidden] { display: none !important; }

  .pencil {
    position: fixed;
    right: 16px;
    /* Clear of the bottom-centre stack, and above the home indicator. */
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    /* ABOVE the sheet. Jamie, 2026-08-24: "no way to close edit mode" — the
       sheet is fixed to the bottom and was covering the only way out. */
    z-index: 2;
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
    /* SITS ABOVE THE KEYBOARD.
       On iOS the on-screen keyboard shrinks the VISUAL viewport but leaves the
       layout viewport alone, so a bottom of 0 means bottom of the PAGE - underneath
       the keyboard, where nothing can be seen or tapped. --keyboard-inset is
       set from window.visualViewport by the overlay (Jamie, 2026-08-26: "the
       edit window hides behind the keyboard"). */
    bottom: var(--keyboard-inset, 0px);
    max-height: var(--sheet-max, 60vh);
    overflow-y: auto;
    z-index: 1;
    /* The sheet scrolls itself; the page underneath keeps its own scroll.
       Without this a flick inside the sheet drags the page instead once the
       sheet is at its end (Jamie, 2026-08-24, item 2). */
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    /* Right padding keeps the sheet clear of the pencil, so it never covers
       the only way out. Must come AFTER the shorthand. */
    padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0px));
    padding-right: 76px;
    background: #ffffff;
    color: #1a1a1a;
    border-top: 2px solid #1a1a1a;
    pointer-events: auto;
    font-size: 15px;
  }
  .sheet[hidden] { display: none; }

  .row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .row + .row { margin-top: 6px; }

  button {
    min-width: ${TAP_TARGET};
    min-height: ${TAP_TARGET};
    padding: 0 10px;
    font-size: 14px;
    border: 1px solid #1a1a1a;
    border-radius: 8px;
    background: #ffffff;
    color: #1a1a1a;
    font: inherit;
    cursor: pointer;
  }
  button:active { background: #ebebeb; }

  /* The search field stays put while results scroll under it. It used to
     scroll away with everything else — "the main box disappears". */
  .search-row {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #ffffff;
    margin: 0;
    padding-top: 4px;
  }
  .search-bar { position: sticky; top: 0; z-index: 2; background: #ffffff; }

  /* A class added in this session, told apart from what the element came with
     (Jamie, 2026-08-26). */
  .chip-added {
    background: #e6f7ea;
    border-color: #2f7a34;
    color: #14401a;
  }
  .chip-added .chip-name { font-weight: 700; }
  .chip-added .chip-step { background: #2f7a34; color: #ffffff; }
  .chip-added .chip-step:active { background: #1f5623; }

  .status { margin-top: 8px; font-size: 12px; line-height: 1.35; }
  .status:empty { display: none; }

  /* Jamie, 2026-08-24: "tiny, barely tappable, too close to above and below".
     It inherited nothing, so it rendered at the browser default next to 44px
     buttons. */
  input[type="search"], input[type="text"], textarea {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 44px;
    margin: 6px 0;
    padding: 0 12px;
    border: 2px solid #1a1a1a;
    border-radius: 8px;
    background: #ffffff;
    color: #1a1a1a;
    /* 16px or larger, or iOS zooms the whole page when it takes focus. */
    font: inherit;
    font-size: 16px;
  }
  textarea { min-height: 72px; padding: 10px 12px; }
  input:focus-visible, textarea:focus-visible, button:focus-visible {
    outline: 3px solid #0a6cff;
    outline-offset: 1px;
  }

  /* A touch of colour so the controls are told apart at a glance
     (Jamie, 2026-08-24, item 4). Hand-written: the shadow root cannot see the
     project's theme tokens, which is the accepted cost of sealing it. */
  /* A chip is one control: name in the middle, steppers either side where the
     class sits on a scale. Separate stepper rows doubled the sheet's height. */
  .chip {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid #2b5fd9;
    border-radius: 8px;
    overflow: hidden;
    background: #e8f0fe;
    color: #12306e;
  }
  .chip button {
    min-width: 0;
    min-height: 34px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    font: inherit;
  }
  /* Always a filled background, so a stepper always looks like a button.
     It used to be a 12% tint over a pale chip, which read as nothing. */
  .chip-step {
    width: 30px;
    font-size: 17px;
    font-weight: 700;
    background: #2b5fd9;
    color: #ffffff;
  }
  .chip-step:active { background: #1d47ab; }
  .chip-name { padding: 0 8px; font-size: 13px; white-space: nowrap; }

  /* Breadcrumbs read as a path, not a row of boxes. */
  .breadcrumb { gap: 2px 4px; font-size: 12px; line-height: 1.3; }
  .crumb {
    display: inline;
    padding: 0;
    color: #12306e;
    text-decoration: underline;
    cursor: pointer;
  }
  .crumb-sep { color: #aaaaaa; }

  .nav-btn { min-height: 34px; min-width: 0; font-size: 13px; padding: 0 8px; }

  /* The way in to the class picker, sitting with the classes it adds to. */
  .add-class {
    min-height: 34px;
    min-width: 0;
    font-size: 13px;
    border-style: dashed;
    border-color: #2b5fd9;
    color: #12306e;
  }
  .save-btn { background: #1a1a1a; color: #ffffff; border-color: #1a1a1a; }

  /* The picker covers the panel: its own filter, its own list, nothing else. */
  .picker { display: flex; flex-direction: column; min-height: 0; }
  .picker[hidden] { display: none !important; }
  .picker-head {
    position: sticky;
    top: 0;
    z-index: 2;
    background: #ffffff;
    padding-bottom: 4px;
  }
  .picker-back { min-width: 34px; min-height: 44px; font-size: 20px; padding: 0 8px; }
  .picker-list { overflow-y: auto; }
  .picker-family {
    display: block;
    width: 100%;
    text-align: left;
    min-height: 36px;
    margin-top: 4px;
    font-size: 13px;
    background: #f3f3f3;
  }
  .picker-class { min-height: 34px; min-width: 0; font-size: 13px; padding: 0 8px; }
  .footer button { min-height: 36px; font-size: 13px; }
  .footer button:last-child { background: #1a1a1a; color: #ffffff; }
  .search-family { margin: 10px 0 4px; font-size: 12px; color: #555555; }
  .search-group button { background: #f6f6f6; }
`;

/**
 * The outline drawn over the selected element.
 *
 * Brief item 61 asked for this and it was never built — Jamie's first report
 * was "highlight the element I'm on". A separate fixed box rather than an
 * outline ON the element, because styling the element would change the very
 * thing being judged, and would show up in its computed style.
 */
const HIGHLIGHT_CSS = `
  .highlight {
    position: fixed;
    pointer-events: none;
    border: 2px solid #0a6cff;
    background: rgba(10, 108, 255, 0.08);
    border-radius: 2px;
    z-index: 0;
  }
  .highlight[hidden] { display: none; }
  .highlight-label {
    position: absolute;
    top: -20px;
    left: -2px;
    padding: 1px 6px;
    background: #0a6cff;
    color: #ffffff;
    font-size: 11px;
    line-height: 18px;
    white-space: nowrap;
    border-radius: 2px;
  }
`;

export interface Panel {
  /** The host element in the page. Used to tell the tool's events from the game's. */
  readonly host: HTMLElement;
  /** The shadow root, for the pieces C4 and C5 mount inside. */
  readonly root: ShadowRoot;
  readonly sheet: HTMLElement;
  setMode(mode: 'play' | 'edit'): void;
  /** How tall the sheet currently is, so the page can be shortened to match. */
  sheetHeight(): number;
  /**
   * Lift the sheet clear of the on-screen keyboard, and cap its height to what
   * is actually visible.
   */
  setViewport(inset: number, visibleHeight: number): void;
  /** Draw the outline over this element, or clear it when given nothing. */
  highlight(el: Element | null, label?: string): void;
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
  style.textContent = PANEL_CSS + HIGHLIGHT_CSS;
  root.appendChild(style);

  const highlight = doc.createElement('div');
  highlight.className = 'highlight';
  highlight.hidden = true;
  const highlightLabel = doc.createElement('span');
  highlightLabel.className = 'highlight-label';
  highlight.appendChild(highlightLabel);
  root.appendChild(highlight);

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
    setViewport(inset, visibleHeight) {
      host.style.setProperty('--keyboard-inset', `${Math.max(0, Math.round(inset))}px`);
      // Never taller than the space left above the keyboard, or the top of the
      // sheet — the search field — is pushed off screen.
      host.style.setProperty('--sheet-max', `${Math.round(visibleHeight * 0.6)}px`);
    },

    sheetHeight() {
      return sheet.hidden ? 0 : sheet.getBoundingClientRect().height;
    },

    highlight(el, label = '') {
      if (!el) {
        highlight.hidden = true;
        return;
      }
      const box = el.getBoundingClientRect();
      highlight.hidden = false;
      highlight.style.top = `${box.top}px`;
      highlight.style.left = `${box.left}px`;
      highlight.style.width = `${box.width}px`;
      highlight.style.height = `${box.height}px`;
      highlightLabel.textContent = label;
    },

    setMode(mode) {
      pencil.dataset.mode = mode;
      // Nothing is selected in play mode, so nothing should be outlined.
      if (mode !== 'edit') highlight.hidden = true;
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
