import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPct, diffSummaries, toJSON } from '../src/report.js';

test('formatPct', () => {
  assert.equal(formatPct(0.625), '62.5%');
  assert.equal(formatPct(0.1, 0), '10%');
});

test('diffSummaries reports win-rate and p50 deltas', () => {
  const before = { winRate: 0.4, roundReached: { p50: 5 } };
  const after  = { winRate: 0.6, roundReached: { p50: 7 } };
  const d = diffSummaries(after, before);
  assert.equal(Number(d.winRateDelta.toFixed(3)), 0.2);
  assert.equal(d.p50Delta, 2);
});

test('toJSON sorts keys for stable diffs', () => {
  assert.equal(toJSON({ b: 1, a: 2 }), '{\n  "a": 2,\n  "b": 1\n}');
});
