import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createInterceptor, type Interceptor } from '../src/edit-mode/intercept.ts';

// C3 — input interception, and the restore (brief items 30, 58, 76).
//
// Item 76 is the one part of §9 Jamie did NOT concede when he waived the tool's
// accessibility: "leaving play mode with keyboard control broken is a defect in
// the shipped product, and it fails silently."
//
// So every test here is BEHAVIOURAL — does an event reach a handler registered
// the way src/app.ts registers one. Counting listeners would pass with the
// keyboard dead: the realistic implementation keeps one permanent listener
// behind a flag (item 104 requires the back interception to outlive the mode
// anyway), so the listener set is identical whether or not the flag cleared.

let interceptor: Interceptor;
let gameHandler: ReturnType<typeof vi.fn>;
let gameCapture: ReturnType<typeof vi.fn>;

beforeEach(() => {
  gameHandler = vi.fn();
  gameCapture = vi.fn();

  // The overlay's script tag is injected AHEAD of the app entry, so the
  // interceptor registers first. Mirrored here, because the ordering is the
  // whole mechanism — see the note in intercept.ts.
  interceptor = createInterceptor(document);

  // How src/app.ts registers: one bubble-phase handler (line 1348) and one
  // capture-phase handler (line 736).
  document.addEventListener('keydown', gameHandler);
  document.addEventListener('keydown', gameCapture, { capture: true });
  document.addEventListener('pointerdown', gameHandler);
  document.addEventListener('click', gameHandler);
});

afterEach(() => {
  interceptor.destroy();
  document.removeEventListener('keydown', gameHandler);
  document.removeEventListener('keydown', gameCapture, { capture: true });
  document.removeEventListener('pointerdown', gameHandler);
  document.removeEventListener('click', gameHandler);
});

function press(key = 'z'): void {
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true })
  );
}

function tap(): void {
  document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
  document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('play mode leaves the game alone', () => {
  it('lets keypresses through before edit mode is ever entered', () => {
    press();
    expect(gameHandler).toHaveBeenCalled();
    expect(gameCapture).toHaveBeenCalled();
  });

  it('lets taps through', () => {
    tap();
    expect(gameHandler).toHaveBeenCalledTimes(2);
  });
});

describe('edit mode takes input away from the game (brief item 30)', () => {
  beforeEach(() => interceptor.enable());

  it('swallows taps, so no tap reaches the board', () => {
    // Load-bearing: Clumeral is a game and a tap is a digit. Without this,
    // selecting an element also plays a move.
    tap();
    expect(gameHandler).not.toHaveBeenCalled();
  });

  it('swallows keypresses, including the game shortcuts', () => {
    press();
    expect(gameHandler).not.toHaveBeenCalled();
  });

  it('beats a capture-phase handler registered by the game', () => {
    // app.ts:736 registers with { capture: true }. For listeners on the same
    // target, the DOM runs them in REGISTRATION order regardless of phase — so
    // this only works because the overlay script is injected first.
    press();
    expect(gameCapture).not.toHaveBeenCalled();
  });

  it('hands the swallowed keypress to edit mode instead', () => {
    interceptor.destroy();
    const onKey = vi.fn();
    interceptor = createInterceptor(document, { onKey });
    interceptor.enable();
    press('Escape');
    expect(onKey).toHaveBeenCalledOnce();
    expect(onKey.mock.calls[0][0].key).toBe('Escape');
  });

  it('hands the swallowed tap to edit mode instead', () => {
    interceptor.destroy();
    const onPointer = vi.fn();
    interceptor = createInterceptor(document, { onPointer });
    interceptor.enable();
    tap();
    expect(onPointer).toHaveBeenCalledOnce();
  });
});

describe('play mode comes back intact (brief item 76)', () => {
  it('restores keyboard control after edit mode', () => {
    // THE silent one. If teardown is incomplete the game comes back with the
    // keyboard dead and nothing says so — a defect in the shipped product, not
    // in the tool.
    interceptor.enable();
    press();
    expect(gameHandler).not.toHaveBeenCalled();

    interceptor.disable();
    press();
    expect(gameHandler).toHaveBeenCalledOnce();
    expect(gameCapture).toHaveBeenCalledOnce();
  });

  it('restores taps after edit mode', () => {
    interceptor.enable();
    tap();
    expect(gameHandler).not.toHaveBeenCalled();

    interceptor.disable();
    tap();
    expect(gameHandler).toHaveBeenCalledTimes(2);
  });

  it('survives several trips in and out', () => {
    // Flipping to play mode to try a change is normal (brief item 30), so this
    // happens many times per session, not once.
    for (let i = 0; i < 5; i++) {
      interceptor.enable();
      press();
      interceptor.disable();
      press();
    }
    expect(gameHandler).toHaveBeenCalledTimes(5);
  });

  it('leaves the game working after the overlay is destroyed entirely', () => {
    interceptor.enable();
    interceptor.destroy();
    press();
    expect(gameHandler).toHaveBeenCalledOnce();
  });
});

describe('the panel is the tool, not the page (brief item 63)', () => {
  it('lets the overlay-s own events through untouched', () => {
    // Otherwise the tool intercepts its own buttons and nothing in the panel
    // can be tapped.
    interceptor.destroy();
    const panel = document.createElement('div');
    document.body.appendChild(panel);
    const panelHandler = vi.fn();
    panel.addEventListener('click', panelHandler);

    interceptor = createInterceptor(document, { isOwnUi: (t) => t === panel });
    interceptor.enable();
    panel.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(panelHandler).toHaveBeenCalledOnce();
    panel.remove();
  });

  it('still swallows events from the page while doing so', () => {
    interceptor.destroy();
    const panel = document.createElement('div');
    document.body.appendChild(panel);
    interceptor = createInterceptor(document, { isOwnUi: (t) => t === panel });
    interceptor.enable();
    tap();
    expect(gameHandler).not.toHaveBeenCalled();
    panel.remove();
  });
});
