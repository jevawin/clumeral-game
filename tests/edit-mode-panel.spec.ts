import { describe, it, expect, afterEach, vi } from 'vitest';
import { createPanel, type Panel } from '../src/edit-mode/panel.ts';
import { COPY } from '../src/edit-mode/copy.ts';

// C3 — the panel shell (brief items 61-65, 71, 103).

let panel: Panel | undefined;

afterEach(() => {
  panel?.destroy();
  panel = undefined;
});

describe('the panel is sealed against the page (brief items 64, 65)', () => {
  it('renders in an open shadow root', () => {
    // Jamie can select <body> and add a text size or a colour, and by design
    // that inherits into everything. A bad edit could make the panel
    // unreadable, and the only way out of an unreadable panel is the panel.
    // The protection against that is `all: initial` on the shadow content,
    // asserted below - NOT the root being closed.
    //
    // Open since 2026-08-29. A closed root is invisible to Playwright, which
    // could not click or read a single control in this panel. Edit mode is
    // dev-only, so there is no untrusted page to seal against: the only script
    // that could reach in is the game's own.
    panel = createPanel(document);
    const host = document.querySelector('[data-clumeral-edit-mode]') as HTMLElement;
    expect(host).toBeTruthy();
    expect(host.shadowRoot).toBe(panel.root);
  });

  it('carries its own stylesheet rather than the app-s', () => {
    panel = createPanel(document);
    const style = panel.root.querySelector('style');
    expect(style?.textContent).toContain('all: initial');
  });

  it('sits above the game-s own fixed stack', () => {
    // index.html:157 has a fixed bottom-centre stack at z-[300], and the pencil
    // must not cover it on a narrow screen (brief item 62).
    panel = createPanel(document);
    const css = panel.root.querySelector('style')!.textContent!;
    expect(css).toContain('z-index: 2147483000');
    expect(css).toContain('env(safe-area-inset-bottom');
  });

  it('adds no landmark or heading to the page-s outline (brief item 79)', () => {
    // Not a requirement after item 81, but it falls out for free and a stray
    // <h1> in the tool would reorder the game's document outline.
    panel = createPanel(document);
    expect(panel.host.querySelector('h1, h2, h3, main, nav, header')).toBeNull();
  });
});

describe('the pencil toggles the mode (brief items 30, 61, 71)', () => {
  it('starts in play mode with the sheet closed', () => {
    panel = createPanel(document);
    expect(panel.sheet.hidden).toBe(true);
  });

  it('opens the sheet in edit mode and closes it in play mode', () => {
    panel = createPanel(document);
    panel.setMode('edit');
    expect(panel.sheet.hidden).toBe(false);
    panel.setMode('play');
    expect(panel.sheet.hidden).toBe(true);
  });

  it('announces which way the button goes', () => {
    panel = createPanel(document);
    const pencil = panel.root.querySelector('.pencil')!;
    expect(pencil.getAttribute('aria-label')).toBe(COPY.enterEditMode);
    panel.setMode('edit');
    expect(pencil.getAttribute('aria-label')).toBe(COPY.exitEditMode);
  });

  it('calls back when tapped', () => {
    panel = createPanel(document);
    const onToggle = vi.fn();
    panel.onToggle(onToggle);
    (panel.root.querySelector('.pencil') as HTMLElement).click();
    expect(onToggle).toHaveBeenCalledOnce();
  });
});

describe('what the panel says', () => {
  it('shows a message and clears it when edit mode ends', () => {
    panel = createPanel(document);
    panel.setMode('edit');
    panel.say(COPY.saved);
    expect(panel.root.querySelector('.status')!.textContent).toBe(COPY.saved);
    panel.setMode('play');
    expect(panel.root.querySelector('.status')!.textContent).toBe('');
  });
});

describe('the pencil and the sheet always mount (plan task 1)', () => {
  it('puts both in the shadow root', () => {
    // There is no read-only origin any more, so there is no case where the
    // panel mounts without its controls. This is what replaces the replayOnly
    // option: the tool either runs or it is not injected at all.
    panel = createPanel(document);
    expect(panel.root.querySelector('.pencil')).toBeTruthy();
    expect(panel.root.querySelector('.sheet')).toBeTruthy();
  });
});

describe('teardown', () => {
  it('leaves nothing behind in the page', () => {
    panel = createPanel(document);
    panel.destroy();
    expect(document.querySelector('[data-clumeral-edit-mode]')).toBeNull();
    panel = undefined;
  });
});

// Plan task 5, rebuilt for the control row. Brief items 18, 39, 43, 44, 134, 135.
const ROW_BOTH = {
  discard: { visible: true, enabled: true },
  save: { visible: true, enabled: true },
};

