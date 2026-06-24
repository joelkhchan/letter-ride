import test from 'node:test';
import assert from 'node:assert/strict';
import { wilsonInterval, mcnemar, normalCI } from '../src/stats.js';

test('wilsonInterval brackets the point estimate and handles edges', () => {
  const w = wilsonInterval(60, 100);
  assert.equal(w.p, 0.6);
  assert.ok(w.low > 0.49 && w.high < 0.70);
  assert.deepEqual(wilsonInterval(0, 0), { p: 0, low: 0, high: 0 });
  const allWin = wilsonInterval(20, 20);
  assert.ok(allWin.high <= 1 && allWin.low < 1);
});

test('mcnemar measures paired disagreement', () => {
  const wonA = [true, true, true, true, false];
  const wonB = [false, false, false, true, false];
  const m = mcnemar(wonA, wonB);
  assert.equal(m.b, 3);
  assert.equal(m.c, 0);
  assert.ok(m.p < 0.5);
  const tie = mcnemar([true, false], [true, false]);
  assert.equal(tie.b + tie.c, 0);
  assert.equal(tie.p, 1);
});

test('normalCI brackets the mean', () => {
  const c = normalCI([10, 20, 30, 40, 50]);
  assert.equal(c.mean, 30);
  assert.ok(c.low < 30 && c.high > 30);
});
