// test/run.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { newRun, playWord, discard, nextRound, awardCoins } from '../src/run.js';
import { honeModifiers } from '../src/archetypes.js';
import { makeDictionary } from '../src/dictionary.js';
import { makeTile, resetTileIds } from '../src/tiles.js';
import { RELICS } from '../src/relics.js';

const dict = makeDictionary(['cat']);
const config = {
  STARTING_BAG: ['C','A','T'], TILE_VALUES: { C:3, A:1, T:1 },
  RACK_SIZE: 3, PLAYS_PER_ROUND: 2, DISCARDS_PER_ROUND: 1, MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 5, ROUND_TARGETS: [5, 100],
};
// Build a CAT selection and SEAT its tiles in run.rack so the legality guard passes.
const seatCat = (run) => {
  const s = [['C','C'],['A','A'],['T','T']].map(([letter, l]) => ({ tile: makeTile(letter), letter: l }));
  run.rack = s.map(x => x.tile);
  return s;
};

test('a word meeting target clears the round', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  const res = playWord(run, seatCat(run));    // CAT = 5 >= target 5
  assert.equal(res.ok, true);
  assert.equal(res.run.roundTotal, 5);
  assert.equal(res.run.status, 'roundCleared');
  assert.equal(res.run.wordsPlayedThisRound, 1);
});

test('running out of plays under target loses', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.target = 100; run.playsLeft = 1;
  const res = playWord(run, seatCat(run));     // 5 < 100, plays now 0
  assert.equal(res.run.status, 'lost');
});

test('an illegal selection (tile not in rack) is rejected without consuming a play', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  seatCat(run);
  const outsiders = [['C','C'],['A','A'],['T','T']].map(([letter, l]) => ({ tile: makeTile(letter), letter: l })); // fresh tiles, not in rack
  const before = run.playsLeft;
  const res = playWord(run, outsiders);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'illegal');
  assert.equal(run.playsLeft, before);         // no play consumed
});

test('clearing the last round wins', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.roundIndex = 1; run.status = 'roundCleared';
  assert.equal(nextRound(run).status, 'won');
});

test('clearing a round awards coins: base + unused plays + unused discards', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  // config: PLAYS_PER_ROUND 2, DISCARDS_PER_ROUND 1, ROUND_TARGETS [5,100]; COINS_ON_CLEAR needed
  run.config = { ...config, COINS_ON_CLEAR: { base: 4, perUnusedPlay: 1, perUnusedDiscard: 1 } };
  const res = playWord(run, seatCat(run));        // CAT=5 clears target 5; playsLeft 2->1, discards 1
  assert.equal(res.run.status, 'roundCleared');
  assert.equal(res.run.coins, 4 + 1 + 1);         // base 4 + 1 unused play + 1 unused discard = 6
});

test('an economy relic with coinsOnRoundClear adds to the award', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.config = { ...config, COINS_ON_CLEAR: { base: 4, perUnusedPlay: 1, perUnusedDiscard: 1 } };
  run.relics = [{ id: 'recyclerTest', coinsOnRoundClear: (r) => 2 * r.playsLeft }];
  const res = playWord(run, seatCat(run));        // playsLeft after play = 1 -> +2 coins
  assert.equal(res.run.coins, 6 + 2);             // base award 6 + relic 2*1 = 8
});

test('awardCoins sets run.lastAward with correct line items summing to total', () => {
  resetTileIds();
  const COINS_ON_CLEAR = { base: 4, perUnusedPlay: 1, perUnusedDiscard: 1 };
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.config = { ...config, COINS_ON_CLEAR };
  const res = playWord(run, seatCat(run));  // CAT=5 clears target 5; playsLeft 2->1, discards 1
  assert.equal(res.run.status, 'roundCleared');
  const award = res.run.lastAward;
  assert.ok(Array.isArray(award), 'lastAward should be an array');
  // Should have: round clear, 1 unused play, 1 unused discard
  const labels = award.map(x => x.label);
  assert.ok(labels.includes('Round clear'), 'should include Round clear');
  assert.ok(labels.some(l => l.includes('unused play')), 'should include unused play entry');
  assert.ok(labels.some(l => l.includes('unused discard')), 'should include unused discard entry');
  // Round clear = 4, 1 unused play = 1, 1 unused discard = 1 => total 6
  const sum = award.reduce((s, x) => s + x.amount, 0);
  assert.equal(sum, 6, 'lastAward amounts should sum to 6');
  // sum must equal the coins gained (run starts at 0)
  assert.equal(res.run.coins, sum, 'run.coins must equal sum of lastAward amounts');
});