describe('the session controls, and somewhere to speak in play mode', () => {
  it('mounts Discard, Save and the pencil in one row, in that order', () => {
    // Jamie, 2026-08-31: "Discard Save Edit. That order." The pencil sits on
    // the right where his thumb already expects it.
    panel = createPanel(document);
    const row = panel.root.querySelector('.controls')!;
    expect([...row.children].map((el) => el.className))
      .toEqual(['discard-btn', 'save-btn', 'pencil']);
  });

  it('SHOWS THE ROW IN EDIT MODE TOO', () => {
    // Replaces "hides the pill in edit mode, where the pencil is the save
    // control". That was the 2026-08-26 rule and brief item 135 reverses it:
    // Discard is the permanent stop button, and stopping the server is not
    // something the pencil does. The panel no longer touches these controls on
    // a mode change at all.
    panel = createPanel(document);
    panel.setRow(ROW_BOTH);
    panel.setMode('edit');
    expect(panel.root.querySelector<HTMLElement>('.discard-btn')?.hidden).toBe(false);
    expect(panel.root.querySelector<HTMLElement>('.save-btn')?.hidden).toBe(false);
  });

  it('shows neither control once the server has stopped', () => {
    // Replaces "does NOT bring the pill back on its own when edit mode closes".
    // The invariant is the same one and it now lives on `stopped`: Escape and
    // the back gesture reach setMode('play'), and the row is whatever the last
    // setRow said - which for a stopped server is nothing at all.
    panel = createPanel(document);
    panel.setRow(ROW_BOTH);
    panel.setRow({
      discard: { visible: false, enabled: true },
      save: { visible: false, enabled: true },
    });
    panel.setMode('edit');
    panel.setMode('play');
    expect(panel.root.querySelector<HTMLElement>('.discard-btn')?.hidden).toBe(true);
    expect(panel.root.querySelector<HTMLElement>('.save-btn')?.hidden).toBe(true);
  });

  it('keeps a notice when the editor closes, but clears the in-sheet status', () => {
    // The whole reason .notice exists: everything the session controls report
    // is shown in play mode, and setMode blanks the status on the way there.
    panel = createPanel(document);
    panel.setMode('edit');
    panel.say('in the sheet');
    panel.notify(COPY.stopped);
    panel.setMode('play');
    expect(panel.root.querySelector('.status')?.textContent).toBe('');
    expect(panel.root.querySelector('.notice')?.textContent).toBe(COPY.stopped);
  });

  it('greys both out while a save or stop is in flight', () => {
    // No in-flight feedback on a phone is what produces a second tap, and a
    // second tap writes a second session file.
    panel = createPanel(document);
    panel.setRow({
      discard: { visible: true, enabled: false },
      save: { visible: true, enabled: false },
    });
    expect(panel.root.querySelector<HTMLButtonElement>('.discard-btn')?.disabled).toBe(true);
    expect(panel.root.querySelector<HTMLButtonElement>('.save-btn')?.disabled).toBe(true);
    panel.setRow(ROW_BOTH);
    expect(panel.root.querySelector<HTMLButtonElement>('.save-btn')?.disabled).toBe(false);
  });

  it('calls back when each is tapped', () => {
    panel = createPanel(document);
    const onSave = vi.fn();
    const onDiscard = vi.fn();
    panel.onSave(onSave);
    panel.onDiscard(onDiscard);
    panel.setRow(ROW_BOTH);
    panel.root.querySelector<HTMLButtonElement>('.save-btn')?.click();
    panel.root.querySelector<HTMLButtonElement>('.discard-btn')?.click();
    expect(onSave).toHaveBeenCalledOnce();
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it('does not leave focus on a control it has just hidden', () => {
    // Brief item 45. Save disappears the moment a save succeeds, usually in
    // play mode - where the sheet is hidden, so focusing the sheet would do
    // nothing at all and focus would fall to the game underneath.
    panel = createPanel(document);
    panel.setRow(ROW_BOTH);
    const save = panel.root.querySelector<HTMLButtonElement>('.save-btn')!;
    save.focus();
    expect(panel.root.activeElement).toBe(save);
    panel.setRow({ discard: { visible: true, enabled: true }, save: { visible: false, enabled: true } });
    expect(panel.root.activeElement).toBe(panel.root.querySelector('.controls'));
  });

  it('gives the sheet a focus target for the footer buttons', () => {
    // Without tabindex="-1" a .focus() call on the sheet does nothing (item 95).
    panel = createPanel(document);
    expect(panel.sheet.tabIndex).toBe(-1);
  });
});
