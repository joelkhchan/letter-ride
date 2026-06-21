// test/scoring.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { scoreWord } from '../src/scoring.js';
import { makeTile, WILD, resetTileIds } from '../src/tiles.js';

const tileValues = { C:3, A:1, T:1, E:1, I:1 };
const sel = (...pairs) => pairs.map(([tile, letter]) => ({ tile, letter }));

test('Tier 0: wit = letter values + length bonus, mult 1', () => {
  resetTileIds();
  const cat = sel([makeTile('C'),'C'], [makeTile('A'),'A'], [makeTile('T'),'T']);
  assert.deepEqual(scoreWord(cat, { tileValues, lengthBonusPerLetter: 5 }), { wit: 5, mult: 1, points: 5 });
});

test('length bonus applies beyond 3 letters', () => {
  resetTileIds();
  const cate = sel([makeTile('C'),'C'], [makeTile('A'),'A'], [makeTile('T'),'T'], [makeTile('E'),'E']);
  const r = scoreWord(cate, { tileValues, lengthBonusPerLetter: 5 });   // 3+1+1+1=6 wit + (4-3)*5=5 → 11
  assert.equal(r.wit, 11);
  assert.equal(r.points, 11);
});

test('wild contributes 0 base wit but its resolved letter counts for length', () => {
  resetTileIds();
  const s = sel([makeTile('C'),'C'], [makeTile(WILD),'A'], [makeTile('T'),'T']);
  // 3 + 0 + 1 = 4 wit, len 3 → +0
  assert.equal(scoreWord(s, { tileValues, lengthBonusPerLetter: 5 }).wit, 4);
});

test('phase order is enforced regardless of relic array order', () => {
  resetTileIds();
  const cat = sel([makeTile('C'),'C'], [makeTile('A'),'A'], [makeTile('T'),'T']);   // 5 wit
  const addMult = { id: 'm', evaluate: () => ({ addMult: 2 }) };
  const timesMult = { id: 'x', evaluate: () => ({ timesMult: 3 }) };
  const a = scoreWord(cat, { tileValues, lengthBonusPerLetter: 0, relics: [addMult, timesMult] });
  const b = scoreWord(cat, { tileValues, lengthBonusPerLetter: 0, relics: [timesMult, addMult] });
  assert.equal(a.points, 45);   // 5 × ((1+2) × 3)
  assert.equal(b.points, 45);   // identical regardless of order
});
