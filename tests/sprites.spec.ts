import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A <use href="#icon-missing"> renders as nothing at all — no error, no gap in
// the layout worth noticing, and no other test would catch it. So the icons the
// completion panel depends on are pinned here by id, each with its exact viewBox
// (redesign brief 33, 79; results brief 40, 86, 90).

const sheet = readFileSync(resolve(__dirname, '..', 'public/sprites.svg'), 'utf-8');

// The heading icons are tightened on the left to their ink edge, so the ink sits
// on the card's padding line (results plan D8). The rest keep the full square.
const VIEWBOXES: Record<string, string> = {
  'icon-flame': '4 0 20 24',
  'icon-podium': '2 0 22 24',
  'icon-calendar-head': '2 0 22 24',
  'icon-bolt': '0 0 8 10',
  'icon-trophy': '0 0 24 24',
  'icon-arrow-up': '0 0 24 24',
  'icon-arrow-left': '0 0 24 24',
  'icon-tick': '0 0 24 24',
  'icon-calculator': '0 0 24 24',
  'icon-gamepad': '0 0 24 24',
  'icon-stopwatch': '0 0 24 24',
};
const PANEL_ICONS = Object.keys(VIEWBOXES);
const HEADING_ICONS = ['icon-flame', 'icon-podium', 'icon-calendar-head'];

function symbol(id: string): string {
  const m = new RegExp(`<symbol id="${id}"[\\s\\S]*?</symbol>`).exec(sheet);
  if (!m) throw new Error(`no <symbol id="${id}"> in public/sprites.svg`);
  return m[0];
}

describe('the completion panel icons', () => {
  it.each(PANEL_ICONS)('%s exists', (id) => {
    expect(() => symbol(id)).not.toThrow();
  });

  it.each(PANEL_ICONS)('%s carries exactly its viewBox', (id) => {
    // Without one the symbol does not scale, and the icon renders at whatever
    // size its coordinates happen to be.
    expect(symbol(id).match(/viewBox="([^"]*)"/)?.[1]).toBe(VIEWBOXES[id]);
  });

  it.each(HEADING_ICONS)('%s pins its ink to the left edge', (id) => {
    expect(symbol(id)).toContain('preserveAspectRatio="xMinYMid meet"');
  });

  it('leaves icon-calendar square for the /play button', () => {
    const svg = symbol('icon-calendar');
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).not.toContain('preserveAspectRatio');
  });

  it.each(PANEL_ICONS)('%s draws in currentColor, never a literal', (id) => {
    // The icons inherit the surrounding colour, which is what makes them follow
    // the theme and dark mode without a rule of their own.
    const svg = symbol(id);
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).not.toMatch(/(stroke|fill)="#/);
  });
});
