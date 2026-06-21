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
