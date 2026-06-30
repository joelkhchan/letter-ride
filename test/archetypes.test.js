import { test } from 'node:test';
import assert from 'node:assert';
import { ARCHETYPES, honeModifiers, ALL_ARCHETYPE_IDS, honeDescription } from '../src/archetypes.js';

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
  assert.deepEqual(ARCHETYPES.escalation.honeBonus(ctx('CAT', { wordsPlayedThisRound: 4 }), 3), { addMult: 6, timesMult: 1.4 }); // L3 ×Mult kicker scales with words: 1 + 0.1*1*4
  assert.deepEqual(ARCHETYPES.longWord.honeBonus(ctx('CLAMBERS'), 2), { addMult: 1, timesMult: 1 }); // long-word Refine is now Mult: 0.5*2
});
test('escalation matches only once momentum has started (2nd+ word or a chained word), not the first', () => {
  assert.equal(ARCHETYPES.escalation.matches(ctx('CAT', { wordsPlayedThisRound: 0 })), false);  // first word of the round
  assert.equal(ARCHETYPES.escalation.matches(ctx('CAT', { wordsPlayedThisRound: 1 })), true);   // 2nd+ word
  assert.equal(ARCHETYPES.escalation.matches(ctx('CAT', { chainLength: 1 })), true);            // chained word (folded chain)
});
test('doubled counts any repeated letter (relaxed from adjacent-only 2026-06-30)', () => {
  assert.equal(ARCHETYPES.doubled.matches(ctx('TOT')), true);    // T-O-T: non-adjacent repeat now counts
  assert.equal(ARCHETYPES.doubled.matches(ctx('NEED')), true);   // adjacent double still counts
  assert.equal(ARCHETYPES.doubled.matches(ctx('CAT')), false);   // no repeat
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
  assert.strictEqual(ARCHETYPES.shortWord.honeBonus(ctx, 2).timesMult, 1);          // no kicker below L3
  assert.equal(ARCHETYPES.shortWord.honeBonus(ctx, 3).timesMult, 1 + 0.25 * 1);    // L3 kicker
  assert.equal(ARCHETYPES.shortWord.honeBonus(ctx, 4).timesMult, 1 + 0.25 * 2);    // L4 kicker
});

test('Hone ×Mult only applies when the archetype condition matches', () => {
  const ctx = { letters: ['C', 'A', 'T', 'S'], word: 'CATS' };  // does NOT match shortWord (>3)
  assert.deepEqual(ARCHETYPES.shortWord.honeBonus(ctx, 4), {});
});

test('honeDescription states the actual per-level effect, with the ×Mult kicker only at L3+', () => {
  assert.equal(honeDescription('longWord', 2), '+1 Mult on words of 6+ letters');               // 0.5*2, no kicker
  assert.equal(honeDescription('rareLetter', 1), '+15 Points on words using J, Q, X, or Z');   // 15*1
  assert.equal(honeDescription('vowelHeavy', 2), '+4 Points per vowel on words with 3+ vowels'); // 2*2
  assert.match(honeDescription('shortWord', 3), /×1\.25 Mult/);                                  // L3 kicker present
  assert.doesNotMatch(honeDescription('shortWord', 2), /Mult to the word/);                      // no kicker below L3
});

test('a twin-modded tile makes the word count as doubled (engineered double, skill lever)', () => {
  assert.equal(ARCHETYPES.doubled.matches(ctx('CAT')), false);                 // no adjacent double, no repeat
  const withTwin = { ...ctx('CAT'), selection: [
    { tile: { letter: 'C', mods: [{ id: 'twin' }] }, letter: 'C' },
    { tile: { letter: 'A' }, letter: 'A' },
    { tile: { letter: 'T' }, letter: 'T' },
  ] };
  assert.equal(ARCHETYPES.doubled.matches(withTwin), true);
});
