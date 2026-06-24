// test/sim.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { legalWords, bestPlay, scoreFor } from '../src/sim.js';
import { makeTile, resetTileIds } from '../src/tiles.js';
import { greedyAgent, randomAgent } from '../src/agents.js';
import { randomPlay } from '../src/sim.js';
import { RELICS } from '../src/relics.js';

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
  // seed=3: rack always holds C,A,T (CAT playable every draw); boss at Sentence=Ceiling (caps mult at 4,
  // harmless since shortAndSweet is ×3 → still 15 pts; no-score warp like Toll avoided).
  // pool restricted to shortAndSweet so generateShop always includes it; policy buys it after round 1.
  const noShopRes = simulateRun({ config: configBeatable, dictionary: dictCat, words: wordsCat, seed: 3 });
  const policy = buildPurchasePolicy({ targetRelicIds: ['shortAndSweet'], maxRerolls: 5, pool: { relicIds: ['shortAndSweet'] } });
  const buyRes = simulateRun({ config: configBeatable, dictionary: dictCat, words: wordsCat, seed: 3, policy });
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

// ── v2: PERSONAS + runPersona ─────────────────────────────────────────────────

import { PERSONAS, runPersona } from '../src/sim.js';

// configPersona: tiny beatable config — CAT bag, target 3 (trivially clearable in 1 play of CAT=5).
// One round so run completes quickly over multiple seeds.
const configPersona = {
  STARTING_BAG: ['C','A','T','C','A','T','C','A','T','C','A','T','C','A','T','C','A','T'],
  TILE_VALUES: { C:3, A:1, T:1 },
  RACK_SIZE: 9, PLAYS_PER_ROUND: 2, DISCARDS_PER_ROUND: 0, MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 0,
  ROUND_TARGETS: [3],
  COINS_ON_CLEAR: { base: 4, perUnusedPlay: 1, perUnusedDiscard: 0 },
  INTEREST: { enabled: false },
  SHOP: {
    offersPerShop: 4, rerollCost: 1,
    cost: { buyLetter: 3, buyEnchantedTile: 7, enchantTile: 6, upgradeLetter: 5, thinLetter: 3, buyRelic: 8 },
    upgradePlus: 1, buyableLetters: ['E'],
  },
  HONE: { cost: 6 },
  DECKS: {
    standard: { id: 'standard', name: 'Standard', startingBag: null },
  },
};

// personaShortWord removed — was unused dead code.

test('PERSONAS is an array of 6 archetype descriptors with required shape', () => {
  assert.ok(Array.isArray(PERSONAS));
  assert.equal(PERSONAS.length, 6);
  for (const p of PERSONAS) {
    assert.ok(typeof p.id === 'string', `persona ${p.id} missing id`);
    assert.ok(typeof p.name === 'string', `persona ${p.id} missing name`);
    assert.ok(typeof p.bagId === 'string', `persona ${p.id} missing bagId`);
    assert.ok(Array.isArray(p.targetRelicIds), `persona ${p.id} targetRelicIds must be array`);
    assert.ok(typeof p.targetHoneId === 'string', `persona ${p.id} missing targetHoneId`);
  }
});

test('PERSONAS contains the 6 expected archetype ids', () => {
  const ids = PERSONAS.map(p => p.id).sort();
  assert.deepEqual(ids, ['doubled', 'escalation', 'longWord', 'rareLetter', 'shortWord', 'vowelHeavy']);
});

