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
 * How long an armed control waits for its second tap.
 *
 * Four seconds, and ONLY on the confirm labels (brief item 146). A question
 * left on screen becomes a statement: come back to the phone ten minutes later
 * and "Lose all and stop?" reads like a button called Lose All. Discard's
 * closing MESSAGE is not on a timer - item 144 - because a terminal message
 * that vanishes leaves a dead page saying nothing.
 */
const ARM_TIMEOUT_MS = 4000;

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

  /* ONE ROW, right-anchored, holding all three session controls: Discard,
     Save, pencil, in that order (Jamie, 2026-08-31). They used to be two
     position: fixed rules with hand-computed offsets, so a control that grew
     overlapped its neighbour instead of pushing it.

     The container itself takes no taps — only its buttons do — or it would eat
     the whole bottom-right corner of the game. */
  .controls {
    position: fixed;
    /* BOTH edges. Right anchors it; left bounds it. Without a left bound an
       armed "Lose all and stop?" beside Save and the pencil is about 341px on
       a 320px screen, and the overflow is clipped off the LEFT — taking the
       start of the question and part of the tap target with it (item 137). */
    left: 16px;
    right: 16px;
    /* Clear of the bottom-centre stack, and above the home indicator. */
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    /* ABOVE the sheet. Jamie, 2026-08-24: "no way to close edit mode" — the
       sheet is fixed to the bottom and was covering the only way out. */
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    pointer-events: none;
  }
  .controls > button { pointer-events: auto; }
  /* It is a focus TARGET, not a focus stop: a control that disappears hands
     focus here so it does not fall to the page underneath (brief item 45). */
  .controls:focus { outline: none; }

  .pencil {
    flex: 0 0 56px;
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

  /* The two session controls, in the row beside the pencil, outside the sheet
     so they are reachable without opening the editor (brief items 18, 39).
     Both are in the row in EDIT mode too: Discard is a stop button as well as a
     discard button, and stopping the server is not something the pencil does
     (brief item 135). */
  .save-btn, .discard-btn {
    /* THE PENCIL'S SIZE, and round like it, so the row reads as three of the
       same thing (items 85, 137). Jamie, 2026-08-31: "same size as pencil.
       Icon at first. Expand to show confirm message on tap." The old pill was
       a word wide at all times and blocked the screen. */
    width: 56px;
    height: 56px;
    /* Never squeezed below the tap target by a neighbour that is expanding. */
    flex: 0 0 56px;
    padding: 0;
    gap: 8px;
    border-radius: 28px;
    border: 2px solid #1a1a1a;
    background: #ffffff;
    color: #1a1a1a;
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    /* So a label too long for the screen is truncated inside its own button
       rather than pushing the row past its left bound. The truncation itself
       happens on the label, below — text-overflow does nothing on a flex
       container, and the span inside is a flex item. */
    min-width: 0;
    overflow: hidden;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  /* Armed: the label appears, the button grows LEFTWARDS because the row is
     anchored right, and its neighbours are pushed rather than covered
     (item 67). Jamie, 2026-08-31: "they can expand left and push the button
     over, don't overlap that's gross".

     The colour arrives with the expansion, not at rest (item 55).

     FIXED HEX, not --color-success / --color-error: those derive from the
     theme and flip in dark mode, while this panel is permanently light. A
     token here would take a dark-mode value on a white surface, and the tool's
     own chrome would start tracking the theme being edited (item 91). */
  .save-btn.is-armed, .discard-btn.is-armed {
    width: auto;
    flex: 0 1 auto;
    padding: 0 16px;
    color: #ffffff;
  }
  /* The label, and the only thing in the row that may shrink. Without
     min-width: 0 a flex item refuses to go below its content width, so an
     over-long question was clipped at BOTH ends by the centring above — losing
     the start of "Lose all and stop?", which is the half that carries the
     meaning. */
  .control-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .discard-btn.is-armed { background: #c62828; border-color: #c62828; }
  .save-btn.is-armed { background: #2e7d32; border-color: #2e7d32; }
  .save-btn:disabled, .discard-btn:disabled { opacity: 0.5; }
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
    /* Clearance for the control row, on the axis the row actually covers.

       The row is 56px tall and sits 16px off the bottom, so it overlaps the
       sheet's bottom 72px and nothing else — while the sheet itself is up to
       60vh tall. A right-hand gutter wide enough for the row (196px: three
       56px controls, two gaps, the margin) would take that width off EVERY
       row of the sheet, and on a 390px phone that leaves 194px for the search
       field, the breadcrumb, the chips and the picker.

       So the clearance is at the BOTTOM. Nothing renders in the row's band,
       the full width is available everywhere else, and an EXPANDED control —
       which no padding could clear at ~300px wide — is handled the way rev 2's
       R18 said it would be: the row sits above the sheet and the sheet scrolls
       under it.

       --row-clearance drops to 8px while the keyboard is up, because the row is
       fixed to the LAYOUT viewport and is therefore behind the keyboard, while
       the sheet has been lifted clear of it. Clearing a row that is not there
       costs about a third of the sheet's height, exactly while the class search
       is in use. */
    padding: 8px 10px calc(var(--row-clearance, 80px) + env(safe-area-inset-bottom, 0px));
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
  /* A FIXED HEIGHT, empty or not. Undo and Reset come and go with the
     selection now, and a collapsing row would shift everything above it while
     Jamie is aiming at it (brief item 27). */
  .footer { min-height: 36px; }
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
import { icon } from './icons.ts';
import { armOnTap, controlLabel, type ArmedControl, type ControlRowState } from './pending.ts';

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
   * in play mode — everything Save and Discard report — has to come through
   * here.
   */
  notify(message: string): void;
  /**
   * Show, hide and grey the two session controls.
   *
   * The ONLY way either is ever shown. setMode does not touch them, so a
   * control pointing at a server that has already stopped cannot be brought
   * back by Escape or the back gesture — that invariant is carried by
   * `stopped` inside controlRowState, not by the panel.
   */
  setRow(state: ControlRowState, somethingToDiscard?: boolean): void;
  /** Kill the pencil once the server has gone — there is nothing to edit into. */
  setPencilEnabled(enabled: boolean): void;
  onToggle(handler: () => void): void;
  /**
   * Called on the SECOND tap only.
   *
   * The first tap arms the control and expands its label into a question; the
   * panel owns that gesture, so nothing downstream has to know about it.
   */
  onSave(handler: () => void): void;
  onDiscard(handler: () => void): void;
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

  const discardBtn = doc.createElement('button');
  discardBtn.className = 'discard-btn';
  discardBtn.type = 'button';
  discardBtn.hidden = true;

  const saveBtn = doc.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.type = 'button';
  saveBtn.hidden = true;

  // Discard, Save, pencil — left to right, pencil on the right where his thumb
  // already expects it (Jamie, 2026-08-31).
  const controls = doc.createElement('div');
  controls.className = 'controls';
  controls.tabIndex = -1;
  controls.appendChild(discardBtn);
  controls.appendChild(saveBtn);
  controls.appendChild(pencil);

  const notice = doc.createElement('p');
  notice.className = 'notice';

  const sheet = doc.createElement('div');
  sheet.className = 'sheet';
  sheet.hidden = true;
  // Without this .focus() on the sheet does nothing at all, and it is where a
  // footer button hands focus when it disappears (brief item 95).
  sheet.tabIndex = -1;

  const status = doc.createElement('p');
  status.className = 'status';
  sheet.appendChild(status);

  root.appendChild(controls);
  root.appendChild(notice);
  root.appendChild(sheet);

  doc.body.appendChild(host);

  /**
   * Show, hide or grey one control — and never leave focus on a hidden button.
   *
   * The row's container is the fallback, NOT the sheet. Save's commonest
   * disappearance is in play mode the moment a save succeeds, and the sheet is
   * hidden in play mode: .focus() on a hidden element does nothing, so focus
   * would fall to the page underneath (brief item 45, rev 2 R14).
   */
  function applyControl(btn: HTMLButtonElement, next: { visible: boolean; enabled: boolean }): void {
    if (!next.visible && root.activeElement === btn) controls.focus();
    btn.hidden = !next.visible;
    btn.disabled = !next.enabled;
  }

  // ── The two-tap gesture ───────────────────────────────────────────────────
  //
  // Held here rather than in overlay.ts because it is entirely about what the
  // buttons look like and what a tap means. The rules themselves are pure
  // functions in pending.ts; this is the wiring and the timer.

  let armed: ArmedControl = null;
  let armTimer: ReturnType<typeof setTimeout> | undefined;
  /** Would Discard actually lose anything? It picks between two questions. */
  let discardable = false;
  const handlers: { save?: () => void; discard?: () => void } = {};

  function clearArmTimer(): void {
    if (armTimer === undefined) return;
    clearTimeout(armTimer);
    armTimer = undefined;
  }

  /**
   * One control: its icon always, its words only when armed.
   *
   * The icon carries the meaning at rest and the label is what makes the
   * confirm unambiguous, so the aria-label is the LABEL in both states — the
   * icon alone would announce as nothing at all.
   */
  function drawControl(btn: HTMLButtonElement, control: 'save' | 'discard', iconName: string): void {
    const isArmed = armed === control;
    const label = controlLabel(control, isArmed, discardable);
    // 22px to match the pencil's glyph. The default is sized in em, which on a
    // 14px button is a 16px icon lost in a 56px circle.
    btn.innerHTML = icon(iconName, '22px');
    if (isArmed) {
      const text = doc.createElement('span');
      text.className = 'control-label';
      text.textContent = label;
      btn.appendChild(text);
    }
    btn.setAttribute('aria-label', label);
    // The colour arrives with the expansion, not at rest (brief item 55).
    btn.classList.toggle('is-armed', isArmed);
  }

  function drawLabels(): void {
    drawControl(discardBtn, 'discard', 'trash');
    drawControl(saveBtn, 'save', 'save');
  }

  function tap(control: 'save' | 'discard'): void {
    const next = armOnTap(armed, control);
    armed = next.armed;
    // ONE timer, always. Arming the other control disarms this one, and two
    // timers running at once would revert a label that had already moved on.
    clearArmTimer();
    if (next.act === null) {
      armTimer = setTimeout(() => {
        armTimer = undefined;
        armed = null;
        drawLabels();
      }, ARM_TIMEOUT_MS);
    }
    drawLabels();
    if (next.act) handlers[next.act]?.();
  }

  discardBtn.addEventListener('click', () => tap('discard'));
  saveBtn.addEventListener('click', () => tap('save'));
  drawLabels();

  return {
    host,
    root,
    sheet,
    setViewport(inset, visibleHeight) {
      host.style.setProperty('--keyboard-inset', `${Math.max(0, Math.round(inset))}px`);
      // With the keyboard up the control row is behind it, so the sheet has
      // nothing to clear at its bottom edge.
      //
      // 72px, not 0: the row is 56px tall at 16px off the bottom and is NOT
      // lifted by --keyboard-inset, so a partial inset — an iPad accessory bar,
      // a docked floating keyboard, every frame of the iOS open animation —
      // leaves part of it still over the sheet.
      host.style.setProperty('--row-clearance', inset >= 72 ? '8px' : '80px');
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
      // The session controls are NOT touched here. The line that hid the pill
      // in edit mode was undone by the very next syncStopPill() anyway, so it
      // was dead code pretending to be an invariant (rev 2, R10).
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
    setRow(next, somethingToDiscard = false) {
      discardable = somethingToDiscard;
      // A control that goes away armed must not come back armed: it would
      // return holding a question Jamie never asked, one tap from acting.
      if ((armed === 'save' && !next.save.visible)
        || (armed === 'discard' && !next.discard.visible)) {
        clearArmTimer();
        armed = null;
      }
      applyControl(discardBtn, next.discard);
      applyControl(saveBtn, next.save);
      drawLabels();
    },
    setPencilEnabled(enabled) {
      pencil.disabled = !enabled;
    },
    onToggle(handler) {
      pencil.addEventListener('click', handler);
    },
    onSave(handler) {
      handlers.save = handler;
    },
    onDiscard(handler) {
      handlers.discard = handler;
    },
    destroy() {
      clearArmTimer();
      host.remove();
    },
  };
}
