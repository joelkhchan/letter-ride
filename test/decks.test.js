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

test('mystery deck is a dynamic, ink-unlock deck with no fixed startingBag', () => {
  const m = CONFIG.DECKS.mystery;
  assert.ok(m, 'mystery deck should exist');
  assert.equal(m.dynamic, 'mystery', 'mystery deck should carry the dynamic flag');
  assert.equal(m.startingBag, null, 'mystery deck has no fixed startingBag (rolled per run)');
  assert.ok(!CONFIG.META.baseUnlocked.decks.includes('mystery'), 'mystery is an ink-unlock, not base');
});

test('staccato / suffix / monolith are non-empty, rare-free, ink-unlock static bags', () => {
  for (const id of ['staccato', 'suffix', 'monolith']) {
    const d = CONFIG.DECKS[id];
    assert.ok(d, `${id} deck should exist`);
    assert.ok(Array.isArray(d.startingBag) && d.startingBag.length > 0, `${id} has a non-empty startingBag`);
    assert.ok(!d.startingBag.some(l => ['J', 'Q', 'X', 'Z', '*'].includes(l)), `${id} has no rares or wilds`);
    assert.ok(!CONFIG.META.baseUnlocked.decks.includes(id), `${id} is an ink-unlock, not base`);
  }
});

test('monolith uses only a small concentrated set of letters, heavily repeated', () => {
  const bag = CONFIG.DECKS.monolith.startingBag;
  const distinct = new Set(bag);
  assert.ok(distinct.size <= 8, `monolith should use <=8 distinct letters (got ${distinct.size})`);
  assert.ok(bag.length / distinct.size >= 4, 'monolith should average >=4 copies per letter (guaranteed pairs)');
});

test('newRun with mystery deck builds a seeded bag: deterministic per seed, vowel floor honored', () => {
  const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
  const r1 = newRun({ config: CONFIG, dictionary: dict, seed: 7, deck: CONFIG.DECKS.mystery });
  const r2 = newRun({ config: CONFIG, dictionary: dict, seed: 7, deck: CONFIG.DECKS.mystery });
  assert.deepEqual(r1.bag.tiles.map(t => t.letter), r2.bag.tiles.map(t => t.letter), 'same seed → same mystery bag');
  const v = r1.bag.tiles.filter(t => VOWELS.has(t.letter)).length;
  assert.ok(v >= CONFIG.MYSTERY.vowelsMin, 'mystery run bag honors the vowel floor');
  assert.ok(!r1.bag.tiles.some(t => ['J', 'Q', 'X', 'Z'].includes(t.letter)), 'mystery run bag has no rares');
});

test('mystery deck grants +1 discard/round (its discardsDelta feeds newRun)', () => {
  assert.equal(CONFIG.DECKS.mystery.discardsDelta, 1, 'mystery deck should carry discardsDelta: 1');
  const run = newRun({ config: CONFIG, dictionary: dict, seed: 3, deck: CONFIG.DECKS.mystery });
  assert.equal(run.discardsPerRound, CONFIG.DISCARDS_PER_ROUND + 1, 'mystery run gets one extra discard/round');
  assert.equal(run.discardsLeft, CONFIG.DISCARDS_PER_ROUND + 1, 'round 1 starts with the extra discard available');
});
