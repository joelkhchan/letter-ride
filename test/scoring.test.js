// test/scoring.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { scoreWord } from '../src/scoring.js';
import { makeTile, WILD, resetTileIds } from '../src/tiles.js';
import { RELICS } from '../src/relics.js';

const tileValues = { C:3, A:1, T:1, E:1, I:1 };
const sel = (...pairs) => pairs.map(([tile, letter]) => ({ tile, letter }));

test('Tier 0: points = letter values + length bonus, mult 1', () => {
  resetTileIds();
  const cat = sel([makeTile('C'),'C'], [makeTile('A'),'A'], [makeTile('T'),'T']);
  const r = scoreWord(cat, { tileValues, lengthBonusPerLetter: 5 });
  assert.equal(r.points, 5); assert.equal(r.mult, 1); assert.equal(r.score, 5);
});

test('length bonus applies beyond 3 letters', () => {
  resetTileIds();
  const cate = sel([makeTile('C'),'C'], [makeTile('A'),'A'], [makeTile('T'),'T'], [makeTile('E'),'E']);
  const r = scoreWord(cate, { tileValues, lengthBonusPerLetter: 5 });   // 3+1+1+1=6 points + (4-3)*5=5 → 11
  assert.equal(r.points, 11);
  assert.equal(r.score, 11);
});

test('wild contributes 0 base points but its resolved letter counts for length', () => {
  resetTileIds();
  const s = sel([makeTile('C'),'C'], [makeTile(WILD),'A'], [makeTile('T'),'T']);
  // 3 + 0 + 1 = 4 points, len 3 → +0
  assert.equal(scoreWord(s, { tileValues, lengthBonusPerLetter: 5 }).points, 4);
});

test('breakdown: base, pointParts (vowelBonus), timesMultParts (shortAndSweet)', () => {
  resetTileIds();
  const cat = sel([makeTile('C'), 'C'], [makeTile('A'), 'A'], [makeTile('T'), 'T']);
  // vowelBonus: +2 Points per vowel; CAT has 1 vowel (A) → +2 addPoints
  const r1 = scoreWord(cat, { tileValues, lengthBonusPerLetter: 0, relics: [RELICS.vowelBonus] });
  assert.equal(r1.breakdown.base, 5, 'base should be sum of non-wild tile values: C=3 A=1 T=1');
  assert.equal(r1.breakdown.lengthBonus, 0, 'no length bonus with lengthBonusPerLetter=0');
  const vbPart = r1.breakdown.pointParts.find(p => p.label === 'Vowel Bonus');
  assert.ok(vbPart, 'pointParts should contain Vowel Bonus entry');
  assert.equal(vbPart.amount, 2, 'Vowel Bonus adds 2 Points for 1 vowel');
  // shortAndSweet: ×3 Mult for words ≤3 letters; CAT is 3 letters → timesMult: 3
  const r2 = scoreWord(cat, { tileValues, lengthBonusPerLetter: 0, relics: [RELICS.shortAndSweet] });
  const ssPart = r2.breakdown.timesMultParts.find(p => p.label === 'Short & Sweet');
  assert.ok(ssPart, 'timesMultParts should contain Short & Sweet entry');
  assert.equal(ssPart.amount, 3, 'Short & Sweet multiplier is ×3');
});

test('phase order is enforced regardless of relic array order', () => {
  resetTileIds();
  const cat = sel([makeTile('C'),'C'], [makeTile('A'),'A'], [makeTile('T'),'T']);   // 5 wit
  const addMult = { id: 'm', evaluate: () => ({ addMult: 2 }) };
  const timesMult = { id: 'x', evaluate: () => ({ timesMult: 3 }) };
  const a = scoreWord(cat, { tileValues, lengthBonusPerLetter: 0, relics: [addMult, timesMult] });
  const b = scoreWord(cat, { tileValues, lengthBonusPerLetter: 0, relics: [timesMult, addMult] });
  assert.equal(a.score, 45);   // 5 × ((1+2) × 3)
  assert.equal(b.score, 45);   // identical regardless of order
});

// --- Retrigger tests ---

const V = { A: 1, B: 2, Q: 10 };          // tiny fixture tileValues
const selR = (...specs) => specs.map(([letter, mods = []]) => ({ tile: { letter, mods }, letter }));
const opts = (relics = []) => ({ tileValues: V, lengthBonusPerLetter: 1, relics, context: {} });

