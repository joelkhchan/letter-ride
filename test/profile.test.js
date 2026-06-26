import { test } from 'node:test';
import assert from 'node:assert';
import { makeProfile, loadProfile, saveProfile, recordPlay, recordRunEnd, levelFor, statsSummary } from '../src/profile.js';

function memStore() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; }

test('recordPlay tracks word count and personal-best word', () => {
  const p = makeProfile();
  recordPlay(p, { word: 'CAT', score: 30 });
  recordPlay(p, { word: 'DOGE', score: 80 });
  recordPlay(p, { word: 'OX', score: 10 });
  assert.equal(p.stats.wordsPlayed, 3);
  assert.equal(p.stats.bestWordScore, 80);
  assert.equal(p.stats.bestWord, 'DOGE');
});

test('recordRunEnd accumulates runs/wins/bests and dedupes used-id sets', () => {
  const p = makeProfile();
  recordRunEnd(p, { won: true, roundsCleared: 9, runScore: 500, relicIds: ['a','b'], modIds: ['x'] });
  recordRunEnd(p, { won: false, roundsCleared: 2, runScore: 100, relicIds: ['b','c'], modIds: ['x','y'] });
  assert.equal(p.stats.runs, 2);
  assert.equal(p.stats.wins, 1);
  assert.equal(p.stats.roundsCleared, 11);
  assert.equal(p.stats.bestRunScore, 500);
  assert.deepEqual([...p.stats.relicsEverUsed].sort(), ['a','b','c']);
  assert.deepEqual([...p.stats.modsEverApplied].sort(), ['x','y']);
});

test('loadProfile tolerates corruption and round-trips', () => {
  const s = memStore();
  s.setItem('letterRide.profile', '{not json');
  const fresh = loadProfile(s);
  assert.equal(fresh.stats.runs, 0);
  recordRunEnd(fresh, { won: true, roundsCleared: 9, runScore: 1, relicIds: [], modIds: [] });
  saveProfile(fresh, s);
  const again = loadProfile(s);
  assert.equal(again.stats.runs, 1);
  assert.equal(again.stats.wins, 1);
});

test('makeProfile seeds the claim-model fields; loadProfile defaults them', () => {
  const p = makeProfile();
  assert.deepEqual(p.completed, []);
  assert.deepEqual(p.claimedAchievements, []);
  assert.deepEqual(p.bountyEarned, {});
  assert.deepEqual(p.bountyClaimed, {});
  const s = memStore();
  s.setItem('letterRide.profile', JSON.stringify({ completed: ['x'] }));   // partial old shape
  const loaded = loadProfile(s);
  assert.deepEqual(loaded.completed, ['x']);
  assert.deepEqual(loaded.claimedAchievements, []);
  assert.deepEqual(loaded.bountyClaimed, {});
});

test('lifetimeScore accumulates and levelFor maps it to a tier', () => {
  const p = makeProfile();
  recordPlay(p, { word: 'CAT', score: 3000 });
  assert.equal(p.stats.lifetimeScore, 3000);
  const cfg = { LEVELS: { names: ['Novice','Apprentice','Journeyman','Expert','Artisan'], thresholds: [0,3000,9000,20000,40000] } };
  assert.equal(levelFor(2999, cfg).name, 'Novice');
  assert.equal(levelFor(3000, cfg).index, 1);
  assert.equal(levelFor(3000, cfg).name, 'Apprentice');
  assert.equal(levelFor(3000, cfg).nextAt, 9000);
  assert.equal(levelFor(99999, cfg).nextAt, null);   // top tier
});

test('recordPlay tracks letters, longest word, and best round score', () => {
  const p = makeProfile();
  recordPlay(p, { word: 'CAT',   score: 30, roundTotal: 30 });
  recordPlay(p, { word: 'DOGES', score: 80, roundTotal: 110 });
  recordPlay(p, { word: 'OX',    score: 10, roundTotal: 25 });   // lower roundTotal: best round holds
  assert.equal(p.stats.lettersPlayed, 3 + 5 + 2);
  assert.equal(p.stats.longestWord, 'DOGES');
  assert.equal(p.stats.longestWordLen, 5);
  assert.equal(p.stats.bestRoundScore, 110);
});

test('statsSummary derives win rate, averages, rank progress, and discovery counts', () => {
  const cfg = { LEVELS: { names: ['Novice', 'Apprentice', 'Journeyman'], thresholds: [0, 100, 300] } };
  const p = makeProfile();
  recordRunEnd(p, { won: true,  roundsCleared: 6, runScore: 200, relicIds: ['a', 'b'], modIds: ['x'] });
  recordRunEnd(p, { won: false, roundsCleared: 2, runScore: 100, relicIds: ['b'],      modIds: [] });
  recordPlay(p, { word: 'CAT',  score: 50, roundTotal: 50 });
  recordPlay(p, { word: 'DOGS', score: 60, roundTotal: 110 });
  recordPlay(p, { word: 'IT',   score: 40, roundTotal: 150 });
  recordPlay(p, { word: 'QUIZ', score: 50, roundTotal: 150 });
  const sum = statsSummary(p, cfg, { relicsTotal: 10, modsTotal: 5, achievementsTotal: 20 });
  assert.equal(sum.winRate, 0.5);
  assert.equal(sum.avgRoundsPerRun, 4);
  assert.equal(sum.wordsPlayed, 4);
  assert.equal(sum.avgWordLength, 13 / 4);
  assert.equal(sum.bestRoundScore, 150);
  assert.equal(sum.avgScorePerWord, 50);
  assert.equal(sum.rank.name, 'Apprentice');
  assert.equal(sum.rank.nextAt, 300);
  assert.equal(sum.rank.progress, 0.5);
  assert.equal(sum.relicsDiscovered, 2);
  assert.equal(sum.relicsTotal, 10);
  assert.equal(sum.modsDiscovered, 1);
  assert.equal(sum.achievementsTotal, 20);
});

test('statsSummary is safe on an empty profile (no divide-by-zero)', () => {
  const cfg = { LEVELS: { names: ['Novice'], thresholds: [0] } };
  const sum = statsSummary(makeProfile(), cfg, { relicsTotal: 10, modsTotal: 5, achievementsTotal: 20 });
  assert.equal(sum.winRate, 0);
  assert.equal(sum.avgWordLength, 0);
  assert.equal(sum.avgRoundsPerRun, 0);
  assert.equal(sum.rank.name, 'Novice');
  assert.equal(sum.rank.progress, 1);   // no next tier -> full bar
});
