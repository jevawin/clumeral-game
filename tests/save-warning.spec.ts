import { describe, it, expect } from 'vitest';
import { createSaveWarning, COUNTDOWN_MS, WARNING_TEXT } from '../src/save-warning.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

// Injected clock, so the five seconds cost nothing to test.
function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance(ms: number) { t += ms; } };
}

describe('the untick warning and submit countdown', () => {
  it('says nothing and holds nothing while the box is ticked', () => {
    const w = createSaveWarning({ now: clock().now });
    expect(w.state()).toEqual({ warning: false, secondsLeft: 0, submitAvailable: true });
  });

  it('says nothing on load for a player who opted out weeks ago', () => {
    // The warning belongs to the act of unticking, not to the stored preference.
    // Nothing calls setChecked until the player touches the box.
    const w = createSaveWarning({ now: clock().now });
    expect(w.state().warning).toBe(false);
  });

  it('shows the warning and holds submit the moment the box is unticked', () => {
    const c = clock();
    const w = createSaveWarning({ now: c.now });
    w.setChecked(false);
    expect(w.state()).toEqual({ warning: true, secondsLeft: 5, submitAvailable: false });
  });

  it('counts down and still holds submit four seconds in', () => {
    const c = clock();
    const w = createSaveWarning({ now: c.now });
    w.setChecked(false);
    c.advance(4_000);
    expect(w.state().secondsLeft).toBe(1);
    expect(w.state().submitAvailable).toBe(false);
  });

  it('releases submit at five seconds and drops the countdown', () => {
    const c = clock();
    const w = createSaveWarning({ now: c.now });
    w.setChecked(false);
    c.advance(COUNTDOWN_MS);
    expect(w.state().secondsLeft).toBe(0);
    expect(w.state().submitAvailable).toBe(true);
  });

  it('keeps the warning up while the box stays unticked', () => {
    // The warning is what stands between a mis-tap and a deletion, and the
    // deletion happens on submit — which can be long after the countdown ends.
    const c = clock();
    const w = createSaveWarning({ now: c.now });
    w.setChecked(false);
    c.advance(60_000);
    expect(w.state().warning).toBe(true);
  });

  it('re-ticking before the five seconds are up releases submit immediately', () => {
    const c = clock();
    const w = createSaveWarning({ now: c.now });
    w.setChecked(false);
    c.advance(1_000);
    w.setChecked(true);
    expect(w.state()).toEqual({ warning: false, secondsLeft: 0, submitAvailable: true });
  });

  it('restarts a full five seconds on a second untick rather than resuming the first', () => {
    const c = clock();
    const w = createSaveWarning({ now: c.now });
    w.setChecked(false);
    c.advance(4_000);
    w.setChecked(true);
    w.setChecked(false);
    expect(w.state().secondsLeft).toBe(5);
    expect(w.state().submitAvailable).toBe(false);
  });

  it('comes back available after a tab is hidden across the five seconds', () => {
    // Availability is read from the clock on the next check, never from a timer
    // that may not have fired — otherwise a backgrounded tab holds submit for
    // good.
    const c = clock();
    const w = createSaveWarning({ now: c.now });
    w.setChecked(false);
    c.advance(600_000);
    expect(w.state().submitAvailable).toBe(true);
  });

  it("uses Jamie's wording verbatim", () => {
    expect(WARNING_TEXT).toBe('Your existing stats will be deleted when you submit.');
  });
});

// P-02, settled by Jamie: the warning does NOT replace the checkbox's label.
// Swapping the label would leave a screen reader announcing "Your existing stats
// will be deleted when you submit, checkbox, not checked", and would fail WCAG
// 2.5.3 Label in Name, which voice control depends on. These assert the shipped
// markup rather than a copy of it.
describe('the checkbox keeps its own label (P-02)', () => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
  const doc = new JSDOM(html).window.document;

  it('labels the checkbox "Save my scores on this device"', () => {
    const label = doc.querySelector('label[for="cw-ck"]')!;
    expect(label.textContent!.replace(/\s+/g, ' ').trim()).toBe('Save my scores on this device');
  });

  it('says nothing about cookies (brief 69, 129)', () => {
    const row = doc.querySelector('[data-save]')!;
    expect(row.innerHTML.toLowerCase()).not.toContain('cookie');
  });

  it('puts the warning outside the label, and describes the checkbox with it', () => {
    const label = doc.querySelector('label[for="cw-ck"]')!;
    expect(label.querySelector('[data-save-warning]')).toBeNull();
    const warning = doc.querySelector('[data-save-warning]')!;
    expect(doc.querySelector('[data-save-check]')!.getAttribute('aria-describedby'))
      .toBe(warning.id);
  });

  it('makes the warning a polite live region and leaves the countdown silent', () => {
    expect(doc.querySelector('[data-save-warning]')!.getAttribute('aria-live')).toBe('polite');
    expect(doc.querySelector('[data-save-countdown]')!.hasAttribute('aria-live')).toBe(false);
  });
});

// The completion announcement is a position, not a value: it only works because
// the region sits outside every screen. Nothing else in the suite reads that, so
// a future markup tidy-up could move it back inside "where it belongs", leave the
// suite green, and silently stop the result being spoken.
describe('the completion announcement lives outside every screen', () => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
  const doc = new JSDOM(html).window.document;
  const live = doc.querySelector('[data-completion-live]')!;

  it('exists, and is a polite status region', () => {
    expect(live).not.toBeNull();
    expect(live.getAttribute('role')).toBe('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.className).toContain('sr-only');
  });

  it('has no [data-screen] ancestor', () => {
    // A screen goes display:none when inactive, and a display:none subtree is
    // not in the accessibility tree at all — so a region inside one arrives
    // complete, as inserted content, which screen readers routinely ignore.
    expect(live.closest('[data-screen]')).toBeNull();
  });

  it('has no aria-hidden ancestor', () => {
    expect(live.closest('[aria-hidden="true"]')).toBeNull();
  });
});
