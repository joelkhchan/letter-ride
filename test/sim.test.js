// test/sim.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { legalWords, bestPlay } from '../src/sim.js';
import { makeTile, resetTileIds } from '../src/tiles.js';

const WORDS = ['CAT', 'ACT', 'AT', 'CATS', 'DOG'];

test('legalWords returns words formable from the letters within [minLen, len]', () => {
  // letters C,A,T ; minLen 3 → CAT, ACT (AT too short; CATS needs S; DOG not formable)
  assert.deepEqual(legalWords(['C', 'A', 'T'], WORDS, 3).sort(), ['ACT', 'CAT']);
});

test('legalWords excludes words longer than the hand', () => {
  assert.deepEqual(legalWords(['C', 'A', 'T'], WORDS, 3).includes('CATS'), false);
});

test('bestPlay picks the highest-scoring legal play built from real rack tiles', () => {
  resetTileIds();
  const C = makeTile('C'), A = makeTile('A'), T = makeTile('T');
  // minimal run-like object: rack + the fields scoring reads
  const run = {
    rack: [C, A, T],
    tileValues: { C: 3, A: 1, T: 1 },
    relics: [], honeLevels: {}, wordsPlayedThisRound: 0,
    config: { MIN_WORD_LEN: 3, LENGTH_BONUS_PER_LETTER: 0 },
  };
  const play = bestPlay(run, WORDS);
  assert.ok(play, 'a play exists');
  assert.ok(['CAT', 'ACT'].includes(play.word));
  // selection tiles are the REAL rack instances (consume-by-id depends on this)
  const ids = play.selection.map(s => s.tile.id).sort();
  assert.deepEqual(ids, [C, A, T].map(t => t.id).sort());
  assert.equal(play.score, 5); // C3+A1+T1, mult 1, no length bonus
});

test('bestPlay returns null when nothing is formable', () => {
  resetTileIds();
  const run = {
    rack: [makeTile('X'), makeTile('Q'), makeTile('Z')],
    tileValues: { X: 8, Q: 10, Z: 10 }, relics: [], honeLevels: {}, wordsPlayedThisRound: 0,
    config: { MIN_WORD_LEN: 3, LENGTH_BONUS_PER_LETTER: 0 },
  };
  assert.equal(bestPlay(run, WORDS), null);
});

test('bestPlay uses distinct rack instances for duplicate letters (multiset correctness)', () => {
  // rack [A, D1, D2] playing 'ADD' must pick both D tiles — not the same tile twice
  resetTileIds();
  const A = makeTile('A'), D1 = makeTile('D'), D2 = makeTile('D');
  const run = {
    rack: [A, D1, D2],
    tileValues: { A: 1, D: 2 }, relics: [], honeLevels: {}, wordsPlayedThisRound: 0,
    config: { MIN_WORD_LEN: 3, LENGTH_BONUS_PER_LETTER: 0 },
  };
  const play = bestPlay(run, ['ADD']);
  assert.ok(play, 'ADD is playable from [A, D, D]');
  assert.equal(play.word, 'ADD');
  const selIds = play.selection.map(s => s.tile.id).sort();
  // must be the TWO distinct D tile ids — not D1.id appearing twice
  assert.deepEqual(selIds, [A, D1, D2].map(t => t.id).sort());
});

import { simulateRun, pickTargetOffer, buildPurchasePolicy } from '../src/sim.js';
import { makeDictionary } from '../src/dictionary.js';
import { newRun } from '../src/run.js';
import { CONFIG } from '../src/config.js';

const dictCat = makeDictionary(['cat']);
const wordsCat = ['CAT'];

// configShop: real CONFIG extended so newRun works fully (COINS_ON_CLEAR + INTEREST needed).
// We use the real CONFIG directly — it already has SHOP + HONE blocks.
const configShop = CONFIG;

test('simulateRun wins a winnable config', () => {
  // bag of 3×CAT so the pool refills each round; CAT (C3+A1+T1=5) clears target 3 twice → won
  const config = {
    STARTING_BAG: ['C','A','T','C','A','T','C','A','T'], TILE_VALUES: { C:3, A:1, T:1 },
    RACK_SIZE: 3, PLAYS_PER_ROUND: 2, DISCARDS_PER_ROUND: 1, MIN_WORD_LEN: 3,
    LENGTH_BONUS_PER_LETTER: 0, ROUND_TARGETS: [3, 3],
  };
  const r = simulateRun({ config, dictionary: dictCat, words: wordsCat, seed: 1 });
  assert.equal(r.won, true);
  assert.equal(r.status, 'won');
  assert.equal(r.roundReached, 2);     // both rounds cleared
  assert.equal(r.hitCap, false);
});

