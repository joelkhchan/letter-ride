// test/patterns.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { hasDigraph, hasDoubledLetter, isPalindrome, endsWith, countOf } from '../src/patterns.js';

test('hasDigraph finds any of the given digraphs (case-insensitive)', () => {
  assert.equal(hasDigraph('THaw', ['TH', 'QU']), true);
  assert.equal(hasDigraph('quiet', ['TH', 'QU']), true);
  assert.equal(hasDigraph('cat', ['TH', 'QU']), false);
});
test('hasDoubledLetter detects consecutive repeats', () => {
  assert.equal(hasDoubledLetter('ball'), true);
  assert.equal(hasDoubledLetter('LL'), true);
  assert.equal(hasDoubledLetter('cat'), false);
});
test('isPalindrome', () => {
  assert.equal(isPalindrome('level'), true);
  assert.equal(isPalindrome('NOON'), true);
  assert.equal(isPalindrome('cat'), false);
  assert.equal(isPalindrome('a'), false);   // length < 2 is not a palindrome word
});
test('endsWith is case-insensitive', () => {
  assert.equal(endsWith('RUNNING', 'ing'), true);
  assert.equal(endsWith('cat', 'ing'), false);
});
test('countOf counts a letter in a letters array (case-insensitive)', () => {
  assert.equal(countOf(['E', 'e', 'A'], 'E'), 2);
  assert.equal(countOf(['A', 'B'], 'Z'), 0);
});
