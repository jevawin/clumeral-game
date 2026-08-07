import { describe, it, expect } from 'vitest';
// A static import is the assertion: the script used to call process.exit(1) at
// module scope when no token was found, which killed the vitest process during
// collection on any machine without a .env — i.e. CI.
import { withinTolerance } from '../scripts/compare-ae-d1.mjs';

describe('compare-ae-d1 — importable without side effects', () => {
  it('exports withinTolerance and runs nothing on import', () => {
    expect(typeof withinTolerance).toBe('function');
  });
});
