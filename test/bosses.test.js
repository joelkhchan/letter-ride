import { test } from 'node:test';
import assert from 'node:assert';
import { BOSSES, ALL_BOSS_IDS, bossTileValues, applyBossToScore, bossHandDelta } from '../src/bosses.js';

test('roster has the five bosses', () => {
  assert.deepEqual(ALL_BOSS_IDS.sort(), ['ceiling', 'margin', 'mute', 'toll', 'vise']);
});

test('bossHandDelta: The Margin shrinks the hand, other bosses are 0', () => {
  assert.equal(bossHandDelta(BOSSES.margin), -2);
  assert.equal(bossHandDelta(BOSSES.vise), 0);     // discard-lock, not a hand-lock
  assert.equal(bossHandDelta(BOSSES.mute), 0);
  assert.equal(bossHandDelta(null), 0);
});

test('bossTileValues zeroes vowels for The Mute, no-op otherwise', () => {
  const tv = { A: 1, E: 1, R: 1, Z: 10 };
  const muted = bossTileValues(tv, BOSSES.mute);
  assert.equal(muted.A, 0); assert.equal(muted.E, 0); assert.equal(muted.R, 1); assert.equal(muted.Z, 10);
  assert.equal(bossTileValues(tv, BOSSES.ceiling), tv);   // non-disable boss: same ref
  assert.equal(bossTileValues(tv, null), tv);
});

test('applyBossToScore: cap clamps mult, tax subtracts, others no-op', () => {
  const scored = { points: 20, mult: 10, score: 200 };
  assert.deepEqual(applyBossToScore(scored, BOSSES.ceiling), { points: 20, mult: 3, score: 60 });   // capped at 3
  assert.deepEqual(applyBossToScore(scored, BOSSES.toll), { points: 20, mult: 10, score: 190 });    // -10
  assert.deepEqual(applyBossToScore({ points: 5, mult: 1, score: 5 }, BOSSES.toll), { points: 5, mult: 1, score: 0 }); // floored
  assert.equal(applyBossToScore(scored, BOSSES.mute), scored);   // disable handled via tileValues, not here
  assert.equal(applyBossToScore(scored, null), scored);
});
