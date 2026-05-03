import { describe, it } from 'vitest';

describe('resolveRoute (RTE-03, ARC-03)', () => {
  it.todo('RTE-03: /play with no Clumeral data → welcome');
  it.todo('RTE-03: /play with today already solved → solved');
  it.todo('RTE-03: /solved with no/stale today entry → welcome');
  it.todo('RTE-03: /welcome → welcome (passthrough)');
  it.todo('RTE-03: /play with data + unsolved → play');
  it.todo('ARC-03: /archive/2099-01-01 (future) → archive');
  it.todo('ARC-03: /archive/not-a-date → archive');
  it.todo('ARC-03: /archive/<past-valid-date> → archive-date');
  it.todo('ARC-03: /archive (bare) → archive');
  it.todo('ARC-03: /unknown/path → welcome (fallback)');
});
