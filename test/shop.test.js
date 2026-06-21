import { test } from 'node:test';
import assert from 'node:assert';
import { generateShop, purchase } from '../src/shop.js';
import { newRun } from '../src/run.js';
import { makeDictionary } from '../src/dictionary.js';
import { makeTile, getMod, resetTileIds } from '../src/tiles.js';

const dict = makeDictionary(['cat']);
const config = {
  STARTING_BAG: ['C','A','T','E','E'], TILE_VALUES: { C:3,A:1,T:1,E:1 },
  RACK_SIZE: 3, PLAYS_PER_ROUND: 2, DISCARDS_PER_ROUND: 1, MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 5, ROUND_TARGETS: [5,100], COINS_ON_CLEAR: { base:4, perUnusedPlay:1, perUnusedDiscard:1 },
  SHOP: { offersPerShop: 4, rerollCost: 2, cost: { buyLetter:3, buyEnchantedTile:7, enchantTile:6, upgradeLetter:5, thinLetter:3, buyRelic:8 }, upgradePlus: 1, buyableLetters: ['E','A','R','Z'] },
};
const mkRun = () => { const r = newRun({ config, dictionary: dict, seed: 1 }); r.coins = 100; return r; };

test('generateShop is deterministic per seed and returns offers + rerollCost', () => {
  const r1 = mkRun(); const r2 = mkRun();
  const s1 = generateShop(r1, r1.rng);
  const s2 = generateShop(r2, r2.rng);
  assert.equal(s1.offers.length, config.SHOP.offersPerShop);
  assert.equal(s1.rerollCost, 2);
  assert.deepEqual(s1.offers, s2.offers);                 // same seed -> same offers
});
test('buyLetter adds a tile and deducts cost', () => {
  const run = mkRun();
  const before = run.bag.tiles.length;
  const res = purchase(run, { type: 'buyLetter', letter: 'R', cost: 3 });
  assert.equal(res.ok, true);
  assert.equal(run.bag.tiles.length, before + 1);
  assert.equal(run.bag.tiles.some(t => t.letter === 'R'), true);
  assert.equal(run.coins, 97);
});
test('not enough coins -> reason broke, no effect', () => {
  const run = mkRun(); run.coins = 1;
  const before = run.bag.tiles.length;
  const res = purchase(run, { type: 'buyLetter', letter: 'R', cost: 3 });
  assert.deepEqual(res, { ok: false, reason: 'broke' });
  assert.equal(run.bag.tiles.length, before);
  assert.equal(run.coins, 1);
});
test('thinLetter removes the targeted tile', () => {
  const run = mkRun();
  const target = run.bag.tiles.find(t => t.letter === 'C');
  const before = run.bag.tiles.length;
  const res = purchase(run, { type: 'thinLetter', letter: 'C', cost: 3 }, { targetTileId: target.id });
  assert.equal(res.ok, true);
  assert.equal(run.bag.tiles.length, before - 1);
  assert.equal(run.bag.tiles.some(t => t.id === target.id), false);
});
test('upgradeLetter raises tileValues for that letter', () => {
  const run = mkRun();
  const res = purchase(run, { type: 'upgradeLetter', letter: 'E', plus: 1, cost: 5 });
  assert.equal(res.ok, true);
  assert.equal(run.tileValues.E, config.TILE_VALUES.E + 1);
});
test('enchantTile attaches a mod to the targeted tile', () => {
  const run = mkRun();
  const target = run.bag.tiles.find(t => t.letter === 'A');
  const res = purchase(run, { type: 'enchantTile', modId: 'polished', cost: 6 }, { targetTileId: target.id });
  assert.equal(res.ok, true);
  assert.equal(target.mods.some(m => m.id === 'polished'), true);
});
test('buyEnchantedTile adds a tile already carrying the mod', () => {
  const run = mkRun();
  const res = purchase(run, { type: 'buyEnchantedTile', letter: 'E', modId: 'catalyst', cost: 7 });
  assert.equal(res.ok, true);
  const added = run.bag.tiles.find(t => t.letter === 'E' && t.mods.some(m => m.id === 'catalyst'));
  assert.ok(added);
});
test('buyRelic adds the relic to the run', () => {
  const run = mkRun();
  const res = purchase(run, { type: 'buyRelic', relicId: 'vowelBonus', cost: 8 });
  assert.equal(res.ok, true);
  assert.equal(run.relics.some(r => r.id === 'vowelBonus'), true);
});
test('enchant/thin without a valid target -> reason no-target', () => {
  const run = mkRun();
  const res = purchase(run, { type: 'thinLetter', letter: 'C', cost: 3 }, { targetTileId: 'nope' });
  assert.deepEqual(res, { ok: false, reason: 'no-target' });
});
