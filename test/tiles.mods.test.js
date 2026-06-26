import { test } from 'node:test';
import assert from 'node:assert';
import { scoreWord } from '../src/scoring.js';
import { makeTile, getMod, WILD, resetTileIds } from '../src/tiles.js';
import { RELICS } from '../src/relics.js';

const tv = { C:3, A:1, T:1, E:1, R:1, S:1, O:1 };
// build a selection where one specific tile carries a mod
function selWithMod(word, modIndex, modId) {
  return [...word].map((ch, i) => ({ tile: makeTile(ch, i === modIndex ? [getMod(modId)] : []), letter: ch }));
}

test('resonator: +5 Points if the word has 2+ of this tile letter', () => {
  resetTileIds();
  // EERIE has 3 E's; put resonator on the first E
  const s = selWithMod('EERIE', 0, 'resonator');
  const bare = [...'EERIE'].map(ch => ({ tile: makeTile(ch), letter: ch }));
  const tvE = { E:1, R:1, I:1 };
  assert.equal(scoreWord(s, { tileValues: tvE, lengthBonusPerLetter: 0 }).points
             - scoreWord(bare, { tileValues: tvE, lengthBonusPerLetter: 0 }).points, 5);
});
test('polished: +4 Points always', () => {
  resetTileIds();
  const s = selWithMod('CAT', 0, 'polished');
  assert.equal(scoreWord(s, { tileValues: tv, lengthBonusPerLetter: 0 }).points, 3 + 1 + 1 + 4);
});
test('catalyst: +1 Mult always', () => {
  resetTileIds();
  const s = selWithMod('CAT', 1, 'catalyst');
  assert.equal(scoreWord(s, { tileValues: tv, lengthBonusPerLetter: 0 }).mult, 2);
});
test('anchor: +8 Points only if this tile is the first letter of the word', () => {
  resetTileIds();
  const first = selWithMod('CAT', 0, 'anchor');     // anchor on C (first)
  const notFirst = selWithMod('CAT', 2, 'anchor');  // anchor on T (last)
  assert.equal(scoreWord(first, { tileValues: tv, lengthBonusPerLetter: 0 }).points, 5 + 8);
  assert.equal(scoreWord(notFirst, { tileValues: tv, lengthBonusPerLetter: 0 }).points, 5);
});
test('twin: a pure enabler mod (no standalone Points/Mult of its own)', () => {
  resetTileIds();
  const s = selWithMod('CAT', 0, 'twin');
  const bare = [...'CAT'].map(ch => ({ tile: makeTile(ch), letter: ch }));
  const r = scoreWord(s, { tileValues: tv, lengthBonusPerLetter: 0 });
  assert.equal(r.points, scoreWord(bare, { tileValues: tv, lengthBonusPerLetter: 0 }).points);
  assert.equal(r.mult, 1);
  assert.ok(getMod('twin') && getMod('twin').desc.length > 0);
});
test('twin enables doubled-letter relics without an adjacent double (echoChamber x2, doubleTrouble +40)', () => {
  resetTileIds();
  const twinSel = selWithMod('CAT', 0, 'twin');                          // C-A-T: no adjacent double
  const bareSel = [...'CAT'].map(ch => ({ tile: makeTile(ch), letter: ch }));
  const opts = { tileValues: tv, lengthBonusPerLetter: 0, relics: [RELICS.echoChamber, RELICS.doubleTrouble] };
  const twin = scoreWord(twinSel, opts), bare = scoreWord(bareSel, opts);
  assert.equal(bare.mult, 1);                                            // no double -> relics inert
  assert.equal(twin.mult, 2);                                            // echoChamber via isDoubled
  assert.equal(twin.points - bare.points, 40);                          // doubleTrouble via isDoubled
});
test('WILD contributes 0 base Points but its mod still applies', () => {
  resetTileIds();
  const s = [{ tile: makeTile(WILD, [getMod('polished')]), letter: 'A' }, { tile: makeTile('T'), letter: 'T' }, { tile: makeTile('E'), letter: 'E' }];
  // wild=0 base, T=1, E=1, + polished +4 = 6
  assert.equal(scoreWord(s, { tileValues: tv, lengthBonusPerLetter: 0 }).points, 0 + 1 + 1 + 4);
});

// Archetype-flavored mods (design-review #4): each rewards its archetype's condition when its tile plays.
test('bloom: +2 Points per vowel in the word (vowel archetype)', () => {
  resetTileIds();
  const s = selWithMod('OAT', 0, 'bloom');                                  // O,A vowels = 2 -> +4
  const bare = [...'OAT'].map(ch => ({ tile: makeTile(ch), letter: ch }));
  const o = { tileValues: tv, lengthBonusPerLetter: 0 };
  assert.equal(scoreWord(s, o).points - scoreWord(bare, o).points, 4);
});
test('lode: +15 Points if the word uses a rare letter (rare archetype)', () => {
  resetTileIds();
  const tvZ = { Z: 10, A: 1, T: 1 };
  assert.equal(scoreWord(selWithMod('ZA', 0, 'lode'), { tileValues: tvZ, lengthBonusPerLetter: 0 }).points, 10 + 1 + 15);
  assert.equal(scoreWord(selWithMod('AT', 0, 'lode'), { tileValues: tvZ, lengthBonusPerLetter: 0 }).points, 1 + 1);
});
test('stretch: +3 Points per letter beyond 4 (long archetype)', () => {
  resetTileIds();
  const s = selWithMod('CATER', 0, 'stretch');                              // 5 letters -> +3
  const bare = [...'CATER'].map(ch => ({ tile: makeTile(ch), letter: ch }));
  const o = { tileValues: tv, lengthBonusPerLetter: 0 };
  assert.equal(scoreWord(s, o).points - scoreWord(bare, o).points, 3);
});
test('compact: +2 Mult if the word is 3 letters or fewer (short archetype)', () => {
  resetTileIds();
  const o = { tileValues: tv, lengthBonusPerLetter: 0 };
  assert.equal(scoreWord(selWithMod('CAT', 0, 'compact'), o).mult, 3);      // 1 + 2
  assert.equal(scoreWord(selWithMod('CART', 0, 'compact'), o).mult, 1);     // 4 letters -> no bonus
});
