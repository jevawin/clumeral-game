import { describe, it, expect } from 'vitest';
import { STEPS, gateMatches, holdMsFor, TYPE_MS, DELETE_MS } from '../src/walkthrough.ts';

describe('walkthrough step machine', () => {
  it('has the scripted flow ending in an end step', () => {
    expect(STEPS).toHaveLength(6);
    expect(STEPS[0].kind).toBe('gated');
    expect(STEPS[1].kind).toBe('timed');
    expect(STEPS[2].kind).toBe('timed');
    expect(STEPS[3].kind).toBe('gated');
    expect(STEPS[4].kind).toBe('timed');
    expect(STEPS[5].kind).toBe('end');
  });

  it('gated steps carry the matching game event', () => {
    expect(STEPS[0].gate).toBe('game:box-opened');
    expect(STEPS[3].gate).toBe('game:digit-eliminated');
  });

  it('gateMatches advances only on the step’s own event', () => {
    expect(gateMatches(STEPS[0], 'game:box-opened')).toBe(true);
    expect(gateMatches(STEPS[0], 'game:digit-eliminated')).toBe(false);
    expect(gateMatches(STEPS[3], 'game:digit-eliminated')).toBe(true);
    expect(gateMatches(STEPS[3], 'game:box-opened')).toBe(false);
  });

  it('gateMatches is false for non-gated steps', () => {
    expect(gateMatches(STEPS[1], 'game:box-opened')).toBe(false);
    expect(gateMatches(STEPS[5], 'game:digit-eliminated')).toBe(false);
  });

  it('holdMsFor: 200 wpm + 1s buffer, 2s floor', () => {
    expect(holdMsFor('one two three four five six seven')).toBe(
      Math.max(Math.round((7 / 200) * 60_000) + 1000, 2000),
    );
    expect(holdMsFor('hi')).toBe(2000); // floor
    expect(holdMsFor('   ')).toBe(2000); // no words → floor
  });

  it('type is slower than delete', () => {
    expect(TYPE_MS).toBe(45);
    expect(DELETE_MS).toBe(25);
    expect(DELETE_MS).toBeLessThan(TYPE_MS);
  });
});
