import { test } from 'node:test';
import assert from 'node:assert';
import { BOSSES, ALL_BOSS_IDS, bossTileValues, applyBossToScore, bossHandDelta } from '../src/bosses.js';

test('roster: Ceiling removed, Censor + One-Liner added', () => {
  assert.deepEqual(ALL_BOSS_IDS.sort(), ['censor', 'margin', 'mute', 'oneLiner', 'toll', 'vise']);
});

test('The Censor now disables a relic (verb=disable, target=relic), not a letter', () => {
  assert.equal(BOSSES.censor.warp.verb, 'disable');
  assert.equal(BOSSES.censor.warp.target, 'relic');
  const tv = { A: 1, E: 1, R: 1, Z: 10 };
  // No censorLetter is passed on a normal Censor round → tile values are untouched (the relic is disabled in run.js).
  assert.equal(bossTileValues(tv, BOSSES.censor, null), tv);
  // No-relic fallback: a chosen letter is still zeroed so the encounter bites.
  const fallback = bossTileValues(tv, BOSSES.censor, 'R');
  assert.equal(fallback.R, 0); assert.equal(fallback.A, 1); assert.equal(fallback.Z, 10);
});

test('The Vise now allows 0 discards; The One-Liner is a limit warp (no score change)', () => {
  assert.equal(BOSSES.vise.warp.keep, 0);
  assert.equal(BOSSES.oneLiner.warp.plays, 1);
  assert.ok(BOSSES.oneLiner.warp.targetMult < 1);
  // limit is applied at encounter setup (run.js), so it does NOT alter a score directly:
  const scored = { points: 20, mult: 3, score: 60 };
  assert.equal(applyBossToScore(scored, BOSSES.oneLiner), scored);
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
  assert.equal(bossTileValues(tv, BOSSES.toll), tv);   // non-disable boss: same ref
  assert.equal(bossTileValues(tv, null), tv);
});

test('applyBossToScore: cap clamps mult, tax subtracts, others no-op', () => {
  const scored = { points: 20, mult: 10, score: 200 };
  // cap is a retained primitive (no boss uses it now); test it directly with an inline cap warp.
  assert.deepEqual(applyBossToScore(scored, { warp: { verb: 'cap', maxMult: 3 } }), { points: 20, mult: 3, score: 60 });
  assert.deepEqual(applyBossToScore(scored, BOSSES.toll), { points: 20, mult: 10, score: 190 });    // -10
  assert.deepEqual(applyBossToScore({ points: 5, mult: 1, score: 5 }, BOSSES.toll), { points: 5, mult: 1, score: 0 }); // floored
  assert.equal(applyBossToScore(scored, BOSSES.mute), scored);   // disable handled via tileValues, not here
  assert.equal(applyBossToScore(scored, null), scored);
});
