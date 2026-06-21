import { test } from 'node:test';
import assert from 'node:assert';
import { makeDictionary } from '../src/dictionary.js';

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
