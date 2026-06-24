import test from 'node:test';
import assert from 'node:assert/strict';
import { countsOf, canForm, legalWords, selectionFor } from '../src/enumerate.js';

test('countsOf tallies letters', () => {
  assert.deepEqual(countsOf(['A', 'B', 'A']), { A: 2, B: 1 });
});

test('canForm respects multiplicity', () => {
  assert.equal(canForm('AA', { A: 2 }), true);
  assert.equal(canForm('AA', { A: 1 }), false);
  assert.equal(canForm('CAT', { C: 1, A: 1, T: 1 }), true);
});

test('legalWords filters by length window and formability', () => {
  const words = ['CAT', 'AT', 'CATS', 'DOG'];
  assert.deepEqual(legalWords(['C', 'A', 'T', 'S'], words, 3).sort(), ['CAT', 'CATS']);
});

test('selectionFor maps each letter to a distinct real tile, or null', () => {
  const rack = [{ id: 't1', letter: 'C' }, { id: 't2', letter: 'A' }, { id: 't3', letter: 'T' }];
  const sel = selectionFor('CAT', rack);
  assert.equal(sel.length, 3);
  assert.deepEqual(sel.map(s => s.letter), ['C', 'A', 'T']);
  assert.equal(selectionFor('CATS', rack), null);
});

test('canForm treats * as a blank', () => {
  assert.equal(canForm('CAT', { C: 1, A: 1, '*': 1 }), true);   // T via wild
  assert.equal(canForm('CAT', { C: 1, '*': 1 }), false);        // need A and T, only one wild
  assert.equal(canForm('AA', { A: 1, '*': 1 }), true);
});

test('selectionFor assigns a wild tile the needed letter', () => {
  const rack = [{ id: 't1', letter: 'C' }, { id: 't2', letter: 'A' }, { id: 't3', letter: '*' }];
  const sel = selectionFor('CAT', rack);
  assert.deepEqual(sel.map(s => s.letter), ['C', 'A', 'T']);
  assert.equal(sel.find(s => s.tile.id === 't3').letter, 'T');  // wild resolved to the missing letter
});
