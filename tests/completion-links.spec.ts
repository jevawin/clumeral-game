import { describe, it, expect, beforeEach, vi } from 'vitest';

function setupDOM(): void {
  document.body.innerHTML = `
    <div data-completion-octo></div>
    <h2 data-completion-heading></h2>
    <p data-completion-subheading></p>
    <div data-completion-stats></div>
    <p data-completion-countdown></p>
    <button data-completion-feedback></button>
    <div data-completion-links></div>
  `;
}

describe('completion links (ARC-02)', () => {
  beforeEach(() => {
    // Fresh DOM and fresh module evaluation per test — completion.ts caches DOM refs at import.
    setupDOM();
    vi.resetModules();
  });

  it('ARC-02: /archive/<today> solved view links Show puzzle to in-app handler and Archive to /archive', async () => {
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(42, 2, false, { activeDate: '2026-05-03', todayLocal: '2026-05-03' });

    const links = document.querySelector('[data-completion-links]')!;
    const showPuzzle = links.querySelector('[data-completion-show-puzzle]') as HTMLAnchorElement | null;
    const archive = links.querySelector('[data-completion-archive]') as HTMLAnchorElement;
    expect(showPuzzle).not.toBeNull();
    expect(archive.getAttribute('href')).toBe('/archive');
  });

  it('ARC-02: /archive/<other-date> solved view shows only Archive link → /archive (no Show puzzle)', async () => {
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(10, 3, false, { activeDate: '2026-04-01', todayLocal: '2026-05-03' });

    const links = document.querySelector('[data-completion-links]')!;
    const showPuzzle = links.querySelector('[data-completion-show-puzzle]');
    const archive = links.querySelector('[data-completion-archive]') as HTMLAnchorElement;
    expect(showPuzzle).toBeNull();
    expect(archive.getAttribute('href')).toBe('/archive');
  });

  it('ARC-02: daily /play solved view (no opts) keeps existing Show puzzle + /archive links', async () => {
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(42, 1, false);

    const links = document.querySelector('[data-completion-links]')!;
    const showPuzzle = links.querySelector('[data-completion-show-puzzle]') as HTMLAnchorElement | null;
    const archive = links.querySelector('[data-completion-archive]') as HTMLAnchorElement;
    expect(showPuzzle).not.toBeNull();
    expect(archive.getAttribute('href')).toBe('/archive');
  });

  it('ARC-02: random solved view shows only /archive (no Show puzzle)', async () => {
    const mod = await import('../src/completion.ts');
    mod.renderCompletion(0, 4, true);

    const links = document.querySelector('[data-completion-links]')!;
    const showPuzzle = links.querySelector('[data-completion-show-puzzle]');
    const archive = links.querySelector('[data-completion-archive]') as HTMLAnchorElement;
    expect(showPuzzle).toBeNull();
    expect(archive.getAttribute('href')).toBe('/archive');
  });
});
