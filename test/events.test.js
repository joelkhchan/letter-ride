import { test } from 'node:test';
import assert from 'node:assert';
import { EVENTS, ALL_EVENT_IDS, applyEventOption, pressStart, pressDraw, pressBank, wordleStart, wordleGuess, wordleClaim } from '../src/events.js';
import { newRun } from '../src/run.js';
import { makeDictionary } from '../src/dictionary.js';
import { RELICS, ALL_RELIC_IDS } from '../src/relics.js';

const config = {
  STARTING_BAG: ['A','E','I','O','U','R','S','T','N','L','D','C','M','B','P','G','H','K','Y','F','W','V'],
  TILE_VALUES: { A:1,E:1,I:1,O:1,U:1,R:1,S:1,T:1,N:1,L:1,D:2,C:3,M:3,B:3,P:3,G:2,H:4,K:5,Y:4,F:4,W:4,V:4,J:8,X:8,Q:10,Z:10,'*':0 },
  RACK_SIZE: 9, PLAYS_PER_ROUND: 4, DISCARDS_PER_ROUND: 2, MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 5, ROUND_TARGETS: [9999,9999,9999], COINS_ON_CLEAR: null,
  HONE: { cost: 6 },
};
const dict = makeDictionary(['cat','cats']);

test('roster: 6 events, 2 interactive (The Press + The Proof)', () => {
  assert.equal(ALL_EVENT_IDS.length, 6);
  const interactive = Object.values(EVENTS).filter(e => e.interactive).map(e => e.id).sort();
  assert.deepEqual(interactive, ['thePress', 'theProof']);
});

const wcfg = { ...config, WORDLE: { length: 5, maxGuesses: 6, coinsBase: 3, coinsPerGuessSaved: 3 } };
const wdict = makeDictionary(['crane', 'slate', 'cat']);

test('The Proof: start picks target, scores guesses, solve + claim scales coins with speed', () => {
  const run = newRun({ config: wcfg, dictionary: wdict, seed: 1 });
  wordleStart(run, ['crane']);
  assert.equal(run.wordle.target, 'crane');
  assert.equal(wordleGuess(run, 'zzzzz').ok, false);   // not a valid word
  assert.equal(wordleGuess(run, 'cat').ok, false);     // wrong length
  assert.equal(wordleGuess(run, 'slate').status, 'playing');
  assert.equal(wordleGuess(run, 'crane').status, 'solved');
  const before = run.coins;
  assert.equal(wordleClaim(run, 'coins').ok, true);
  assert.equal(run.coins - before, 3 + 3 * (6 - 2));   // solved in 2 guesses -> 15
  assert.equal(wordleClaim(run, 'coins').ok, false);   // no double-claim
});

test('The Proof: fails after maxGuesses with no solve; reward not claimable', () => {
  const run = newRun({ config: wcfg, dictionary: wdict, seed: 1 });
  wordleStart(run, ['crane']);
  for (let i = 0; i < 6; i++) wordleGuess(run, 'slate');
  assert.equal(run.wordle.status, 'failed');
  assert.equal(wordleClaim(run, 'coins').ok, false);
});

test('autoResolve events are single-option, need no input, and apply cleanly on pick', () => {
  for (const id of ['inkMerchant', 'theBlank']) {
    assert.equal(EVENTS[id].autoResolve, true, `${id} should auto-resolve`);
    assert.equal(EVENTS[id].options.length, 1, `${id} should have exactly one option`);
  }
  for (const id of ['wordsmith', 'redaction', 'thePress']) {
    assert.notEqual(EVENTS[id].autoResolve, true, `${id} should not auto-resolve`);
  }
  // Ink Merchant applies with no opts: spends $5, grants one relic.
  const run = newRun({ config, dictionary: dict, seed: 3 });
  run.coins = 10;
  const before = run.relics.length;
  const r = applyEventOption(run, 'inkMerchant', 0, {});
  assert.equal(r.ok, true);
  assert.equal(run.relics.length, before + 1);
  assert.equal(run.coins, 5);
});

test('Redaction removes 2 chosen tiles via opts.tileIds (free thinning)', () => {
  const run = newRun({ config, dictionary: dict, seed: 1 });
  const before = run.bag.tiles.length;
  const id = Object.keys(EVENTS).find(k => k === 'redaction');
  const tileIds = [run.bag.tiles[0].id, run.bag.tiles[1].id];
  const result = applyEventOption(run, id, 0, { tileIds });
  assert.equal(result.ok, true);
  assert.equal(run.bag.tiles.length, before - 2);
});

test('Redaction accepts 1 tile (up to 2, not forced) and rejects 0 or 3', () => {
  const run = newRun({ config, dictionary: dict, seed: 1 });
  const before = run.bag.tiles.length;
  assert.equal(applyEventOption(run, 'redaction', 0, { tileIds: [run.bag.tiles[0].id] }).ok, true);
  assert.equal(run.bag.tiles.length, before - 1, 'removing a single tile is allowed');
  assert.equal(applyEventOption(run, 'redaction', 0, { tileIds: [] }).reason, 'bad-count', '0 tiles rejected');
  const three = run.bag.tiles.slice(0, 3).map(t => t.id);
  assert.equal(applyEventOption(run, 'redaction', 0, { tileIds: three }).reason, 'bad-count', '3 tiles rejected');
});