test('interest: holding $20 with INTEREST{per:5,rate:1,cap:5} earns $4 interest on round clear', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.config = {
    ...config,
    COINS_ON_CLEAR: { base: 4, perUnusedPlay: 1, perUnusedDiscard: 1 },
    INTEREST: { enabled: true, per: 5, rate: 1, cap: 5 },
  };
  run.coins = 20;  // set before round clear so interest is computed on held coins
  const res = playWord(run, seatCat(run));  // CAT=5 clears target 5; playsLeft 2->1, discards 1
  assert.equal(res.run.status, 'roundCleared');
  // interest = min(5, floor(20/5)*1) = min(5,4) = 4
  const award = res.run.lastAward;
  const interestItem = award.find(x => x.label === 'Interest');
  assert.ok(interestItem, 'lastAward should include an Interest line item');
  assert.equal(interestItem.amount, 4, 'Interest should be $4 on $20 held');
  // total = 20 (held) + base 4 + 1 unused play + 1 unused discard + 4 interest = 30
  assert.equal(res.run.coins, 20 + 4 + 1 + 1 + 4, 'run.coins should include held + all earnings + interest');
});

test('interest: INTEREST.enabled=false adds no interest line and no interest coins', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.config = {
    ...config,
    COINS_ON_CLEAR: { base: 4, perUnusedPlay: 1, perUnusedDiscard: 1 },
    INTEREST: { enabled: false, per: 5, rate: 1, cap: 5 },
  };
  run.coins = 20;
  const res = playWord(run, seatCat(run));
  assert.equal(res.run.status, 'roundCleared');
  const award = res.run.lastAward;
  const interestItem = award.find(x => x.label === 'Interest');
  assert.equal(interestItem, undefined, 'Interest line should not appear when disabled');
  // coins = 20 held + base 4 + 1 unused play + 1 unused discard = 26 (no interest)
  assert.equal(res.run.coins, 20 + 4 + 1 + 1, 'run.coins should not include interest when disabled');
});

test('newRun applies a stake (plays delta) and loadout (extra discards, start coins, start relic)', () => {
  resetTileIds();
  const relic = { id: 'startTest', evaluate: () => ({}) };
  const run = newRun({
    config, dictionary: dict, seed: 1,
    stake: { playsDelta: -1, discardsDelta: 0 },
    loadout: { extraDiscards: 1, startCoins: 5, startRelics: [relic] },
  });
  assert.equal(run.playsLeft, config.PLAYS_PER_ROUND - 1);
  assert.equal(run.discardsLeft, config.DISCARDS_PER_ROUND + 1);
  assert.equal(run.coins, 5);
  assert.deepEqual(run.relics.map(r => r.id), ['startTest']);
  // Verify boosts persist on nextRound
  nextRound(run);
  assert.equal(run.playsLeft, config.PLAYS_PER_ROUND - 1);
  assert.equal(run.discardsLeft, config.DISCARDS_PER_ROUND + 1);
});

test('a hone level adds its archetype bonus to a matching word', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.honeLevels = { shortWord: 2 };           // +2 Mult on <=3-letter words
  const res = playWord(run, seatCat(run));     // CAT (3 letters): base 5, mult (1+2)=3 -> 15
  assert.equal(res.scored.score, 15);
});

test('an enabler relic flag reaches scoring context', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.relics = [{ id: 'wc', enabler: 'wildsAreRare' }];
  // a relic that scores +7 only when ctx.enablers includes wildsAreRare (proves flow)
  run.relics.push({ id: 'probe', evaluate: (ctx) => ({ addPoints: ctx.enablers.includes('wildsAreRare') ? 7 : 0 }) });
  const res = playWord(run, seatCat(run));     // CAT base 5 + 7 = 12
  assert.equal(res.scored.points, 12);
});

test('extraPlays is derived from current relics each round (loadout + shop-bought)', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1, loadout: { startRelics: [{ id:'ep', extraPlays: 1, evaluate:()=>({}) }] } });
  assert.equal(run.playsLeft, config.PLAYS_PER_ROUND + 1);          // loadout Overtime active in round 1
  run.relics.push({ id:'ep2', extraPlays: 1, evaluate:()=>({}) });  // simulate a shop-bought Overtime
  nextRound(run);
  assert.equal(run.playsLeft, config.PLAYS_PER_ROUND + 2);          // BOTH apply next round, no double-count
});

