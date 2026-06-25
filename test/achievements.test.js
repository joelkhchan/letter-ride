import { test } from 'node:test';
import assert from 'node:assert';
import { ACHIEVEMENTS, checkAchievements, cellKey, grantBounties } from '../src/achievements.js';
import { makeProfile } from '../src/profile.js';
import { CONFIG } from '../src/config.js';

test('catalog has unique ids and a known bucket each', () => {
  const ids = ACHIEVEMENTS.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length);
  const buckets = new Set(['onboarding','mastery','diversity','discovery','progression']);
  assert.ok(ACHIEVEMENTS.every(a => buckets.has(a.bucket)));
});

test('a single-word round clear unlocks oneWordClear, paid from the mastery bucket', () => {
  const p = makeProfile();
  const ctx = { phase: 'play', letters: ['C','A','T'], word: 'CAT', score: 20, wordsPlayedThisRound: 1, status: 'roundCleared', playsLeft: 3, prevRoundTotal: 0, target: 10, roundTotal: 20, roundIndex: 0 };
  const got = checkAchievements(p, ctx, CONFIG);
  const ids = got.map(a => a.id);
  assert.ok(ids.includes('oneWordClear'));
  assert.equal(got.find(a => a.id === 'oneWordClear').reward, CONFIG.META.achievement.reward.mastery);
});

test('no double-award: an id already in completed is never returned', () => {
  const p = makeProfile(); p.completed.push('oneWordClear');
  const ctx = { phase: 'play', letters: ['C','A','T'], word: 'CAT', score: 20, wordsPlayedThisRound: 1, status: 'roundCleared', playsLeft: 3, prevRoundTotal: 0, target: 10, roundTotal: 20, roundIndex: 0 };
  assert.ok(!checkAchievements(p, ctx, CONFIG).map(a => a.id).includes('oneWordClear'));
});

test('"win leaning vowels" reads the dominant non-trivial archetype', () => {
  const p = makeProfile();
  const ctx = { phase: 'end', won: true, roundIndex: 8, boughtAnythingThisRun: true, discardedThisRun: true, totalWordsThisRun: 30, flawlessSoFar: false, archetypeTally: { vowelHeavy: 5, shortWord: 1, escalation: 6 }, relicsCount: 1, modsCount: 0, stakeId: 0, allRelicIds: [], allModIds: [] };
  assert.ok(checkAchievements(p, ctx, CONFIG).map(a => a.id).includes('winVowels'));
});

test('completeness predicate compares against the live roster and never re-pays', () => {
  const p = makeProfile();
  p.stats.relicsEverUsed = ['a','b'];
  const base = { phase:'end', won:true, roundIndex:8, boughtAnythingThisRun:true, discardedThisRun:true, totalWordsThisRun:30, flawlessSoFar:false, archetypeTally:{}, relicsCount:1, modsCount:0, stakeId:0, allModIds:[] };
  assert.ok(checkAchievements(p, { ...base, allRelicIds: ['a','b'] }, CONFIG).map(a=>a.id).includes('curator'));
  p.completed.push('curator');
  assert.ok(!checkAchievements(p, { ...base, allRelicIds: ['a','b','c'] }, CONFIG).map(a=>a.id).includes('curator'));
});

test('grantBounties auto-grants lower stakes for the same deck, once', () => {
  const p = makeProfile();
  const r1 = grantBounties(p, 2, 'standard', CONFIG);
  assert.deepEqual(r1.granted.sort(), ['0:standard','1:standard','2:standard']);
  assert.equal(r1.meta, CONFIG.META.bounty[0] + CONFIG.META.bounty[1] + CONFIG.META.bounty[2]);
  const r2 = grantBounties(p, 1, 'standard', CONFIG);
  assert.deepEqual(r2.granted, []);
  assert.equal(r2.meta, 0);
  assert.equal(cellKey(1, 'standard'), '1:standard');
});

test('reaching a lifetime level unlocks the matching progression achievement', () => {
  const p = makeProfile();
  p.stats.lifetimeScore = CONFIG.LEVELS.thresholds[2];   // Journeyman tier
  const ctx = { phase: 'end', won: false, roundIndex: 2, boughtAnythingThisRun: true, discardedThisRun: true, totalWordsThisRun: 5, flawlessSoFar: false, archetypeTally: {}, relicsCount: 0, modsCount: 0, stakeId: 0, allRelicIds: [], allModIds: [] };
  const ids = checkAchievements(p, ctx, CONFIG).map(a => a.id);
  assert.ok(ids.includes('reachApprentice'));
  assert.ok(ids.includes('reachJourneyman'));
  assert.ok(!ids.includes('reachExpert'));
});