test('retrigger: a tile-mod {retrigger:1} counts the tile base value twice', () => {
  const r = scoreWord(selR(['A', [{ evaluate: () => ({ retrigger: 1 }) }]], ['B']), opts());
  // base = A*2 + B*1 = 2 + 2 = 4 ; no lengthBonus (len 2 <= 3) ; mult 1
  assert.equal(r.breakdown.base, 4);
  assert.equal(r.points, 4);
  assert.equal(r.score, 4);
});

test('retrigger: a tile prints ALL its mods `times`; a timesMult mod is squared (looped, not scaled)', () => {
  const tileMods = [{ evaluate: () => ({ retrigger: 1 }) }, { evaluate: () => ({ timesMult: 2 }) }];
  const r = scoreWord(selR(['A', tileMods]), opts());
  // base = A*2 = 2 ; timesMult applied twice => 2*2 = 4 ; mult = (1+0)*4 = 4 ; score = 2*4 = 8
  assert.equal(r.breakdown.base, 2);
  assert.equal(r.mult, 4);
  assert.equal(r.score, 8);
});

test('retrigger: relic.retriggerTile fires per matching tile; word-level relic.evaluate fires ONCE', () => {
  const firstTileRelic = {
    name: 'FT',
    retriggerTile: (tile, ctx) => (ctx.selection[0].tile === tile ? 1 : 0),
    evaluate: () => ({ addPoints: 100 }),   // word-level: must count once despite the retrigger
  };
  const r = scoreWord(selR(['A'], ['B']), opts([firstTileRelic]));
  // base = A*2 (first tile retriggered) + B*1 = 2 + 2 = 4 ; relic +100 ONCE ; points = 104
  assert.equal(r.breakdown.base, 4);
  assert.equal(r.points, 104);
});

test('retrigger: length bonus is word-level (counted once, not multiplied)', () => {
  const r = scoreWord(selR(['A', [{ evaluate: () => ({ retrigger: 1 }) }]], ['B'], ['A'], ['B']), opts());
  // len 4 word => lengthBonus = (4-3)*1 = 1 (once) ; base = A*2 + B + A + B = 2+2+1+2 = 7 ; points = 8
  assert.equal(r.breakdown.lengthBonus, 1);
  assert.equal(r.breakdown.base, 7);
  assert.equal(r.points, 8);
});

test('retrigger: phase order holds with mixed addMult + timesMult retriggered', () => {
  const mods = [{ evaluate: () => ({ retrigger: 1 }) }, { evaluate: () => ({ addMult: 1 }) }, { evaluate: () => ({ timesMult: 2 }) }];
  const r = scoreWord(selR(['A', mods]), opts());
  // addMult applied twice => +2 => (1+2)=3 ; timesMult applied twice => 4 ; mult = 3*4 = 12
  assert.equal(r.mult, 12);
});

test('retrigger: a Wild (base 0) retriggers to 0, no NaN', () => {
  const r = scoreWord(selR(['*', [{ evaluate: () => ({ retrigger: 2 }) }]]), opts());
  assert.equal(r.breakdown.base, 0);
  assert.equal(Number.isFinite(r.score), true);
});

test('no retrigger: behavior unchanged (relic +Points, mod +Mult, base, length)', () => {
  const relic = { name: 'R', evaluate: () => ({ addPoints: 5 }) };
  const mod = { name: 'M', evaluate: () => ({ addMult: 1 }) };
  const r = scoreWord(selR(['A', [mod]], ['B'], ['Q'], ['A']), opts([relic]));
  // base = 1+2+10+1 = 14 ; lengthBonus = (4-3)*1 = 1 ; +5 relic => points = 20 ; addMult 1 => mult 2 ; score 40
  assert.equal(r.breakdown.base, 14);
  assert.equal(r.points, 20);
  assert.equal(r.mult, 2);
  assert.equal(r.score, 40);
});

test('score is rounded to an integer (no fractional/float-noise Score)', () => {
  // CAT base = C3+A1+T1 = 5 points, no length bonus; a ×1.5 relic → 5 × 1.5 = 7.5 → rounds to 8.
  const cat = sel([makeTile('C'), 'C'], [makeTile('A'), 'A'], [makeTile('T'), 'T']);
  const timesMult = { id: 'half', name: 'Half', evaluate: () => ({ timesMult: 1.5 }) };
  const r = scoreWord(cat, { tileValues, lengthBonusPerLetter: 0, relics: [timesMult] });
  assert.equal(r.points, 5);
  assert.equal(r.mult, 1.5);
  assert.equal(r.score, 8, 'score 7.5 must round to 8');
  assert.equal(Number.isInteger(r.score), true, 'score must always be an integer');
});
