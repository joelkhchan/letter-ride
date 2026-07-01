// test/bag.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { makeBag, buildMysteryBag } from '../src/bag.js';
import { makeRng } from '../src/rng.js';
import { makeTile, resetTileIds } from '../src/tiles.js';
import { CONFIG } from '../src/config.js';

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

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const RARES = new Set(['J', 'Q', 'X', 'Z']);

test('buildMysteryBag is deterministic for a fixed seed', () => {
  const a = buildMysteryBag(CONFIG.MYSTERY, makeRng(42));
  const b = buildMysteryBag(CONFIG.MYSTERY, makeRng(42));
  assert.deepEqual(a, b);
});

test('buildMysteryBag honors the vowel floor, excludes rares, stays in the size band', () => {
  const M = CONFIG.MYSTERY;
  for (const seed of [1, 2, 7, 99, 1234, 55555]) {
    const bag = buildMysteryBag(M, makeRng(seed));
    const v = bag.filter(l => VOWELS.has(l)).length;
    assert.ok(v >= M.vowelsMin, `seed ${seed}: ${v} vowels below floor ${M.vowelsMin}`);
    assert.ok(v <= M.vowelsMax, `seed ${seed}: ${v} vowels above vowelsMax ${M.vowelsMax}`);
    assert.ok(!bag.some(l => RARES.has(l)), `seed ${seed}: mystery bag must contain no rares`);
    assert.ok(bag.length >= M.vowelsMin + M.consMin && bag.length <= M.vowelsMax + M.consMax,
      `seed ${seed}: size ${bag.length} outside [${M.vowelsMin + M.consMin}, ${M.vowelsMax + M.consMax}]`);
  }
});

test('buildMysteryBag varies size across seeds (the gamble)', () => {
  const sizes = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => buildMysteryBag(CONFIG.MYSTERY, makeRng(s)).length));
  assert.ok(sizes.size > 1, 'mystery bag size should vary across seeds');
});
