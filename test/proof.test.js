import { test } from 'node:test';
import assert from 'node:assert';
import { scoreGuess, isSolved, proofCoins, pickTarget } from '../src/proof.js';

test('scoreGuess: all hits when guess equals target', () => {
  assert.deepEqual(scoreGuess('roast', 'roast'), ['hit', 'hit', 'hit', 'hit', 'hit']);
  assert.equal(isSolved(scoreGuess('roast', 'roast')), true);
});

test('scoreGuess: present vs miss for non-aligned letters', () => {
  // target STARE, guess RATES: R present, A present, T present, E present, S present (all wrong spots)
  assert.deepEqual(scoreGuess('rates', 'stare'), ['present', 'present', 'present', 'present', 'present']);
  assert.equal(isSolved(scoreGuess('rates', 'stare')), false);
});

test('scoreGuess: duplicate letters in the guess only score as many as the target holds', () => {
  // target ABBEY (one A, two B, one E, one Y); guess BABES
  //   B(0): target[0]=A no-hit; A(1): no-hit; B(2)=B hit; E(3)=E hit; S(4) miss
  //   pass2: B(0) -> present (one B left), A(1) -> present, S(4) -> miss
  assert.deepEqual(scoreGuess('babes', 'abbey'), ['present', 'present', 'hit', 'hit', 'miss']);
});

test('scoreGuess: a guessed letter beyond the target count is a miss, not present', () => {
  // target EERIE has three E's; guess GEESE: positions of E that exceed availability after hits -> miss
  const r = scoreGuess('geese', 'eerie');
  // g miss; e(1)=e hit; e(2)=r no -> present; s miss; e(4)=e hit
  assert.deepEqual(r, ['miss', 'hit', 'present', 'miss', 'hit']);
});

test('proofCoins scales with guesses saved (fewer guesses = more $)', () => {
  const cfg = { maxGuesses: 6, coinsBase: 3, coinsPerGuessSaved: 3 };
  assert.equal(proofCoins(1, cfg), 3 + 3 * 5);   // solved in 1 -> 18
  assert.equal(proofCoins(6, cfg), 3 + 3 * 0);   // solved on the last guess -> 3
});

test('pickTarget is deterministic for a given RNG and stays in the pool', () => {
  const pool = ['roast', 'ninja', 'widow'];
  let calls = 0;
  const rng = () => [0.0, 0.5, 0.99][calls++];   // -> indices 0,1,2
  assert.equal(pickTarget(pool, rng), 'roast');
  assert.equal(pickTarget(pool, rng), 'ninja');
  assert.equal(pickTarget(pool, rng), 'widow');
  assert.equal(pickTarget([], () => 0), null);
});
