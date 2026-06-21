import { test } from 'node:test';
import assert from 'node:assert';
import { makeRng, shuffle } from '../src/rng.js';

test('same seed yields same sequence', () => {
  const a = makeRng(42), b = makeRng(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('rng outputs are in [0,1)', () => {
  const r = makeRng(1);
  for (let i = 0; i < 100; i++) { const x = r(); assert.ok(x >= 0 && x < 1); }
});

test('getState/setState resumes the exact sequence', () => {
  const r = makeRng(7);
  r(); r(); r();
  const snap = r.getState();
  const expected = [r(), r(), r()];
  const r2 = makeRng(999);          // different seed
  r2.setState(snap);                // restore position
  assert.deepEqual([r2(), r2(), r2()], expected);
});

test('shuffle is deterministic per seed and preserves elements', () => {
  const arr = [1, 2, 3, 4, 5];
  const s1 = shuffle(arr, makeRng(7));
  const s2 = shuffle(arr, makeRng(7));
  assert.deepEqual(s1, s2);
  assert.deepEqual([...s1].sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual(arr, [1, 2, 3, 4, 5]);   // input not mutated
});