test('runPersona returns a summary with n === seeds.length, numeric winRate, and roundReached.p50', () => {
  // Use a tiny config + a persona whose bagId maps to STARTING_BAG via the standard fallback.
  // Provide a persona with bagId 'lean' — configPersona.DECKS doesn't have 'lean',
  // so we use a persona with bagId 'standard' for simplicity.
  const persona = { id: 'shortWord', name: 'Short Word', bagId: 'standard', targetRelicIds: ['shortAndSweet'], targetHoneId: 'shortWord' };
  const seeds = [1, 2, 3];
  const summary = runPersona({
    config: configPersona, dictionary: dictCat, words: wordsCat,
    persona, seeds,
    pool: { relicIds: ['shortAndSweet'] },
  });
  assert.equal(summary.n, seeds.length, 'n equals number of seeds');
  assert.equal(typeof summary.winRate, 'number', 'winRate is a number');
  assert.ok(summary.winRate >= 0 && summary.winRate <= 1, 'winRate in [0,1]');
  assert.ok(typeof summary.roundReached.p50 === 'number', 'roundReached.p50 is present and numeric');
});

test('runPersona resolves a real non-standard deck (rareRich) and returns a valid summary', () => {
  // configRareRich has DECKS.rareRich with a distinctive bag (only X, Q, Z — can't form CAT).
  // This proves runPersona used the rareRich bag, not the standard bag: no CAT can be formed,
  // so every seed loses quickly (runPersona still returns a valid summary with n === seeds.length).
  const configRareRich = {
    ...configPersona,
    DECKS: {
      standard: { id: 'standard', name: 'Standard', startingBag: null },
      rareRich: { id: 'rareRich', name: 'Rare Rich', startingBag: ['X','Q','Z','X','Q','Z','X','Q','Z'] },
    },
  };
  const persona = { id: 'rareLetter', name: 'Rare Letter', bagId: 'rareRich', targetRelicIds: ['rareHoarder'], targetHoneId: 'rareLetter' };
  const seeds = [1, 2, 3];
  const summary = runPersona({
    config: configRareRich, dictionary: dictCat, words: wordsCat,
    persona, seeds,
  });
  assert.equal(summary.n, seeds.length, 'n equals number of seeds');
  // rareRich bag has only X/Q/Z — no word in wordsCat (["CAT"]) is formable → always loses
  assert.equal(summary.winRate, 0, 'rareRich bag cannot form CAT → all seeds lose');
});

test('runPersona throws for an unknown non-standard bagId', () => {
  const persona = { id: 'ghost', name: 'Ghost', bagId: 'nope', targetRelicIds: [], targetHoneId: 'ghost' };
  assert.throws(
    () => runPersona({ config: configPersona, dictionary: dictCat, words: wordsCat, persona, seeds: [1] }),
    /unknown or empty deck 'nope'/,
    'should throw with a descriptive error for an unrecognised bagId',
  );
});

// ── smartDiscard + dumpAllDiscard policy tests ────────────────────────────────

import { smartDiscard, dumpAllDiscard } from '../src/sim.js';

test('smartDiscard returns the rarest half (floor(n/2)) of the hand, never the whole hand', () => {
  resetTileIds();
  // rack: A(1), E(1), R(1), Q(10), Z(10), X(8) — n=6, floor(6/2)=3 dropped
  const A = makeTile('A'), E = makeTile('E'), R = makeTile('R');
  const Q = makeTile('Q'), Z = makeTile('Z'), X = makeTile('X');
  const run = {
    rack: [A, E, R, Q, Z, X],
    tileValues: { A: 1, E: 1, R: 1, Q: 10, Z: 10, X: 8 },
  };
  const sel = smartDiscard(run);
  assert.equal(sel.length, 3, 'drops exactly floor(6/2)=3 tiles');
  // Must drop the 3 highest-value tiles: Q(10), Z(10), X(8)
  const droppedLetters = sel.map(s => s.letter).sort();
  assert.deepEqual(droppedLetters, ['Q', 'X', 'Z'], 'drops Q, X, Z (rarest)');
  // Each entry has the correct shape
  for (const s of sel) {
    assert.ok(s.tile && s.letter, 'each selection entry has {tile, letter}');
    assert.equal(s.tile.letter, s.letter, 'tile.letter matches letter');
  }
});

