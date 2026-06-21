import { test } from 'node:test';
import assert from 'node:assert';
import { wordOf, validate, isLegalSelection } from '../src/word.js';
import { makeDictionary } from '../src/dictionary.js';
import { makeTile, WILD, resetTileIds } from '../src/tiles.js';

const dict = makeDictionary(['cat', 'ice']);
const sel = (...pairs) => pairs.map(([tile, letter]) => ({ tile, letter }));

test('wordOf joins resolved letters (incl. a wild)', () => {
  resetTileIds();
  const s = sel([makeTile('C'), 'C'], [makeTile(WILD), 'A'], [makeTile('T'), 'T']);
  assert.equal(wordOf(s), 'CAT');
});

test('validate flags reasons', () => {
  resetTileIds();
  const cat = sel([makeTile('C'), 'C'], [makeTile('A'), 'A'], [makeTile('T'), 'T']);
  assert.deepEqual(validate(cat, dict), { ok: true });
  const it = sel([makeTile('I'), 'I'], [makeTile('T'), 'T']);
  assert.deepEqual(validate(it, dict), { ok: false, reason: 'short' });
  const zzz = sel([makeTile('Z'), 'Z'], [makeTile('Z'), 'Z'], [makeTile('Z'), 'Z']);
  assert.deepEqual(validate(zzz, dict), { ok: false, reason: 'notword' });
});

test('isLegalSelection requires distinct tiles drawn from the rack', () => {
  resetTileIds();
  const a = makeTile('C'), b = makeTile('A'), outsider = makeTile('Z');
  const rack = [a, b];
  assert.equal(isLegalSelection(sel([a, 'C'], [b, 'A']), rack), true);
  assert.equal(isLegalSelection(sel([a, 'C'], [a, 'C']), rack), false);   // same tile reused
  assert.equal(isLegalSelection(sel([outsider, 'Z']), rack), false);      // not in the rack
});
