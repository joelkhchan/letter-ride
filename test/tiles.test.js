// test/tiles.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { makeTile, nextId, setMinTileId, resetTileIds, rehydrateTile, tileIdNum, WILD, isWild } from '../src/tiles.js';

test('makeTile builds a plain tile with a fresh id', () => {
  resetTileIds();
  const t = makeTile('A');
  assert.deepEqual(t, { id: 't0', letter: 'A', mods: [] });
  assert.notEqual(makeTile('B').id, t.id);
});

test('explicit id is preserved (for rehydration)', () => {
  const t = makeTile('A', [], 't42');
  assert.equal(t.id, 't42');
});

test('rehydrateTile preserves id and rebuilds shape', () => {
  const t = rehydrateTile({ id: 't7', letter: 'E', modIds: [] });
  assert.deepEqual(t, { id: 't7', letter: 'E', mods: [] });
});

test('setMinTileId prevents id collisions after load', () => {
  resetTileIds();
  setMinTileId(7);
  assert.ok(tileIdNum(makeTile('A').id) > 7);
});

test('WILD detection', () => {
  assert.equal(isWild(makeTile(WILD)), true);
  assert.equal(isWild(makeTile('A')), false);
});
