// test/run.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { newRun, playWord, discard, nextRound, awardCoins } from '../src/run.js';
import { honeModifiers } from '../src/archetypes.js';
import { makeDictionary } from '../src/dictionary.js';
import { makeTile, resetTileIds } from '../src/tiles.js';

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
