import { test } from 'node:test';
import assert from 'node:assert';
import { scoreWord } from '../src/scoring.js';
import { makeTile, getMod, WILD, resetTileIds } from '../src/tiles.js';

const tv = { C:3, A:1, T:1, E:1, R:1, S:1, O:1 };
// build a selection where one specific tile carries a mod
function selWithMod(word, modIndex, modId) {
  return [...word].map((ch, i) => ({ tile: makeTile(ch, i === modIndex ? [getMod(modId)] : []), letter: ch }));
}

test('resonator: +5 Wit if the word has 2+ of this tile letter', () => {
  resetTileIds();
  // EERIE has 3 E's; put resonator on the first E
  const s = selWithMod('EERIE', 0, 'resonator');
  const bare = [...'EERIE'].map(ch => ({ tile: makeTile(ch), letter: ch }));
  const tvE = { E:1, R:1, I:1 };
  assert.equal(scoreWord(s, { tileValues: tvE, lengthBonusPerLetter: 0 }).wit
             - scoreWord(bare, { tileValues: tvE, lengthBonusPerLetter: 0 }).wit, 5);
});
test('polished: +4 Wit always', () => {
  resetTileIds();
  const s = selWithMod('CAT', 0, 'polished');
  assert.equal(scoreWord(s, { tileValues: tv, lengthBonusPerLetter: 0 }).wit, 3 + 1 + 1 + 4);
});
test('catalyst: +1 Mult always', () => {
  resetTileIds();
  const s = selWithMod('CAT', 1, 'catalyst');
  assert.equal(scoreWord(s, { tileValues: tv, lengthBonusPerLetter: 0 }).mult, 2);
});
test('anchor: +8 Wit only if this tile is the first letter of the word', () => {
  resetTileIds();
  const first = selWithMod('CAT', 0, 'anchor');     // anchor on C (first)
  const notFirst = selWithMod('CAT', 2, 'anchor');  // anchor on T (last)
  assert.equal(scoreWord(first, { tileValues: tv, lengthBonusPerLetter: 0 }).wit, 5 + 8);
  assert.equal(scoreWord(notFirst, { tileValues: tv, lengthBonusPerLetter: 0 }).wit, 5);
});
test('WILD contributes 0 base Wit but its mod still applies', () => {
  resetTileIds();
  const s = [{ tile: makeTile(WILD, [getMod('polished')]), letter: 'A' }, { tile: makeTile('T'), letter: 'T' }, { tile: makeTile('E'), letter: 'E' }];
  // wild=0 base, T=1, E=1, + polished +4 = 6
  assert.equal(scoreWord(s, { tileValues: tv, lengthBonusPerLetter: 0 }).wit, 0 + 1 + 1 + 4);
});
