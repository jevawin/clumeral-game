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
  it('renders in a closed shadow root', () => {
    // Jamie can select <body> and add a text size or a colour, and by design
    // that inherits into everything. A bad edit could make the panel
    // unreadable, and the only way out of an unreadable panel is the panel.
    panel = createPanel(document);
    const host = document.querySelector('[data-clumeral-edit-mode]') as HTMLElement;
    expect(host).toBeTruthy();
    // Closed: the page cannot reach in, so nothing on the page can restyle or
    // script the tool.
    expect(host.shadowRoot).toBeNull();
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

describe('replay mode serves Dave (brief item 103)', () => {
  it('shows no pencil and no sheet', () => {
    // Otherwise Dave edits, taps Done, and gets the message written carefully
    // BECAUSE it loses work — telling him to check a dev server he cannot see
    // and to retry forever. The one message that matters, shown to the one
    // person it is wrong for.
    panel = createPanel(document, { replayOnly: true });
    expect(panel.root.querySelector('.pencil')).toBeNull();
    expect(panel.root.querySelector('.sheet')).toBeNull();
  });

  it('still mounts, so replayed edits have somewhere to live', () => {
    panel = createPanel(document, { replayOnly: true });
    expect(document.querySelector('[data-clumeral-edit-mode]')).toBeTruthy();
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
