// test/bag.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { makeBag } from '../src/bag.js';
import { makeRng } from '../src/rng.js';
import { makeTile, resetTileIds } from '../src/tiles.js';

test('draw returns n tiles deterministically by seed; bag not consumed', () => {
  resetTileIds();
  const bag = makeBag(['A','B','C','D','E'].map(l => makeTile(l)));
  const r1 = bag.draw(3, makeRng(5));
  const r2 = bag.draw(3, makeRng(5));
  assert.equal(r1.length, 3);
  assert.deepEqual(r1.map(t => t.id), r2.map(t => t.id));
  assert.equal(bag.tiles.length, 5);     // not consumed
});

test('add and remove change bag composition by id', () => {
  resetTileIds();
  const a = makeTile('A'), a2 = makeTile('A'), z = makeTile('Z');
  const bag = makeBag([a, a2]);
  bag.add(z);
  assert.equal(bag.tiles.filter(t => t.letter === 'Z').length, 1);
  bag.remove(a.id);
  assert.equal(bag.tiles.filter(t => t.letter === 'A').length, 1);
  assert.equal(bag.tiles.find(t => t.letter === 'A').id, a2.id);
});
