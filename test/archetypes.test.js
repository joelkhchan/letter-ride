import { test } from 'node:test';
import assert from 'node:assert';
import { ARCHETYPES, honeModifiers, ALL_ARCHETYPE_IDS } from '../src/archetypes.js';

const ctx = (word, extra = {}) => ({
  word, letters: [...word.toUpperCase()],
  selection: [...word.toUpperCase()].map(l => ({ tile: { letter: l }, letter: l })),
  wordsPlayedThisRound: 0, enablers: [], ...extra,
});

test('rareLetter matches J/Q/X/Z and honeBonus scales points with level', () => {
  assert.equal(ARCHETYPES.rareLetter.matches(ctx('QI')), true);
  assert.equal(ARCHETYPES.rareLetter.matches(ctx('CAT')), false);
  assert.deepEqual(ARCHETYPES.rareLetter.honeBonus(ctx('QI'), 2), { addPoints: 30, timesMult: 1 }); // 15*2, no kicker below L3
  assert.deepEqual(ARCHETYPES.rareLetter.honeBonus(ctx('CAT'), 2), {});
});
test('wildsAreRare enabler makes a wild count as rare', () => {
  const c = { ...ctx('A'), letters: ['A'], selection: [{ tile: { letter: '*' }, letter: 'A' }], enablers: ['wildsAreRare'] };
  assert.equal(ARCHETYPES.rareLetter.matches(c), true);
  assert.deepEqual(ARCHETYPES.rareLetter.honeBonus(c, 2), { addPoints: 30, timesMult: 1 }); // no kicker below L3
});
test('shortWord hone adds Mult per level on <=3 letters only', () => {
  assert.deepEqual(ARCHETYPES.shortWord.honeBonus(ctx('CAT'), 3), { addMult: 3, timesMult: 1.25 }); // L3 kicker = 1+0.25*(3-2)
  assert.deepEqual(ARCHETYPES.shortWord.honeBonus(ctx('CATS'), 3), {});
});
test('escalation hone scales Mult with words played this round', () => {
  assert.deepEqual(ARCHETYPES.escalation.honeBonus(ctx('CAT', { wordsPlayedThisRound: 4 }), 1), { addMult: 2, timesMult: 1 }); // 0.5*1*4, no kicker below L3
});
test('looseDoubled enabler counts a non-adjacent repeat as doubled', () => {
  assert.equal(ARCHETYPES.doubled.matches(ctx('TOT')), false);                                  // T-O-T: repeat but no adjacent double
  assert.equal(ARCHETYPES.doubled.matches({ ...ctx('TOT'), enablers: ['looseDoubled'] }), true);
});
test('longReach enabler lowers the long-word threshold by one', () => {
  assert.equal(ARCHETYPES.longWord.matches(ctx('HOUSE')), false);                                 // 5 letters, default threshold 6
  assert.equal(ARCHETYPES.longWord.matches({ ...ctx('HOUSE'), enablers: ['longReach'] }), true);   // threshold 5
});
test('honeModifiers yields one pseudo-relic per leveled archetype', () => {
  const mods = honeModifiers({ rareLetter: 2, shortWord: 0, longWord: 1 });
  assert.deepEqual(mods.map(m => m.id).sort(), ['hone:longWord', 'hone:rareLetter']); // level 0 excluded
  const rare = mods.find(m => m.id === 'hone:rareLetter');
  assert.deepEqual(rare.evaluate(ctx('QI')), { addPoints: 30, timesMult: 1 }); // lvl=2, no kicker below L3
  assert.deepEqual(rare.evaluate(ctx('CAT')), {}); // non-rare word -> delegated honeBonus returns {}
});

test('Hone emits ×Mult at level 3+ (shortWord example)', () => {
  const ctx = { letters: ['C', 'A', 'T'], word: 'CAT' };       // matches shortWord (≤3)
  assert.equal(ARCHETYPES.shortWord.honeBonus(ctx, 2).timesMult ?? 1, 1);          // no kicker below L3
  assert.equal(ARCHETYPES.shortWord.honeBonus(ctx, 3).timesMult, 1 + 0.25 * 1);    // L3 kicker
  assert.equal(ARCHETYPES.shortWord.honeBonus(ctx, 4).timesMult, 1 + 0.25 * 2);    // L4 kicker
});

test('Hone ×Mult only applies when the archetype condition matches', () => {
  const ctx = { letters: ['C', 'A', 'T', 'S'], word: 'CATS' };  // does NOT match shortWord (>3)
  assert.deepEqual(ARCHETYPES.shortWord.honeBonus(ctx, 4), {});
});
