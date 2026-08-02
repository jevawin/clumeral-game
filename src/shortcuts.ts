// Clumeral — shortcuts.ts
// Keyboard shortcuts for the board controls: Ctrl/Cmd+Z undoes, Ctrl/Cmd+X resets.
//
// Deliberately pure and DOM-free. app.ts cannot be imported by vitest — it runs
// its whole bootstrap on import — so the key matching lives here where it can be
// tested directly.

export type ShortcutAction = 'undo' | 'reset';

// Structural rather than KeyboardEvent, so a test can pass a plain object and the
// module never needs lib.dom. A real KeyboardEvent satisfies it.
export interface ShortcutKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Which board action this keypress means, or null if it means nothing to us.
 *
 * Either modifier is accepted on either platform — no OS sniffing. A Mac user on
 * an external PC keyboard presses Ctrl+Z and it works; a Windows user with a Mac
 * keyboard gets the same deal.
 *
 * Shift and Alt both veto:
 *   - Ctrl+Shift+Z is the near-universal Redo idiom. We have no redo, and
 *     swallowing it to do an undo instead would be actively wrong.
 *   - AltGr reports as ctrlKey && altKey on Windows, so without the Alt veto an
 *     AltGr+Z on a European layout would silently fire Undo mid-typing.
 *
 * Matching is case-insensitive, so caps lock still works. Shift is checked as a
 * flag independently of the character, so Shift+Z never does — even though
 * `e.key` reads 'Z' in both cases.
 */
export function matchShortcut(e: ShortcutKeyEvent): ShortcutAction | null {
  if (!(e.ctrlKey || e.metaKey)) return null;
  if (e.shiftKey || e.altKey) return null;
  switch (e.key.toLowerCase()) {
    case 'z': return 'undo';
    case 'x': return 'reset';
    default: return null;
  }
}

/**
 * The modifier name to show and speak, given a platform string.
 *
 * Takes the platform as an argument rather than reading `navigator` so it stays
 * pure and testable. Anything inconclusive — including undefined and '' — gets
 * 'Ctrl': it is the safer default, and a wrong guess is only ever cosmetic
 * because matchShortcut accepts both modifiers regardless.
 *
 * Words, never the glyph: Windows has no ⌘, and a symbol reads as gibberish to a
 * screen reader.
 */
export function modifierLabel(platform: string | undefined): 'Cmd' | 'Ctrl' {
  return platform && /mac|iphone|ipad/i.test(platform) ? 'Cmd' : 'Ctrl';
}

/**
 * Is this event's target something the player types into?
 *
 * Used for two different jobs, which is why it lives here rather than in app.ts:
 *
 *  1. The shortcut guard — Cmd+X has to keep cutting inside the feedback
 *     textarea, and Cmd+Z has to keep undoing their typing.
 *  2. Keyboard DETECTION. A keydown is only evidence of a physical keyboard if
 *     it did not come from a text field: on iOS the on-screen keyboard cannot
 *     appear unless one is focused, so a keypress anywhere else means real keys.
 *     Without this, typing feedback on an iPhone revealed a hint for shortcuts
 *     that phone can never send (reported by Jamie, 2026-08-02).
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}
