// test/decks.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { CONFIG } from '../src/config.js';
import { makeDictionary } from '../src/dictionary.js';
import { newRun } from '../src/run.js';

const dict = makeDictionary(['cat', 'art', 'tap', 'zap', 'jot', 'quo', 'qua', 'ex']);

test('rareRich deck has non-empty startingBag', () => {
  assert.ok(CONFIG.DECKS.rareRich, 'rareRich deck should exist');
  assert.ok(Array.isArray(CONFIG.DECKS.rareRich.startingBag), 'startingBag should be an array');
  assert.ok(CONFIG.DECKS.rareRich.startingBag.length > 0, 'startingBag should be non-empty');
});

test('doubled deck has non-empty startingBag', () => {
  assert.ok(CONFIG.DECKS.doubled, 'doubled deck should exist');
  assert.ok(Array.isArray(CONFIG.DECKS.doubled.startingBag), 'startingBag should be an array');
  assert.ok(CONFIG.DECKS.doubled.startingBag.length > 0, 'startingBag should be non-empty');
});

test('lean deck has non-empty startingBag', () => {
  assert.ok(CONFIG.DECKS.lean, 'lean deck should exist');
  assert.ok(Array.isArray(CONFIG.DECKS.lean.startingBag), 'startingBag should be an array');
  assert.ok(CONFIG.DECKS.lean.startingBag.length > 0, 'startingBag should be non-empty');
});

test('newRun with rareRich deck seeds a bag containing at least one of J/Q/X/Z', () => {
  const run = newRun({ config: CONFIG, dictionary: dict, seed: 1, deck: CONFIG.DECKS.rareRich });
  const letters = run.bag.tiles.map(tile => tile.letter);
  const hasRareLetter = ['J', 'Q', 'X', 'Z'].some(letter => letters.includes(letter));
  assert.ok(hasRareLetter, 'rareRich bag should contain at least one of J/Q/X/Z');
});

test('all three new decks are in META.baseUnlocked.decks', () => {
  const unlockedDecks = CONFIG.META.baseUnlocked.decks;
  assert.ok(unlockedDecks.includes('rareRich'), 'rareRich should be in baseUnlocked.decks');
  assert.ok(unlockedDecks.includes('doubled'), 'doubled should be in baseUnlocked.decks');
  assert.ok(unlockedDecks.includes('lean'), 'lean should be in baseUnlocked.decks');
});