// --- Model B fixtures (bag > hand so the draw-pile is observable) ---
const dictB = makeDictionary(['cat', 'tab', 'bat', 'act']);
const configB = {
  STARTING_BAG: ['C','A','T','B','A','T'],          // 6 tiles
  TILE_VALUES: { C:3, A:1, T:1, B:3 },
  RACK_SIZE: 3, PLAYS_PER_ROUND: 4, DISCARDS_PER_ROUND: 2, MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 5, ROUND_TARGETS: [999, 999],   // high so plays don't auto-clear
};

test('newRun deals a full hand; the draw-pile holds the rest of the bag', () => {
  resetTileIds();
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  assert.equal(run.rack.length, 3);
  assert.equal(run.drawPile.length, 3);                       // 6 - 3
  const ids = new Set([...run.rack, ...run.drawPile].map(t => t.id));
  assert.equal(ids.size, 6);                                  // hand ∪ pool = full bag, no dupes
});

test('nextRound rebuilds the draw-pile from the full bag and deals a fresh hand', () => {
  resetTileIds();
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  run.status = 'roundCleared';
  run.drawPile = []; run.rack = [];                           // simulate a depleted round
  nextRound(run);
  assert.equal(run.rack.length, 3);
  assert.equal(run.drawPile.length, 3);                       // pool rebuilt from the 6-tile bag
});

test('playWord consumes the used tiles and refills the hand from the draw-pile', () => {
  resetTileIds();
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  const C = makeTile('C'), A = makeTile('A'), T = makeTile('T');
  const x = makeTile('B'), y = makeTile('A'), z = makeTile('T');
  run.rack = [C, A, T]; run.drawPile = [x, y, z];
  const res = playWord(run, [{tile:C,letter:'C'},{tile:A,letter:'A'},{tile:T,letter:'T'}]); // CAT
  assert.equal(res.ok, true);
  assert.deepEqual(run.rack.map(t => t.id), [x.id, y.id, z.id]);  // C,A,T consumed; refilled from pool
  assert.equal(run.drawPile.length, 0);                          // pool depleted
});

test('unused tiles persist across a play; empty pool just shrinks the hand', () => {
  resetTileIds();
  const run = newRun({ config: { ...configB, RACK_SIZE: 4 }, dictionary: dictB, seed: 1 });
  const C = makeTile('C'), A = makeTile('A'), T = makeTile('T'), B = makeTile('B');
  run.rack = [C, A, T, B]; run.drawPile = [];                     // empty pool → no refill
  playWord(run, [{tile:C,letter:'C'},{tile:A,letter:'A'},{tile:T,letter:'T'}]); // CAT, B unused
  assert.deepEqual(run.rack.map(t => t.id), [B.id]);             // B persists; no refill from empty pool
});

test('discard removes only the selected tiles, refills, and costs one discard', () => {
  resetTileIds();
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  const C = makeTile('C'), A = makeTile('A'), T = makeTile('T');
  const x = makeTile('B'), y = makeTile('A');
  run.rack = [C, A, T]; run.drawPile = [x, y];
  const before = run.discardsLeft;
  discard(run, [{tile:A,letter:'A'}]);                          // drop only A
  assert.equal(run.discardsLeft, before - 1);
  assert.deepEqual(run.rack.map(t => t.id), [C.id, T.id, x.id]); // A gone; C,T kept; refilled with x
  assert.deepEqual(run.drawPile.map(t => t.id), [y.id]);
});

test('discard is a no-op with no discards left or an empty selection', () => {
  resetTileIds();
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  const before = run.rack.map(t => t.id);
  run.discardsLeft = 0;
  discard(run, [{ tile: run.rack[0], letter: run.rack[0].letter }]);
  assert.deepEqual(run.rack.map(t => t.id), before);            // no discards → unchanged
  run.discardsLeft = 1;
  discard(run, []);                                             // empty selection → no spend
  assert.equal(run.discardsLeft, 1);
});

