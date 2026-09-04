// Clumeral edit mode — taking input away from the game, and giving it back.
//
// Clumeral is a game and taps are gameplay (brief item 30). In edit mode a tap
// must select an element, not press a digit. Keyboard shortcuts are gameplay for
// the same reason (item 58).
//
// The half that matters is GIVING IT BACK. Brief item 76 is the one thing in §9
// Jamie did not concede when he waived the tool's own accessibility: leaving edit
// mode with keyboard control quietly broken is a defect in the SHIPPED GAME, and
// it fails silently. So this module is tested by behaviour — does a keypress
// reach the game — and never by counting listeners.
//
// A CORRECTION TO THE BRIEF, which planning had to make. Item 58 says to
// "suspend shortcuts.ts". That module registers no listeners at all: it exports
// matchShortcut, modifierLabel and isTypingTarget as pure functions. The actual
// keydown handlers are in src/app.ts (lines 302, 736, 1348, 1493). So there is
// nothing in shortcuts.ts to suspend, and what we do instead is stop the event
// before app.ts's handlers see it.

/** Events that are gameplay, and so must not reach the page in edit mode. */
const GAME_EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'click', 'keydown', 'keypress', 'keyup'] as const;

/**
 * How far a finger may travel and still count as a tap rather than a scroll.
 *
 * Selecting on pointerDOWN meant every scroll changed the selection before the
 * page had even moved (Jamie, 2026-08-27). Selecting on pointerUP within this
 * radius is the ordinary way to tell a tap from a drag.
 */
const TAP_SLOP_PX = 10;

export interface Interceptor {
  /** Take input away from the game. */
  enable(): void;
  /** Give it back. */
  disable(): void;
  readonly active: boolean;
  /** Remove the listeners entirely. For teardown and tests. */
  destroy(): void;
}

export interface InterceptorOptions {
  /** Called with each swallowed pointer event, so selection can use it. */
  onPointer?(event: PointerEvent | MouseEvent): void;
  /** Called with each swallowed key event. Escape leaves edit mode. */
  onKey?(event: KeyboardEvent): void;
  /** Events originating inside this element are the tool's own and pass through. */
  isOwnUi?(target: EventTarget | null): boolean;
}

/**
 * Swallow gameplay input while edit mode is on.
 *
 * Registered ONCE, in the capture phase, and left in place. The flag decides
 * whether to swallow. Two reasons it is not add/remove per mode:
 *
 *   1. Brief item 104 — the back interception has to outlive edit mode anyway,
 *      because flipping to play mode to try a change is normal and the first
 *      back press must not hand the router a re-render that destroys the edits.
 *   2. Adding a listener later means registering AFTER app.ts, and for listeners
 *      on the same target in the same phase the DOM runs them in registration
 *      order. Register late and the game sees the event first, whatever the
 *      capture flag says.
 *
 * The overlay's <script> is injected ahead of the app entry so this listener is
 * in place first, which is what makes stopImmediatePropagation effective against
 * app.ts's handlers.
 */
export function createInterceptor(doc: Document, options: InterceptorOptions = {}): Interceptor {
  let active = false;
  let downAt: { x: number; y: number } | null = null;

  const handler = (event: Event): void => {
    if (!active) return;

    // The panel is the tool, not the page. Tapping it must adjust the tool
    // (brief item 63), so its own events are left alone.
    if (options.isOwnUi?.(event.target)) return;

    // stopImmediatePropagation, not stopPropagation: the game's handlers are on
    // `document` too, and stopPropagation alone would still let them run.
    event.stopImmediatePropagation();
    // NOT prevented for pointer events: preventDefault on a pointerdown or move
    // cancels the browser's own scrolling, and the page has to stay scrollable
    // while edit mode is on.
    if (event.type !== 'pointerdown' && event.type !== 'pointermove' && event.type !== 'pointerup') {
      event.preventDefault();
    }

    if (event.type === 'keydown') {
      options.onKey?.(event as KeyboardEvent);
      return;
    }

    // A tap is a down and an up in roughly the same place. Anything else is a
    // scroll, and must leave the selection alone.
    const pointer = event as PointerEvent;
    if (event.type === 'pointerdown') {
      downAt = { x: pointer.clientX, y: pointer.clientY };
    } else if (event.type === 'pointerup' && downAt) {
      const travelled = Math.hypot(pointer.clientX - downAt.x, pointer.clientY - downAt.y);
      downAt = null;
      if (travelled <= TAP_SLOP_PX) options.onPointer?.(pointer);
    }
  };

  for (const type of GAME_EVENTS) {
    doc.addEventListener(type, handler, { capture: true });
  }

  return {
    enable() { active = true; },
    disable() { active = false; },
    get active() { return active; },
    destroy() {
      active = false;
      for (const type of GAME_EVENTS) {
        doc.removeEventListener(type, handler, { capture: true });
      }
    },
  };
}
