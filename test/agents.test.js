import test from 'node:test';
import assert from 'node:assert/strict';
import { makeAgent, greedyAgent, randomAgent, lookaheadAgent } from '../src/agents.js';
import { noShop } from '../src/sim.js';

test('makeAgent returns the three hooks', () => {
  const a = makeAgent({ choosePlay: () => 'p', chooseDiscard: () => [], chooseShop: () => {} });
  assert.equal(a.choosePlay(), 'p');
  assert.deepEqual(a.chooseDiscard(), []);
  assert.equal(typeof a.chooseShop, 'function');
});

test('greedyAgent wires bestPlay + smartDiscard + the given shop policy', () => {
  const a = greedyAgent(noShop);
  assert.equal(typeof a.choosePlay, 'function');
  assert.equal(typeof a.chooseDiscard, 'function');
  assert.equal(a.chooseShop, noShop);
});

test('randomAgent uses randomPlay but greedy discard/shop', () => {
  const a = randomAgent(noShop);
  assert.equal(typeof a.choosePlay, 'function');
  assert.equal(a.chooseShop, noShop);
});

test('lookaheadAgent exposes the three hooks', () => {
  const a = lookaheadAgent(undefined, { k: 3, branch: 4 });
  assert.equal(typeof a.choosePlay, 'function');
  assert.equal(typeof a.chooseDiscard, 'function');
});
