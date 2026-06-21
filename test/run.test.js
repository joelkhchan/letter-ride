// test/run.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { newRun, playWord, nextRound } from '../src/run.js';
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