test('simulateRun loses an unwinnable config and terminates (no infinite loop)', () => {
  const config = {
    STARTING_BAG: ['C','A','T','C','A','T'], TILE_VALUES: { C:3, A:1, T:1 },
    RACK_SIZE: 3, PLAYS_PER_ROUND: 2, DISCARDS_PER_ROUND: 0, MIN_WORD_LEN: 3,
    LENGTH_BONUS_PER_LETTER: 0, ROUND_TARGETS: [99999],   // unreachable
  };
  const r = simulateRun({ config, dictionary: dictCat, words: wordsCat, seed: 1 });
  assert.equal(r.won, false);
  assert.equal(r.status, 'lost');
  assert.equal(r.roundReached, 1);
  assert.equal(r.hitCap, false);
});

test('simulateRun terminates when no word is ever formable', () => {
  // dict has a word the bag can never spell → greedy discards until dead-hand loses; must not hang
  const config = {
    STARTING_BAG: ['X','Q','Z','X','Q','Z'], TILE_VALUES: { X:8, Q:10, Z:10 },
    RACK_SIZE: 3, PLAYS_PER_ROUND: 2, DISCARDS_PER_ROUND: 2, MIN_WORD_LEN: 3,
    LENGTH_BONUS_PER_LETTER: 0, ROUND_TARGETS: [50],
  };
  const r = simulateRun({ config, dictionary: dictCat, words: wordsCat, seed: 1 });
  assert.equal(r.won, false);
  assert.equal(r.hitCap, false);       // terminated via dead-hand / exhaustion, not the cap
});

// ── v2 purchase policy tests ───────────────────────────────────────────────

test('pickTargetOffer prefers an affordable un-owned target relic, respecting reserve', () => {
  const run = {
    coins: 10, relics: [],
    shop: { offers: [
      { type: 'buyLetter', letter: 'E', cost: 3 },
      { type: 'buyRelic', relicId: 'rareHoarder', cost: 6 },
      { type: 'hone', archetypeId: 'rareLetter', cost: 6 },
    ] },
  };
  const off = pickTargetOffer(run, { targetRelicIds: ['rareHoarder'], targetHoneId: 'rareLetter', reserve: 0 });
  assert.equal(off.type, 'buyRelic');
  assert.equal(off.relicId, 'rareHoarder');
});

test('pickTargetOffer skips an already-owned relic and falls back to the target hone', () => {
  const run = {
    coins: 10, relics: [{ id: 'rareHoarder' }],
    shop: { offers: [
      { type: 'buyRelic', relicId: 'rareHoarder', cost: 6 },
      { type: 'hone', archetypeId: 'rareLetter', cost: 6 },
    ] },
  };
  const off = pickTargetOffer(run, { targetRelicIds: ['rareHoarder'], targetHoneId: 'rareLetter', reserve: 0 });
  assert.equal(off.type, 'hone');
});

test('pickTargetOffer returns null when nothing affordable stays above reserve', () => {
  const run = { coins: 8, relics: [], shop: { offers: [{ type: 'buyRelic', relicId: 'rareHoarder', cost: 6 }] } };
  assert.equal(pickTargetOffer(run, { targetRelicIds: ['rareHoarder'], reserve: 5 }), null); // 8-6=2 < 5
});

test('buildPurchasePolicy spends toward the target on a real run (buys and/or rerolls)', () => {
  resetTileIds();
  const run = newRun({ config: configShop, dictionary: dictCat, seed: 7 });
  run.coins = 999;
  buildPurchasePolicy({ targetRelicIds: ['vowelBonus'], targetHoneId: 'vowelHeavy', maxRerolls: 5 })(run);
  assert.ok(run.coins < 999, 'policy spent coins (bought and/or rerolled)');
  assert.equal(run.shop, null, 'shop cleared after the turn');
});

// ── v2: simulateRun shop loop + dead-rack counter ─────────────────────────────

// configBeatable: a 3-round CAT-only run where round 1 is trivially clearable (earning shop coins),
// but round 2+ requires shortAndSweet (×3 Mult on ≤3-letter words) to reach target 12.
// RACK_SIZE=9 + 18-tile bag (6×CAT) guarantees every rack holds at least one C, one A, one T.
// Without the relic: CAT=5/play, 2 plays → 10 < 12 → loses at round 2 (roundReached=2).
// With the relic:    CAT=15/play, 1 play → 15 ≥ 12 → clears rounds 2 and 3 (roundReached=3, won).
const configBeatable = {
  STARTING_BAG: ['C','A','T','C','A','T','C','A','T','C','A','T','C','A','T','C','A','T'], // 6×CAT
  TILE_VALUES: { C:3, A:1, T:1 },
  RACK_SIZE: 9, PLAYS_PER_ROUND: 2, DISCARDS_PER_ROUND: 0, MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 0,
  ROUND_TARGETS: [4, 12, 12],
  // Generous clear bonus so policy can afford buyRelic (cost 8) after clearing round 1.
  COINS_ON_CLEAR: { base: 10, perUnusedPlay: 1, perUnusedDiscard: 0 },
  INTEREST: { enabled: false },
  SHOP: {
    // offersPerShop: 99 guarantees the relic appears (slice is bounded by candidates.length).
    offersPerShop: 99, rerollCost: 1,
    cost: { buyLetter: 3, buyEnchantedTile: 7, enchantTile: 6, upgradeLetter: 5, thinLetter: 3, buyRelic: 8 },
    upgradePlus: 1, buyableLetters: ['E'],
  },
  HONE: { cost: 6 },
};

