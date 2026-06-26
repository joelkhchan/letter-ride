import { test } from 'node:test';
import assert from 'node:assert';
import { makeDictionary } from '../src/dictionary.js';
import { CONFIG } from '../src/config.js';

test('CONFIG.PROFANITY_BLOCKLIST is populated, all-lowercase, and actually blocks plays', () => {
  const list = CONFIG.PROFANITY_BLOCKLIST;
  assert.ok(Array.isArray(list) && list.length > 0, 'blocklist should be non-empty');
  for (const w of list) assert.equal(w, w.toLowerCase(), `blocklist entry "${w}" must be lowercase (exact-match contract)`);
  // A blocked word present in the word list must be rejected; a clean word must pass.
  const sample = list[0];
  const dict = makeDictionary([sample, 'cat'], list);
  assert.equal(dict.isValid(sample), false, 'a blocklisted word must be invalid even if in the list');
  assert.equal(dict.isValid('cat'), true);
});

test('isValid is case-insensitive and membership-based', () => {
  const dict = makeDictionary(['cat', 'dog', 'house']);
  assert.equal(dict.isValid('cat'), true);
  assert.equal(dict.isValid('CAT'), true);
  assert.equal(dict.isValid('zzz'), false);
});

test('blocklist rejects words even if present in the list', () => {
  const dict = makeDictionary(['cat', 'badword'], ['badword']);
  assert.equal(dict.isValid('cat'), true);
  assert.equal(dict.isValid('badword'), false);
  assert.equal(dict.isValid('BADWORD'), false);
  const unfiltered = makeDictionary(['cat', 'badword'], []);
  assert.equal(unfiltered.isValid('badword'), true);   // off → allowed
});

// ── findWord tests ──────────────────────────────────────────────────────────

test('findWord returns a word formable from the given letters (multiset)', () => {
  const dict = makeDictionary(['cat', 'cats', 'dog']);
  // ['C','A','T','S'] can form 'cat' or 'cats'
  const result = dict.findWord(['C', 'A', 'T', 'S']);
  assert.ok(result === 'cat' || result === 'cats', `expected 'cat' or 'cats', got ${result}`);
});

test('findWord returns null when no word can be formed', () => {
  const dict = makeDictionary(['cat', 'cats', 'dog']);
  assert.equal(dict.findWord(['Z', 'Q']), null);
});

test('findWord respects multiset constraints — cannot reuse letters beyond count', () => {
  const dict = makeDictionary(['aaa', 'aa', 'a']);
  // Only one 'A' available — 'aa' and 'aaa' require more
  const result = dict.findWord(['A'], 1);
  assert.equal(result, 'a');
  // Two 'A' allows 'aa' but not 'aaa'
  const result2 = dict.findWord(['A', 'A'], 1);
  assert.ok(result2 === 'a' || result2 === 'aa', `expected 'a' or 'aa', got ${result2}`);
  assert.notEqual(result2, 'aaa');
});

test('findWord never returns a blocklisted word', () => {
  const dict = makeDictionary(['cat', 'bad'], ['bad']);
  // letters can form 'bad' but it is blocked; only 'cat' is available from these letters
  // Use letters that can form 'bad' but not 'cat'
  assert.equal(dict.findWord(['B', 'A', 'D']), null);
});

test('findWord respects minLen and returns null if only shorter words are formable', () => {
  const dict = makeDictionary(['at', 'cat']);
  // 'at' is length 2; with minLen=3 it should not be returned
  assert.equal(dict.findWord(['A', 'T'], 3), null);
  assert.equal(dict.findWord(['A', 'T'], 2), 'at');
});
