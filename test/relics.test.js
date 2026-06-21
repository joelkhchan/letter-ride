import { test } from 'node:test';
import assert from 'node:assert';
import { scoreWord } from '../src/scoring.js';
import { RELICS } from '../src/relics.js';
import { makeTile, resetTileIds } from '../src/tiles.js';

const tv = { C:3, A:1, T:1, E:1, I:1, O:1, U:1, S:1, L:1, B:3, Q:10, Y:4, N:1 };
const sel = (word) => [...word].map(ch => ({ tile: makeTile(ch), letter: ch }));
const base = (word, opts = {}) => scoreWord(sel(word), { tileValues: tv, lengthBonusPerLetter: 0, ...opts });

test('vowelBonus: +2 Wit per vowel', () => {
  resetTileIds();
  const b = base('CAT');                                   // 1 vowel (A)
  const r = base('CAT', { relics: [RELICS.vowelBonus] });
  assert.equal(r.wit - b.wit, 2);
});
test('rareHoarder: +30 Wit if word uses J/Q/X/Z', () => {
  resetTileIds();
  assert.equal(base('QI', { relics: [RELICS.rareHoarder] }).wit - base('QI').wit, 30);
  assert.equal(base('CAT', { relics: [RELICS.rareHoarder] }).wit - base('CAT').wit, 0);
});
test('shortAndSweet: ×3 Mult for words <= 3 letters only', () => {
  resetTileIds();
  assert.equal(base('CAT', { relics: [RELICS.shortAndSweet] }).mult, 3);
  assert.equal(base('CATS', { relics: [RELICS.shortAndSweet] }).mult, 1);
});
test('lengthy: +1 Mult per letter beyond 4', () => {
  resetTileIds();
  assert.equal(base('CASTLE', { relics: [RELICS.lengthy] }).mult, 1 + 2);  // 6 letters -> +2
  assert.equal(base('CAT', { relics: [RELICS.lengthy] }).mult, 1);
});
test('doubleTrouble: +40 Wit if a doubled letter', () => {
  resetTileIds();
  assert.equal(base('BALL', { relics: [RELICS.doubleTrouble] }).wit - base('BALL').wit, 40);
  assert.equal(base('CAT', { relics: [RELICS.doubleTrouble] }).wit - base('CAT').wit, 0);
});
test('freshStart: +2 Mult if first letter is a vowel', () => {
  resetTileIds();
  assert.equal(base('ICE', { relics: [RELICS.freshStart] }).mult, 1 + 2);
  assert.equal(base('CAT', { relics: [RELICS.freshStart] }).mult, 1);
});
test('comboCounter: +1 Mult per word already played this round', () => {
  resetTileIds();
  const r = scoreWord(sel('CAT'), { tileValues: tv, lengthBonusPerLetter: 0, relics: [RELICS.comboCounter], context: { wordsPlayedThisRound: 2 } });
  assert.equal(r.mult, 1 + 2);
});
test('recycler is an economy relic: no evaluate, has coinsOnRoundClear', () => {
  assert.equal(typeof RELICS.recycler.evaluate, 'undefined');
  assert.equal(RELICS.recycler.coinsOnRoundClear({ playsLeft: 3 }), 6);   // +2 per unused play
});