test('a play refilling into an unplayable hand with no discards loses', () => {
  resetTileIds();
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  run.discardsLeft = 0; run.target = 999;                       // don't clear by score
  const C = makeTile('C'), A = makeTile('A'), T = makeTile('T');
  run.rack = [C, A, T]; run.drawPile = [makeTile('X'), makeTile('Q'), makeTile('Z')]; // refill → unplayable
  const res = playWord(run, [{tile:C,letter:'C'},{tile:A,letter:'A'},{tile:T,letter:'T'}]);
  assert.equal(res.run.status, 'lost');                         // XQZ has no legal word, no discards
});

test('an unplayable hand does NOT lose while discards remain', () => {
  resetTileIds();
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  run.discardsLeft = 1; run.target = 999;
  const C = makeTile('C'), A = makeTile('A'), T = makeTile('T');
  run.rack = [C, A, T]; run.drawPile = [makeTile('X'), makeTile('Q'), makeTile('Z')];
  const res = playWord(run, [{tile:C,letter:'C'},{tile:A,letter:'A'},{tile:T,letter:'T'}]);
  assert.equal(res.run.status, 'playing');                      // can still discard out of it
});

test('a hand holding a wild is never dead, even with no discards', () => {
  resetTileIds();
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  run.discardsLeft = 0; run.target = 999;
  const C = makeTile('C'), A = makeTile('A'), T = makeTile('T');
  run.rack = [C, A, T];
  run.drawPile = [makeTile('*'), makeTile('Q'), makeTile('Z')];  // refill → hand holds a wild
  const res = playWord(run, [{tile:C,letter:'C'},{tile:A,letter:'A'},{tile:T,letter:'T'}]);
  assert.equal(res.run.status, 'playing');                      // wild rescues; no false loss
});

// ── Task 1: Snowball infrastructure + Avalanche ──────────────────────────────

const configSnowball = {
  STARTING_BAG: ['J', 'A', 'R', 'A', 'R', 'E', 'E', 'T', 'O'],
  TILE_VALUES: { J: 8, A: 1, R: 1, E: 1, T: 1, O: 1 },
  RACK_SIZE: 9, PLAYS_PER_ROUND: 4, DISCARDS_PER_ROUND: 2, MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 5, ROUND_TARGETS: [999], COINS_ON_CLEAR: null,
};
const dictSnowball = makeDictionary(['jar', 'rat']);

test('newRun initializes relicState; snowball ratchets on a qualifying play', () => {
  resetTileIds();
  const run = newRun({ config: configSnowball, dictionary: dictSnowball, seed: 1 });
  assert.deepEqual(run.relicState, {});
  run.relics.push(RELICS.rareAvalanche);
  // force a known rack so we can play JAR
  run.rack = ['J', 'A', 'R'].map((l, i) => ({ id: 'x' + i, letter: l, mods: [] }));
  const selection = run.rack.map(t => ({ tile: t, letter: t.letter }));
  playWord(run, selection);
  assert.equal(run.relicState.rareAvalanche.stacks, 1); // ratcheted once (JAR has a rare letter)
});

// ── Task 2: Passage/tier derivation helpers ───────────────────────────────────

import { passageOf, tierOf, isBossRound, TIERS } from '../src/run.js';

test('Passage/tier derivation over 12 encounters', () => {
  assert.deepEqual(TIERS, ['Word', 'Phrase', 'Sentence']);
  assert.deepEqual([0,1,2,3,11].map(passageOf), [1,1,1,2,4]);
  assert.deepEqual([0,1,2].map(tierOf), ['Word','Phrase','Sentence']);
  assert.deepEqual([0,1,2,5,11].map(isBossRound), [false,false,true,true,true]);
});

// ── Task 3: Boss selection + warp application ─────────────────────────────────

import { BOSSES } from '../src/bosses.js';

// Use already-imported newRun/playWord/nextRound as aliases (static import at top of file).
const newRunB = newRun;
const playWordB = playWord;
const nextRoundB = nextRound;

const bossCfg = {
  STARTING_BAG: ['A','E','I','O','R','S','T','N','L','D','C','B'],
  TILE_VALUES: { A:1,E:1,I:1,O:1,R:1,S:1,T:1,N:1,L:1,D:2,C:3,B:3 },
  RACK_SIZE: 9, PLAYS_PER_ROUND: 4, DISCARDS_PER_ROUND: 2, MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 5, COINS_ON_CLEAR: null,
  ROUND_TARGETS: [9999,9999,9999, 9999,9999,9999, 9999,9999,9999, 9999,9999,9999],   // never auto-clear
};
const dictBoss = makeDictionary(['rat','rate','oat']);