test('smartDiscard never returns the whole hand for n >= 2', () => {
  resetTileIds();
  const Q = makeTile('Q'), Z = makeTile('Z');
  const run = {
    rack: [Q, Z],
    tileValues: { Q: 10, Z: 10 },
  };
  const sel = smartDiscard(run);
  assert.equal(sel.length, 1, 'for n=2, drops exactly 1 (floor(2/2)=1)');
  assert.ok(sel.length < 2, 'never dumps whole hand for n=2');
});

test('smartDiscard returns at least 1 tile for n=1', () => {
  resetTileIds();
  const Q = makeTile('Q');
  const run = { rack: [Q], tileValues: { Q: 10 } };
  const sel = smartDiscard(run);
  assert.equal(sel.length, 1, 'Math.max(1,...) ensures at least 1 for n=1');
});

test('dumpAllDiscard returns the entire rack', () => {
  resetTileIds();
  const A = makeTile('A'), B = makeTile('B'), C = makeTile('C');
  const run = { rack: [A, B, C], tileValues: {} };
  const sel = dumpAllDiscard(run);
  assert.equal(sel.length, 3, 'dumpAllDiscard returns all 3 tiles');
  const ids = sel.map(s => s.tile.id).sort();
  assert.deepEqual(ids, [A, B, C].map(t => t.id).sort());
});

test('simulateRun accepts discardPolicy and uses dumpAllDiscard to discard whole hand on dead rack', () => {
  // rack of X,Q,Z only — no word is ever playable; with 2 discards, dumpAllDiscard fires each time
  const config = {
    STARTING_BAG: ['X','Q','Z','X','Q','Z'], TILE_VALUES: { X:8, Q:10, Z:10 },
    RACK_SIZE: 3, PLAYS_PER_ROUND: 2, DISCARDS_PER_ROUND: 2, MIN_WORD_LEN: 3,
    LENGTH_BONUS_PER_LETTER: 0, ROUND_TARGETS: [50],
  };
  // Track discard calls to verify the policy was invoked
  let dumpAllCalls = 0;
  const spyDumpAll = (run) => { dumpAllCalls++; return dumpAllDiscard(run); };
  const r = simulateRun({ config, dictionary: dictCat, words: wordsCat, seed: 1, discardPolicy: spyDumpAll });
  assert.equal(r.won, false, 'unplayable config loses');
  assert.ok(dumpAllCalls > 0, 'dumpAll discard policy was invoked on dead rack');
  assert.equal(r.hitCap, false, 'terminates without hitting cap');
});

test('simulateRun defaults to smartDiscard (partial discard on dead rack, not full dump)', () => {
  // rack of X,Q,Z only — no word playable; with smartDiscard, only half is discarded each time
  const config = {
    STARTING_BAG: ['X','Q','Z','X','Q','Z','X','Q','Z'], TILE_VALUES: { X:8, Q:10, Z:10 },
    RACK_SIZE: 3, PLAYS_PER_ROUND: 2, DISCARDS_PER_ROUND: 3, MIN_WORD_LEN: 3,
    LENGTH_BONUS_PER_LETTER: 0, ROUND_TARGETS: [50],
  };
  let smartCalls = 0;
  const spySmart = (run) => { smartCalls++; return smartDiscard(run); };
  simulateRun({ config, dictionary: dictCat, words: wordsCat, seed: 1, discardPolicy: spySmart });
  assert.ok(smartCalls > 0, 'smart discard policy was invoked on dead rack');
});

// ── Task 5: persona snowball relic guard ──────────────────────────────────────

const SNOWBALL_BY_ARCH = {
  shortWord: 'flywheel', longWord: 'juggernaut', rareLetter: 'rareAvalanche',
  doubled: 'resonanceEngine', vowelHeavy: 'risingTide', escalation: 'perpetualEngine',
};

test('each persona targets its archetype snowball relic', () => {
  for (const p of PERSONAS) {
    const want = SNOWBALL_BY_ARCH[p.id];
    assert.ok(p.targetRelicIds.includes(want), `${p.name} (id=${p.id}) should target ${want}`);
  }
});