test('Redaction canOffer is false when bag is too small', () => {
  const run = newRun({ config, dictionary: dict, seed: 1 });
  // Drain bag down to exactly RACK_SIZE + 2 tiles
  while (run.bag.tiles.length > config.RACK_SIZE + 2) run.bag.remove(run.bag.tiles[0].id);
  const id = Object.keys(EVENTS).find(k => k === 'redaction');
  assert.equal(EVENTS[id].canOffer(run), false);
});

test('Ink Merchant canOffer is false when coins < 5', () => {
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.coins = 4;
  const id = Object.keys(EVENTS).find(k => k === 'inkMerchant');
  assert.equal(EVENTS[id].canOffer(run), false);
});

test('Ink Merchant pays $5 and grants an un-owned relic', () => {
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.coins = 10;
  const id = Object.keys(EVENTS).find(k => k === 'inkMerchant');
  const before = run.relics.length;
  const result = applyEventOption(run, id, 0);
  assert.equal(result.ok, true);
  assert.equal(run.coins, 5);
  assert.equal(run.relics.length, before + 1);
});

test('Ink Merchant never grants an already-owned relic', () => {
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.coins = 100;
  const id = Object.keys(EVENTS).find(k => k === 'inkMerchant');
  // Own all but one relic
  run.relics = ALL_RELIC_IDS.slice(0, -1).map(rid => RELICS[rid]);
  const result = applyEventOption(run, id, 0);
  assert.equal(result.ok, true);
  const ownedIds = new Set(run.relics.map(r => r.id));
  assert.equal(ownedIds.size, ALL_RELIC_IDS.length, 'all relics now owned after single buy');
});

test('The Blank swaps 3 random tiles for a Wild (bag shrinks by 2)', () => {
  const run = newRun({ config, dictionary: dict, seed: 1 });
  const before = run.bag.tiles.length;
  const id = Object.keys(EVENTS).find(k => k === 'theBlank');
  const result = applyEventOption(run, id, 0);
  assert.equal(result.ok, true);
  assert.equal(run.bag.tiles.length, before - 2);  // -3 removed, +1 wild
  const wilds = run.bag.tiles.filter(t => t.letter === '*');
  assert.ok(wilds.length >= 1, 'at least one wild added');
});

test('The Blank canOffer is false when bag is too small', () => {
  const run = newRun({ config, dictionary: dict, seed: 1 });
  while (run.bag.tiles.length > config.RACK_SIZE + 3) run.bag.remove(run.bag.tiles[0].id);
  const id = Object.keys(EVENTS).find(k => k === 'theBlank');
  assert.equal(EVENTS[id].canOffer(run), false);
});

test('Wordsmith applies free Hone level via opts.archetypeId', () => {
  const run = newRun({ config, dictionary: dict, seed: 1 });
  const id = Object.keys(EVENTS).find(k => k === 'wordsmith');
  const result = applyEventOption(run, id, 0, { archetypeId: 'shortWord' });
  assert.equal(result.ok, true);
  assert.equal(run.honeLevels['shortWord'], 1);
});

test('applyEventOption returns ok:false for unknown eventId', () => {
  const run = newRun({ config, dictionary: dict, seed: 1 });
  const result = applyEventOption(run, 'nonexistent', 0);
  assert.equal(result.ok, false);
});

test('The Press: pot grows on unique draws, busts on a duplicate, bank pays the pot', () => {
  assert.equal(EVENTS.thePress.interactive, true);
  const run = newRun({ config, dictionary: dict, seed: 2 });
  pressStart(run);
  assert.deepEqual(run.press, { drawn: [], pot: 0, busted: false });
  pressDraw(run);
  assert.equal(run.press.drawn.length, 1);
  assert.ok(run.press.pot >= 1);                       // first letter's value
  // force a duplicate to prove the bust path:
  const dup = run.press.drawn[0];
  run.press.forcedNext = dup;                           // test hook
  pressDraw(run);
  assert.equal(run.press.busted, true);
  const coinsBefore = run.coins;
  pressBank(run);                                        // busted -> pays nothing
  assert.equal(run.coins, coinsBefore);
  assert.equal(run.press, null);
});

test('The Press: clean bank path accumulates unique draws and pays pot on bank', () => {
  const run = newRun({ config, dictionary: dict, seed: 3 });
  pressStart(run);
  const coinsBefore = run.coins;
  // Force two distinct draws
  run.press.forcedNext = 'A';
  pressDraw(run);
  assert.equal(run.press.drawn.length, 1);
  assert.equal(run.press.drawn[0], 'A');
  assert.ok(run.press.pot >= run.tileValues.A);
  const potAfterFirst = run.press.pot;
  run.press.forcedNext = 'E';
  pressDraw(run);
  assert.equal(run.press.drawn.length, 2);
  assert.equal(run.press.drawn[1], 'E');
  assert.ok(run.press.pot >= potAfterFirst + run.tileValues.E);
  // Bank the pot
  const finalPot = run.press.pot;
  pressBank(run);
  assert.equal(run.coins, coinsBefore + finalPot);
  assert.equal(run.press, null);
});
