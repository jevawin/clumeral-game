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
  /* No double-tap-to-zoom anywhere in the tool. On a panel of small buttons a
     stray second tap zooms the page instead of pressing anything (Jamie,
     2026-08-27). */
  :host, .sheet, .pencil, .picker, button, a, input, textarea {
    touch-action: manipulation;
  }
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

  /* Save & Stop. Beside the pencil, outside the sheet, so it is reachable
     without opening the editor (brief items 18, 39). Hidden in edit mode: the
     pencil is the save control there, and two ways to do one thing on a phone
     is one too many. */
  .stop-btn {
    position: fixed;
    right: calc(16px + 56px + 8px);
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    z-index: 2;
    height: 56px;
    padding: 0 16px;
    border-radius: 28px;
    border: 2px solid #1a1a1a;
    background: #ffffff;
    color: #1a1a1a;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    pointer-events: auto;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  .stop-btn[hidden] { display: none !important; }
  .stop-btn:disabled { opacity: 0.5; }
  .pencil:disabled { opacity: 0.5; }

  /* The one surface that survives leaving the editor.
     say() writes into .status, which lives INSIDE .sheet — and setMode hides
     the sheet and blanks the status on every exit from edit mode. Every message
     this feature shows appears in play mode, so without this they could not be
     seen at all (brief item 43).

     Above the pencil rather than left of it: the game's own bottom-centre stack
     is fixed bottom-6 left-1/2 in index.html, and this host is z-index
     2147483000, so anything of ours in that band covers a live toast
     (brief item 44).

     Styled in full because :host resets everything, and this sits directly over
     a game that has dark themes. No pointer-events, so it cannot eat a tap. */
  .notice {
    position: fixed;
    right: 16px;
    bottom: calc(16px + 56px + 8px + env(safe-area-inset-bottom, 0px));
    z-index: 2;
    max-width: min(320px, calc(100vw - 32px));
    margin: 0;
    padding: 8px 10px;
    border: 2px solid #1a1a1a;
    border-radius: 8px;
    background: #ffffff;
    color: #1a1a1a;
    font-size: 13px;
    line-height: 1.35;
    text-align: right;
  }
  .notice:empty { display: none; }

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

  button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; }
  .icon { flex: none; }

  /* A class switched off rather than removed: still listed, visibly inactive,
     tap to bring it back (Jamie, 2026-08-27). */
  .chip-off { opacity: 0.45; border-style: dashed; }
  .chip-off .chip-name { text-decoration: line-through; }

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
  /* What the pencil now does, said in words. */
  .hint { display: block; margin-top: 8px; font-size: 12px; color: #555555; }
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

import { COPY } from './copy.ts';

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
  /**
   * Say something that must OUTLIVE the editor closing.
   *
   * say() writes into the sheet, which setMode hides and blanks. Anything shown
   * in play mode — everything Save & Stop reports — has to come through here.
   */
  notify(message: string): void;
  /**
   * Show or hide Save & Stop.
   *
   * The ONLY way it is ever shown. setMode may hide it in edit mode and must
   * never show it, so a pill pointing at a server that has already stopped
   * cannot be brought back by Escape or the back gesture.
   */
  setStopVisible(visible: boolean): void;
  /** Grey the pill out while a save or a stop is in flight. */
  setStopBusy(busy: boolean): void;
  /** Kill the pencil once the server has gone — there is nothing to edit into. */
  setPencilEnabled(enabled: boolean): void;
  onToggle(handler: () => void): void;
  onStop(handler: () => void): void;
  destroy(): void;
}

export function createPanel(doc: Document): Panel {
  const host = doc.createElement('div');
  host.dataset.clumeralEditMode = '';
  // OPEN, not closed. Edit mode is a dev-only tool, so nothing here is hidden
  // from a page it does not ship to — and a closed root is invisible to
  // Playwright, which cannot click or read a single control in this panel.
  // Jamie, 2026-08-29: open it so the class picker can actually be tested.
  const root = host.attachShadow({ mode: 'open' });

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
  // From COPY, not a literal. These two were hardcoded here while
  // tests/edit-mode-panel.spec.ts asserted them against COPY — they matched by
  // coincidence, and editing copy.ts alone turned that spec red (brief item 45).
  pencil.setAttribute('aria-label', COPY.enterEditMode);

  const stopBtn = doc.createElement('button');
  stopBtn.className = 'stop-btn';
  stopBtn.type = 'button';
  stopBtn.textContent = COPY.stopControl;
  stopBtn.hidden = true;

  const notice = doc.createElement('p');
  notice.className = 'notice';

  const sheet = doc.createElement('div');
  sheet.className = 'sheet';
  sheet.hidden = true;

  const status = doc.createElement('p');
  status.className = 'status';
  sheet.appendChild(status);

  root.appendChild(pencil);
  root.appendChild(stopBtn);
  root.appendChild(notice);
  root.appendChild(sheet);

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
      // HIDE ONLY. Showing is setStopVisible's job alone — see the interface.
      if (mode === 'edit') stopBtn.hidden = true;
      // Nothing is selected in play mode, so nothing should be outlined.
      if (mode !== 'edit') highlight.hidden = true;
      pencil.setAttribute('aria-label', mode === 'edit' ? COPY.exitEditMode : COPY.enterEditMode);
      sheet.hidden = mode !== 'edit';
      // .status is cleared; .notice deliberately is not — it is the surface
      // that has to survive exactly this transition.
      if (mode !== 'edit') status.textContent = '';
    },
    say(message) {
      status.textContent = message;
    },
    notify(message) {
      notice.textContent = message;
    },
    setStopVisible(visible) {
      stopBtn.hidden = !visible;
    },
    setStopBusy(busy) {
      stopBtn.disabled = busy;
    },
    setPencilEnabled(enabled) {
      pencil.disabled = !enabled;
    },
    onToggle(handler) {
      pencil.addEventListener('click', handler);
    },
    onStop(handler) {
      stopBtn.addEventListener('click', handler);
    },
    destroy() {
      host.remove();
    },
  };
}