test('randomPlay returns a legal play the rack can form (or null), with the bestPlay shape', () => {
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  const p = randomPlay(run, wordsB); // consumes one run.rng draw to index the legal-word list
  assert.ok(p === null || (p.selection && p.word));
});

test('simulateRun with an explicit greedy agent matches the default (no agent) run', () => {
  const a = simulateRun({ config: configB, dictionary: dictB, words: wordsB, seed: 5 });
  const b = simulateRun({ config: configB, dictionary: dictB, words: wordsB, seed: 5, agent: greedyAgent() });
  assert.equal(a.roundReached, b.roundReached);
  assert.equal(a.won, b.won);
});

// ── Task 4: boss-aware, relicState-aware scoreFor ─────────────────────────────

test('scoreFor ranks a snowball word using its current stacks', () => {
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  const sel = bestPlay(run, wordsB).selection; // CAT (rack always holds C,A,T)
  run.relics = [RELICS.perpetualEngine]; // timesMult per stack, condition always true
  run.relicState = { perpetualEngine: { stacks: 0 } };
  const base = scoreFor(run, sel).score;
  run.relicState = { perpetualEngine: { stacks: 5 } };
  const boosted = scoreFor(run, sel).score;
  assert.ok(boosted > base, 'more stacks => higher score');
});

test('scoreFor applies the boss warp (mute zeroes vowels in ranking)', () => {
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  const sel = bestPlay(run, wordsB).selection; // CAT contains the vowel A
  run.boss = null;
  const normal = scoreFor(run, sel).score;
  run.boss = 'mute';
  const muted = scoreFor(run, sel).score;
  assert.ok(muted <= normal, 'mute (vowels score 0) cannot raise the score');
});

// ── Task 7: clear-margin / decision-gap / purchase-log diagnostics ────────────

test('simulateRun records clear margins, decision gaps, a purchase log, and final stacks', () => {
  const r = simulateRun({ config: configB, dictionary: dictB, words: wordsB, seed: 1 });
  assert.ok(Array.isArray(r.clearMargins));
  assert.ok(Array.isArray(r.decisionGaps));
  assert.ok(Array.isArray(r.purchaseLog));
  assert.equal(typeof r.finalStacks, 'number');
});

test('summarizePersona aggregates margin + gap percentiles and exposes per-seed win flags', () => {
  const results = [
    { won: true,  roundReached: 8, deadRacks: 0, racksSeen: 10, clearMargins: [5, 3], decisionGaps: [0.7, 0.2], purchaseLog: [], finalStacks: 4 },
    { won: false, roundReached: 4, deadRacks: 1, racksSeen: 9,  clearMargins: [-12], decisionGaps: [0.9], purchaseLog: [], finalStacks: 0 },
  ];
  const s = summarizePersona(results);
  assert.deepEqual(s.wonFlags, [true, false]);
  assert.ok('clearMargin' in s && 'p50' in s.clearMargin);
  assert.ok('decisionGap' in s && 'p50' in s.decisionGap);
});

// ── Task 8: runPersona accepts a play-policy factory (agentFor) ───────────────

test('runPersona accepts an agentFor and reports per-seed win flags', () => {
  const persona = { id: 'shortWord', name: 'Short', bagId: 'standard', targetRelicIds: [], targetHoneId: 'shortWord' };
  const seeds = [1, 2, 3];
  let callCount = 0;
  const agentFor = (shop) => { callCount++; return randomAgent(shop); };
  const s = runPersona({ config: configB, dictionary: dictB, words: wordsB, persona, seeds, agentFor });
  assert.equal(s.wonFlags.length, 3);
  assert.equal(typeof s.winRate, 'number');
  assert.equal(callCount, 1, 'agentFor must be called exactly once per runPersona call (not per seed)');
});