test('bossOrder is seeded + deterministic + one of each boss', () => {
  const a = newRunB({ config: bossCfg, dictionary: dictBoss, seed: 5 });
  const b = newRunB({ config: bossCfg, dictionary: dictBoss, seed: 5 });
  assert.deepEqual(a.bossOrder, b.bossOrder);
  assert.deepEqual([...a.bossOrder].sort(), ['ceiling','mute','toll','vise']);
  assert.equal(a.boss, null);                 // encounter 0 is a Word, no boss
});

test('The Vise limits discards to 1 on its boss encounter', () => {
  // Force a run whose first Sentence boss is vise: spin nextRound to a Sentence and set bossOrder.
  const run = newRunB({ config: bossCfg, dictionary: dictBoss, seed: 5 });
  run.bossOrder = ['vise','mute','toll','ceiling'];        // passage 1's boss = vise
  nextRoundB(run); nextRoundB(run);                        // advance to roundIndex 2 (Passage 1 Sentence)
  assert.equal(run.boss, 'vise');
  assert.equal(run.discardsLeft, 1);                       // keep:1 applied at encounter setup (not a dead-hand instakill)
});

test('The Toll taxes the played word on its boss encounter', () => {
  const run = newRunB({ config: bossCfg, dictionary: dictBoss, seed: 5 });
  run.bossOrder = ['toll','mute','vise','ceiling'];
  nextRoundB(run); nextRoundB(run);                        // Passage 1 Sentence, boss = toll
  assert.equal(run.boss, 'toll');
  run.rack = ['R','A','T'].map((l,i) => ({ id:'z'+i, letter:l, mods:[] }));
  const sel = run.rack.map(t => ({ tile:t, letter:t.letter }));
  const r = playWordB(run, sel);                           // RAT = 3 points, mult 1 => 3, minus 10 tax => 0 (floored)
  assert.equal(r.scored.score, 0);
});

// ── Task 4: offerNode — seeded node-event offer ───────────────────────────────

import { offerNode } from '../src/run.js';
import { ALL_EVENT_IDS } from '../src/events.js';

const nodeConfig = {
  STARTING_BAG: ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O'],  // 15 tiles (> RACK_SIZE + 3)
  TILE_VALUES: { A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1 },
  RACK_SIZE: 7, PLAYS_PER_ROUND: 3, DISCARDS_PER_ROUND: 1, MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 5, ROUND_TARGETS: [999,999,999,999],
};
const dictNode = makeDictionary(['cat']);

test('newRun initializes nodeEventId to null', () => {
  resetTileIds();
  const run = newRun({ config: nodeConfig, dictionary: dictNode, seed: 42 });
  assert.equal(run.nodeEventId, null);
});

test('offerNode sets nodeEventId to a valid event id', () => {
  resetTileIds();
  const run = newRun({ config: nodeConfig, dictionary: dictNode, seed: 42 });
  offerNode(run);
  assert.ok(ALL_EVENT_IDS.includes(run.nodeEventId), `nodeEventId '${run.nodeEventId}' should be a known event id`);
});

test('offerNode is deterministic: same seed+roundIndex => same offer', () => {
  resetTileIds();
  const runA = newRun({ config: nodeConfig, dictionary: dictNode, seed: 77 });
  const runB = newRun({ config: nodeConfig, dictionary: dictNode, seed: 77 });
  offerNode(runA);
  offerNode(runB);
  assert.equal(runA.nodeEventId, runB.nodeEventId);
});

test('offerNode produces different offers for different seeds', () => {
  resetTileIds();
  const results = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    const run = newRun({ config: nodeConfig, dictionary: dictNode, seed });
    offerNode(run);
    results.add(run.nodeEventId);
  }
  // With 5 events and 20 different seeds, we should see more than 1 distinct result
  assert.ok(results.size > 1, 'offerNode should produce varied results across seeds');
});

