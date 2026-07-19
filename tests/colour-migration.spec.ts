import { describe, it, expect, beforeEach, vi } from 'vitest';

// #255 renamed the themes to fruit. The accent preference is stored as the theme
// name itself, so without a migration every player not on Lime would silently
// reset to Lime on their next visit. These lock that down.

async function bootColours(stored: string | null): Promise<void> {
  localStorage.clear();
  if (stored !== null) localStorage.setItem('dlng_colour', stored);
  document.body.innerHTML =
    '<span data-theme-name></span><div data-swatches></div>';
  document.documentElement.removeAttribute('data-theme');
  vi.resetModules();
  const { initColours } = await import('../src/colours.ts');
  initColours();
}

beforeEach(() => {
  localStorage.clear();
});

describe('legacy theme name migration (#255)', () => {
  it.each([
    ['Berry', 'Cherry'],
    ['Blue', 'Blueberry'],
    ['Violet', 'Grape'],
  ])('%s resolves to %s', async (stored, expected) => {
    await bootColours(stored);
    expect(document.documentElement.dataset.theme).toBe(expected);
  });

  it.each([
    ['Berry', 'Cherry'],
    ['Blue', 'Blueberry'],
    ['Violet', 'Grape'],
  ])('rewrites %s in storage so the migration runs once', async (stored, expected) => {
    await bootColours(stored);
    expect(localStorage.getItem('dlng_colour')).toBe(expected);
  });

  it.each(['Lime', 'Cherry', 'Blueberry', 'Grape'])('leaves the current name %s alone', async (name) => {
    await bootColours(name);
    expect(document.documentElement.dataset.theme).toBe(name);
    expect(localStorage.getItem('dlng_colour')).toBe(name);
  });

  it('falls back to Lime for an unknown value without rewriting storage', async () => {
    await bootColours('Chartreuse');
    expect(document.documentElement.dataset.theme).toBe('Lime');
    // Unknown is not a legacy name, so nothing is rewritten — a value from a
    // future version stays intact rather than being clobbered by an old build.
    expect(localStorage.getItem('dlng_colour')).toBe('Chartreuse');
  });

  it('defaults to Lime when nothing is stored', async () => {
    await bootColours(null);
    expect(document.documentElement.dataset.theme).toBe('Lime');
  });
});
