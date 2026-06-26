import { test } from 'node:test';
import assert from 'node:assert';
import { ACHIEVEMENTS, checkAchievements, cellKey, grantBounties, collectAchievement, collectBounty, collectableAchievements, collectableBounties, pendingMeta } from '../src/achievements.js';
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

test('curator rewards breadth of exploration (N different relics across runs) and never re-pays', () => {
  const p = makeProfile();
  const base = { phase:'end', won:true, roundIndex:8, boughtAnythingThisRun:true, discardedThisRun:true, totalWordsThisRun:30, flawlessSoFar:false, archetypeTally:{}, relicsCount:1, modsCount:0, stakeId:0, allRelicIds:[], allModIds:[] };
  const n = CONFIG.META.achievement.discoverRelics;
  p.stats.relicsEverUsed = Array.from({ length: n - 1 }, (_, i) => 'r' + i);
  assert.ok(!checkAchievements(p, base, CONFIG).map(a=>a.id).includes('curator'), 'below threshold -> no fire');
  p.stats.relicsEverUsed = Array.from({ length: n }, (_, i) => 'r' + i);
  assert.ok(checkAchievements(p, base, CONFIG).map(a=>a.id).includes('curator'), 'at threshold -> fires');
  p.completed.push('curator');
  assert.ok(!checkAchievements(p, base, CONFIG).map(a=>a.id).includes('curator'), 'already completed -> never re-pays');
});

test('grantBounties marks earned cells (lower stakes auto), no Meta paid yet', () => {
  const p = makeProfile();
  const earned = grantBounties(p, 2, 'standard');
  assert.deepEqual(earned.sort(), ['0:standard','1:standard','2:standard']);
  assert.ok(p.bountyEarned['2:standard'] && !p.bountyClaimed['2:standard']);
  assert.deepEqual(grantBounties(p, 1, 'standard'), []);   // already earned
  assert.equal(cellKey(1, 'standard'), '1:standard');
});

test('collectBounty pays once, only after it is earned', () => {
  const p = makeProfile();
  grantBounties(p, 1, 'standard');
  assert.equal(collectBounty(p, '1:standard', CONFIG), CONFIG.META.bounty[1]);
  assert.ok(p.bountyClaimed['1:standard']);
  assert.equal(collectBounty(p, '1:standard', CONFIG), 0);   // already claimed
  assert.equal(collectBounty(p, '2:standard', CONFIG), 0);   // not earned
});

test('collectAchievement pays the reward once, only after completion', () => {
  const p = makeProfile();
  assert.equal(collectAchievement(p, 'firstWin', CONFIG), 0);   // not completed
  p.completed.push('firstWin');
  assert.equal(collectAchievement(p, 'firstWin', CONFIG), CONFIG.META.achievement.reward.onboarding);
  assert.ok(p.claimedAchievements.includes('firstWin'));
  assert.equal(collectAchievement(p, 'firstWin', CONFIG), 0);   // already claimed
});

test('collectable lists surface uncollected items and pendingMeta sums them', () => {
  const p = makeProfile();
  p.completed.push('firstWin');           // onboarding reward
  grantBounties(p, 0, 'standard');        // bounty[0]
  assert.deepEqual(collectableAchievements(p, CONFIG).map(a => a.id), ['firstWin']);
  assert.deepEqual(collectableBounties(p, CONFIG).map(b => b.key), ['0:standard']);
  assert.equal(pendingMeta(p, CONFIG), CONFIG.META.achievement.reward.onboarding + CONFIG.META.bounty[0]);
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