// configB / dictB / wordsB: target > one-CAT score (5) so the first play doesn't instantly clear,
// ensuring at least one mid-round rack sample (racksSeen >= 1 is testable).
const configB = {
  STARTING_BAG: ['C','A','T','C','A','T','C','A','T'], TILE_VALUES: { C:3, A:1, T:1 },
  RACK_SIZE: 3, PLAYS_PER_ROUND: 3, DISCARDS_PER_ROUND: 0, MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 0, ROUND_TARGETS: [8],   // CAT=5 < 8; two plays: 5+5=10 ≥ 8 → one mid-round sample
};
const dictB = dictCat;
const wordsB = wordsCat;

test('simulateRun with a purchase policy acquires the target relic and out-progresses no-shop', () => {
  // seed=1 is verified to give an initial rack of [A,T,C] → CAT is playable every draw.
  // pool restricted to shortAndSweet so generateShop always includes it; policy buys it after round 1.
  const noShopRes = simulateRun({ config: configBeatable, dictionary: dictCat, words: wordsCat, seed: 1 });
  const policy = buildPurchasePolicy({ targetRelicIds: ['shortAndSweet'], maxRerolls: 5, pool: { relicIds: ['shortAndSweet'] } });
  const buyRes = simulateRun({ config: configBeatable, dictionary: dictCat, words: wordsCat, seed: 1, policy });
  // Without relic: 5+5=10 < 12, loses at round 2 → roundReached=2. With relic: 15≥12, wins all → roundReached=3.
  assert.ok(buyRes.roundReached > noShopRes.roundReached, 'shopping out-progresses no-shop (strict)');
  assert.equal(buyRes.won, true, 'buy persona wins the run');
  assert.equal(noShopRes.won, false, 'no-shop persona loses');
});

test('simulateRun reports dead-rack count and racks seen', () => {
  const r = simulateRun({ config: configB, dictionary: dictB, words: wordsB, seed: 1 });
  assert.equal(typeof r.deadRacks, 'number');
  assert.equal(typeof r.racksSeen, 'number');
  assert.ok(r.racksSeen >= 1);
});

test('owned-relic dedup holds through the real purchase() call (no duplicate relics)', () => {
  // Probe: give a run the relic already, then call the policy repeatedly — purchase() must skip it.
  resetTileIds();
  const run = newRun({ config: configBeatable, dictionary: dictCat, seed: 5 });
  run.coins = 999;
  const policy = buildPurchasePolicy({ targetRelicIds: ['shortAndSweet'], maxRerolls: 10, pool: { relicIds: ['shortAndSweet'] } });
  // Call policy twice (simulating two shop turns) to stress the dedup path.
  policy(run);
  policy(run);
  const count = run.relics.filter(r => r.id === 'shortAndSweet').length;
  assert.ok(count <= 1, `shortAndSweet must not be duplicated — found ${count} copies`);
});

// ── v2: pure aggregation helpers ───────────────────────────────────────────

import { percentile, summarizePersona } from '../src/sim.js';

test('percentile returns boundaries and the median', () => {
  const v = [10, 20, 30, 40, 50];
  assert.equal(percentile(v, 50), 30);
  assert.equal(percentile(v, 0), 10);
  assert.equal(percentile(v, 100), 50);
  assert.equal(percentile([], 50), 0);
});

test('summarizePersona aggregates win-rate, round percentiles, and dead-rack rate', () => {
  const results = [
    { won: true,  roundReached: 8, deadRacks: 0, racksSeen: 10 },
    { won: false, roundReached: 4, deadRacks: 1, racksSeen: 9 },
    { won: false, roundReached: 6, deadRacks: 0, racksSeen: 11 },
  ];
  const s = summarizePersona(results);
  assert.equal(s.n, 3);
  assert.equal(Number(s.winRate.toFixed(3)), 0.333);
  assert.equal(s.roundReached.p50, 6);
  assert.equal(Number(s.deadRackRate.toFixed(4)), Number((1 / 30).toFixed(4))); // 1 dead / 30 racks
});
