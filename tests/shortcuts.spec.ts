import { describe, it, expect, afterEach } from 'vitest';
import { matchShortcut, modifierLabel, isTypingTarget } from '../src/shortcuts.ts';
import type { ShortcutKeyEvent } from '../src/shortcuts.ts';

// Build a key event with every modifier off unless overridden — the tests below
// are about which combinations DON'T match as much as which do.
function key(over: Partial<ShortcutKeyEvent> & { key: string }): ShortcutKeyEvent {
  return { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...over };
}

describe('matchShortcut', () => {
  it('maps Ctrl+Z and Cmd+Z to undo', () => {
    expect(matchShortcut(key({ key: 'z', ctrlKey: true }))).toBe('undo');
    expect(matchShortcut(key({ key: 'z', metaKey: true }))).toBe('undo');
  });

  it('maps Ctrl+X and Cmd+X to reset', () => {
    expect(matchShortcut(key({ key: 'x', ctrlKey: true }))).toBe('reset');
    expect(matchShortcut(key({ key: 'x', metaKey: true }))).toBe('reset');
  });

  // Caps lock reports an uppercase key with shiftKey false. Matching lowercased
  // means caps lock still works, while the shiftKey flag below still vetoes.
  it('matches with caps lock on', () => {
    expect(matchShortcut(key({ key: 'Z', ctrlKey: true }))).toBe('undo');
    expect(matchShortcut(key({ key: 'X', metaKey: true }))).toBe('reset');
  });

  // Ctrl+Shift+Z is Redo everywhere. We have no redo — doing an undo instead
  // would be worse than doing nothing.
  it('ignores Shift, so the redo idiom is left alone', () => {
    expect(matchShortcut(key({ key: 'z', ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(matchShortcut(key({ key: 'Z', ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(matchShortcut(key({ key: 'x', metaKey: true, shiftKey: true }))).toBeNull();
  });

  // AltGr reports ctrlKey && altKey on Windows, so a European-layout AltGr+Z
  // would otherwise fire Undo.
  it('ignores Alt, so AltGr combinations are left alone', () => {
    expect(matchShortcut(key({ key: 'z', ctrlKey: true, altKey: true }))).toBeNull();
    expect(matchShortcut(key({ key: 'z', metaKey: true, altKey: true }))).toBeNull();
    expect(matchShortcut(key({ key: 'x', ctrlKey: true, altKey: true }))).toBeNull();
  });

  // Both bindings take a modifier, so a bare letter never means a board action —
  // which is also why WCAG 2.1.4 (character key shortcuts) doesn't apply.
  it('ignores bare letters', () => {
    expect(matchShortcut(key({ key: 'z' }))).toBeNull();
    expect(matchShortcut(key({ key: 'x' }))).toBeNull();
  });

  it('ignores other modified keys', () => {
    expect(matchShortcut(key({ key: 'y', ctrlKey: true }))).toBeNull();
    expect(matchShortcut(key({ key: 'Enter', ctrlKey: true }))).toBeNull();
    expect(matchShortcut(key({ key: 'c', metaKey: true }))).toBeNull();
  });
});

describe('modifierLabel', () => {
  it('returns Cmd for Apple platforms', () => {
    expect(modifierLabel('MacIntel')).toBe('Cmd');
    expect(modifierLabel('macOS')).toBe('Cmd');
    expect(modifierLabel('iPad')).toBe('Cmd');
    expect(modifierLabel('iPhone')).toBe('Cmd');
  });

  it('returns Ctrl for everything else', () => {
    expect(modifierLabel('Win32')).toBe('Ctrl');
    expect(modifierLabel('Linux x86_64')).toBe('Ctrl');
  });

  // Ctrl is the default whenever detection is inconclusive. Both modifiers work
  // regardless, so the worst case is a cosmetically wrong hint.
  it('defaults to Ctrl when the platform is unknown', () => {
    expect(modifierLabel(undefined)).toBe('Ctrl');
    expect(modifierLabel('')).toBe('Ctrl');
  });
});

describe('isTypingTarget', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  function mount(html: string): HTMLElement {
    document.body.innerHTML = html;
    return document.body.firstElementChild as HTMLElement;
  }

  it('is true for the controls a player types into', () => {
    for (const html of [
      '<input type="text">',
      '<textarea></textarea>',
      '<select><option>a</option></select>',
      '<div contenteditable="true"></div>',
      '<div contenteditable=""></div>',
    ]) {
      expect(isTypingTarget(mount(html)), html).toBe(true);
    }
  });

  // Events land on the deepest element, so a span inside a contenteditable has
  // to count as typing too.
  it('is true for a descendant of an editable region', () => {
    mount('<div contenteditable="true"><span id="inner">x</span></div>');
    expect(isTypingTarget(document.getElementById('inner'))).toBe(true);
  });

  it('is false for the board and its controls', () => {
    for (const html of [
      '<button data-undo>Undo</button>',
      '<div data-digit="1"></div>',
      '<body-like></body-like>',
    ]) {
      expect(isTypingTarget(mount(html)), html).toBe(false);
    }
  });

  // An input you cannot type into is not typing. The save-score checkbox lives on
  // the game screen and appears exactly when the board is fully resolved, so
  // treating it as a typing target would kill the shortcuts at the moment a
  // player most wants them.
  it('is false for non-text inputs', () => {
    for (const type of ['checkbox', 'radio', 'button', 'submit', 'reset']) {
      expect(isTypingTarget(mount(`<input type="${type}">`)), type).toBe(false);
    }
  });

  it('is true for text-entry input types', () => {
    for (const type of ['text', 'email', 'search', 'password', 'number', 'url', 'tel']) {
      expect(isTypingTarget(mount(`<input type="${type}">`)), type).toBe(true);
    }
  });

  it('is false for a null target', () => {
    expect(isTypingTarget(null)).toBe(false);
  });
});
