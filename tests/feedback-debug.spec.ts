import { describe, it, expect } from 'vitest';
import { collectDebug } from '../src/modals.ts';
import { todayKey } from '../src/date.ts';

// setup.ts runs localStorage.clear() before every test globally.

describe('collectDebug — raw localStorage passthrough', () => {
  it('returns the exact raw strings for history/prefs/active (unparsed)', () => {
    const historyRaw = '[{"date":"2026-06-01","tries":3}]';
    const prefsRaw = '{"theme":"dark"}';
    const activeRaw = '{"v":1,"date":"2026-06-01"}';
    localStorage.setItem('dlng_history', historyRaw);
    localStorage.setItem('dlng_prefs', prefsRaw);
    localStorage.setItem('dlng_active', activeRaw);

    const debug = collectDebug();
    expect(debug.history).toBe(historyRaw);
    expect(debug.prefs).toBe(prefsRaw);
    expect(debug.active).toBe(activeRaw);
  });
});

describe('collectDebug — missing-key safety', () => {
  it('returns "" for absent keys and does not throw', () => {
    expect(() => collectDebug()).not.toThrow();
    const debug = collectDebug();
    expect(debug.history).toBe('');
    expect(debug.prefs).toBe('');
    expect(debug.active).toBe('');
  });
});

describe('collectDebug — context fields', () => {
  it('tzOffset is a number, localToday matches todayKey(), screen is a WxH string', () => {
    const debug = collectDebug();
    expect(typeof debug.tzOffset).toBe('number');
    expect(debug.localToday).toBe(todayKey());
    expect(debug.screen).toMatch(/^\d+x\d+$/);
  });
});