test('offerNode respects canOffer: inkMerchant excluded when coins < 5 and is only candidate', () => {
  resetTileIds();
  // inkMerchant canOffer requires coins >= 5 AND relics.length < ALL_RELIC_IDS.length
  // We construct a run where ONLY inkMerchant could have been eligible but coins < 5,
  // so all events with other restrictions are also filtered, and the fallback is a still-eligible event or null.
  // More directly: create a run with coins=0 and verify inkMerchant is never chosen.
  const run = newRun({ config: nodeConfig, dictionary: dictNode, seed: 42 });
  run.coins = 0;  // inkMerchant requires coins >= 5

  // Run offerNode many times (different roundIndex values) to see if inkMerchant ever appears
  let inkMerchantChosen = false;
  for (let i = 0; i < 50; i++) {
    run.roundIndex = i;
    offerNode(run);
    if (run.nodeEventId === 'inkMerchant') inkMerchantChosen = true;
  }
  assert.equal(inkMerchantChosen, false, 'inkMerchant should never be offered when coins < 5');
});

// ── Chain tracking (Task 1 of chain sub-project) ─────────────────────────────

const chainDict = makeDictionary(['cat', 'tan', 'nap', 'dog']);
const seatWord = (run, word) => {
  const s = word.toUpperCase().split('').map(ch => ({ tile: makeTile(ch), letter: ch }));
  run.rack = s.map(x => x.tile);
  return s;
};

test('chaining: chainLength is 1 first word, +1 on a letter-chain continue, resets to 1 on a break', () => {
  resetTileIds();
  const run = newRun({ config: { ...config, STARTING_BAG: ['C','A','T'] }, dictionary: chainDict, seed: 1 });
  run.target = 100000; run.playsLeft = 10;                 // never clear/lose mid-test
  playWord(run, seatWord(run, 'cat'));  assert.equal(run.chainLength, 1);  // first word
  playWord(run, seatWord(run, 'tan'));  assert.equal(run.chainLength, 2);  // CAT->T, TAN starts T
  playWord(run, seatWord(run, 'nap'));  assert.equal(run.chainLength, 3);  // TAN->N, NAP starts N
  playWord(run, seatWord(run, 'dog'));  assert.equal(run.chainLength, 1);  // NAP->P, DOG starts D (break)
  assert.deepEqual(run.lastWord, { lastLetter: 'G' });
});

test('chaining: chainLength + lastWord reset at nextRound', () => {
  resetTileIds();
  const run = newRun({ config: { ...config, STARTING_BAG: ['C','A','T'] }, dictionary: chainDict, seed: 1 });
  run.target = 100000; run.playsLeft = 10;
  playWord(run, seatWord(run, 'cat'));
  assert.equal(run.chainLength, 1);
  nextRound(run);
  assert.equal(run.chainLength, 0);
  assert.equal(run.lastWord, null);
});

test('chaining: chainLength reaches the scoring context (read by a fixture relic)', () => {
  resetTileIds();
  const run = newRun({ config: { ...config, STARTING_BAG: ['C','A','T'] }, dictionary: chainDict, seed: 1 });
  run.target = 100000; run.playsLeft = 10;
  run.relics = [{ id: 'cx', name: 'cx', evaluate: (ctx) => ({ addPoints: (ctx.chainLength || 0) >= 2 ? 100 : 0 }) }];
  const r1 = playWord(run, seatWord(run, 'cat'));   // chainLength 1 -> no bonus
  const r2 = playWord(run, seatWord(run, 'tan'));   // chainLength 2 -> +100
  assert.equal(r1.scored.points < 100, true);
  assert.equal(r2.scored.points >= 100, true);
});

// --- Run-scoped accumulators for achievements (Task 2) ---
test('run tracks totalWordsThisRun and archetypeTally on a play', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.target = 100;                       // unreachable in one CAT, so the round stays open
  playWord(run, seatCat(run));            // CAT, length 3 -> shortWord archetype
  assert.equal(run.totalWordsThisRun, 1);
  assert.equal(run.discardedThisRun, false);
  assert.ok(run.archetypeTally.shortWord >= 1);
});

test('discard sets discardedThisRun', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  const sel = seatCat(run);               // rack now holds C, A, T
  discard(run, [sel[0]]);                 // discard one seated tile
  assert.equal(run.discardedThisRun, true);
});

test('flawlessSoFar flips false on a final-play clear', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.target = 5; run.playsLeft = 1;      // CAT clears exactly, on the last play
  playWord(run, seatCat(run));
  assert.equal(run.status, 'roundCleared');
  assert.equal(run.flawlessSoFar, false);
});
