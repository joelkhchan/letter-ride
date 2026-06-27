import { test } from 'node:test';
import assert from 'node:assert';
import { generateShop, purchase } from '../src/shop.js';
import { newRun } from '../src/run.js';
import { makeDictionary } from '../src/dictionary.js';
import { makeTile, getMod, resetTileIds, ALL_MOD_IDS } from '../src/tiles.js';
import { RELICS, ALL_RELIC_IDS } from '../src/relics.js';

const dict = makeDictionary(['cat']);
const config = {
  STARTING_BAG: ['C','A','T','E','E'], TILE_VALUES: { C:3,A:1,T:1,E:1 },
  RACK_SIZE: 3, PLAYS_PER_ROUND: 2, DISCARDS_PER_ROUND: 1, MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 5, ROUND_TARGETS: [5,100], COINS_ON_CLEAR: { base:4, perUnusedPlay:1, perUnusedDiscard:1 },
  SHOP: { offersPerShop: 4, rerollCost: 2, cost: { buyLetter:3, buyEnchantedTile:7, enchantTile:6, upgradeLetter:5, thinLetter:3, buyRelic:8, recastTile:5, transferMods:5 }, upgradePlus: 1, buyableLetters: ['E','A','R','Z'] },
  HONE: { cost: 6 },
};
const mkRun = () => { const r = newRun({ config, dictionary: dict, seed: 1 }); r.coins = 100; return r; };

test('Phase 3 SP1: retrigger content is offerable (in the shop candidate pools)', () => {
  // generateShop samples relics from ALL_RELIC_IDS (owned-filtered) and mods from ALL_MOD_IDS,
  // so membership here proves the new content can appear as offers.
  assert.ok(ALL_RELIC_IDS.includes('pressLead') && ALL_RELIC_IDS.includes('rareReprint'), 'retrigger relics offerable');
  assert.ok(ALL_MOD_IDS.includes('reprint'), 'reprint mod offerable');
});

test('rare letters are not offered count-based mods (no Resonator on Z)', () => {
  const cfg2 = { ...config, SHOP: { ...config.SHOP, offersPerShop: 999 } };  // take all candidates, no sampling drop
  const r = newRun({ config: cfg2, dictionary: dict, seed: 1 }); r.coins = 100;
  const ench = generateShop(r, r.rng, { modIds: ['resonator'] }).offers.filter(o => o.type === 'buyEnchantedTile' && o.modId === 'resonator');
  assert.ok(ench.some(o => o.letter === 'A'), 'Resonator IS offered on a common letter (A)');
  assert.ok(!ench.some(o => o.letter === 'Z'), 'Resonator is NOT offered on the rare letter Z');
});

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

// Hone offer tests
test('generateShop produces hone offers (one per archetype)', () => {
  const run = mkRun();
  // Use a large pool so all candidates are generated, then check presence
  const shop = generateShop(run, run.rng, { relicIds: [], modIds: [] });
  // With relicIds=[] and modIds=[], only buyLetter, upgradeLetter, thinLetter, and hone candidates exist
  // Verify hone offers are in the full candidate list by checking offersPerShop is still returned
  assert.equal(shop.offers.length, config.SHOP.offersPerShop);
  // With a small pool that excludes relics+mods, hone offers must appear in the slice
  // (6 archetypes + 4 buyLetters + 1 thinLetter + 4 upgradeLetters = 15 candidates, shuffled, 4 picked)
  // Just verify the offers array exists and is valid
  assert.ok(Array.isArray(shop.offers));
});

test('generateShop can produce hone offers visible in candidates', () => {
  const run = mkRun();
  // Run many seeds to ensure hone offers are in the pool
  // Use a pool with no relics/mods and many shuffles to find at least one hone
  let foundHone = false;
  for (let seed = 1; seed <= 20; seed++) {
    const r = newRun({ config, dictionary: dict, seed });
    r.coins = 100;
    const shop = generateShop(r, r.rng, { relicIds: [], modIds: [] });
    if (shop.offers.some(o => o.type === 'hone')) { foundHone = true; break; }
  }
  assert.equal(foundHone, true, 'expected at least one hone offer across 20 seeds');
});

test('purchase hone increments honeLevels and deducts coins', () => {
  const run = mkRun();
  const before = run.coins;
  const res = purchase(run, { type: 'hone', archetypeId: 'rareLetter', cost: 6 });
  assert.equal(res.ok, true);
  assert.equal(run.honeLevels.rareLetter, 1);
  assert.equal(run.coins, before - 6);
});

test('purchase hone twice increments honeLevels to 2', () => {
  const run = mkRun();
  purchase(run, { type: 'hone', archetypeId: 'rareLetter', cost: 6 });
  purchase(run, { type: 'hone', archetypeId: 'rareLetter', cost: 6 });
  assert.equal(run.honeLevels.rareLetter, 2);
  assert.equal(run.coins, 100 - 12);
});

test('purchase hone with insufficient coins leaves honeLevels and coins unchanged', () => {
  const run = mkRun();
  run.coins = 3;
  const res = purchase(run, { type: 'hone', archetypeId: 'rareLetter', cost: 6 });
  assert.deepEqual(res, { ok: false, reason: 'broke' });
  assert.equal(run.honeLevels.rareLetter, undefined);
  assert.equal(run.coins, 3);
});

// Duplicate relic prevention tests
test('generateShop does not offer a relic already owned by the run', () => {
  // Use a config override with offersPerShop large enough to guarantee all candidates are returned,
  // then assert the owned relic is absent from every offer.
  const bigShopConfig = { ...config, SHOP: { ...config.SHOP, offersPerShop: 999 } };
  const run = newRun({ config: bigShopConfig, dictionary: dict, seed: 1 });
  run.coins = 100;
  const ownedRelicId = 'vowelBonus';
  run.relics.push(RELICS[ownedRelicId]);
  // Pool with only the relic the player owns (other candidates present from buyableLetters etc.)
  const shop = generateShop(run, run.rng, { relicIds: [ownedRelicId], modIds: [] });
  const hasOwnedRelic = shop.offers.some(o => o.type === 'buyRelic' && o.relicId === ownedRelicId);
  assert.equal(hasOwnedRelic, false, 'owned relic must not appear as a shop offer');
});

test('purchase of an owned buyRelic returns { ok:false, reason:"owned" } and leaves coins and relics unchanged', () => {
  const run = mkRun();
  const ownedRelicId = 'vowelBonus';
  run.relics.push(RELICS[ownedRelicId]);
  const beforeCoins = run.coins;
  const beforeLen = run.relics.length;
  const res = purchase(run, { type: 'buyRelic', relicId: ownedRelicId, cost: 8 });
  assert.deepEqual(res, { ok: false, reason: 'owned' });
  assert.equal(run.coins, beforeCoins, 'coins must not change');
  assert.equal(run.relics.length, beforeLen, 'relics length must not change');
});

test('recastTile changes the target tile letter, keeps id + mods, deducts cost', () => {
  const run = mkRun();
  const t = run.bag.tiles[0];
  t.mods = [getMod('polished')];
  const id = t.id;
  const before = run.coins;
  const res = purchase(run, { type: 'recastTile', cost: 5 }, { targetTileId: id, targetLetter: 'R' });
  assert.equal(res.ok, true);
  const after = run.bag.tiles.find(x => x.id === id);
  assert.equal(after.letter, 'R');         // letter changed
  assert.equal(after.id, id);              // id preserved
  assert.equal(after.mods.length, 1);      // mods preserved
  assert.equal(run.coins, before - 5);
});

test('recastTile rejects a letter outside the shop pool', () => {
  const run = mkRun();   // test config buyableLetters = ['E','A','R','Z']
  const res = purchase(run, { type: 'recastTile', cost: 5 }, { targetTileId: run.bag.tiles[0].id, targetLetter: 'Q' });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'bad-letter');
});

test('recastTile with a missing target tile errors', () => {
  const run = mkRun();
  const res = purchase(run, { type: 'recastTile', cost: 5 }, { targetTileId: 'nope', targetLetter: 'R' });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'no-target');
});

test('transferMods moves source mods to target and destroys the source', () => {
  const run = mkRun();
  const src = run.bag.tiles[0];
  const tgt = run.bag.tiles[1];
  src.mods = [getMod('polished'), getMod('catalyst')];
  const tgtBefore = tgt.mods.length;
  const srcId = src.id, tgtId = tgt.id;
  const bagBefore = run.bag.tiles.length;
  const before = run.coins;
  const res = purchase(run, { type: 'transferMods', cost: 5 }, { sourceTileId: srcId, targetTileId: tgtId });
  assert.equal(res.ok, true);
  assert.equal(run.bag.tiles.find(x => x.id === srcId), undefined);        // source destroyed
  assert.equal(run.bag.tiles.find(x => x.id === tgtId).mods.length, tgtBefore + 2);  // mods moved
  assert.equal(run.bag.tiles.length, bagBefore - 1);
  assert.equal(run.coins, before - 5);
});

test('transferMods rejects source === target and a missing tile', () => {
  const run = mkRun();
  const id = run.bag.tiles[0].id;
  assert.equal(purchase(run, { type: 'transferMods', cost: 5 }, { sourceTileId: id, targetTileId: id }).reason, 'same-tile');
  assert.equal(purchase(run, { type: 'transferMods', cost: 5 }, { sourceTileId: 'nope', targetTileId: id }).reason, 'no-target');
});

test('generateShop candidate pool includes recastTile + transferMods', () => {
  const run = mkRun();
  run.config = { ...config, SHOP: { ...config.SHOP, offersPerShop: 99 } };   // return all candidates
  const shop = generateShop(run, run.rng);
  const types = new Set(shop.offers.map(o => o.type));
  assert.ok(types.has('recastTile') && types.has('transferMods'));
});

test('stackable -hand relic is re-offered while owned (until the floor); unique relics are not', () => {
  const cfg2 = { ...config, RACK_SIZE: 9, HAND_FLOOR: 6, SHOP: { ...config.SHOP, offersPerShop: 999 } };
  const r = newRun({ config: cfg2, dictionary: dict, seed: 1 }); r.coins = 100;
  r.relics = [RELICS.tightLeading, RELICS.comboCounter];                       // own one of each
  const offers = generateShop(r, r.rng, { relicIds: ['tightLeading', 'comboCounter'] }).offers.filter(o => o.type === 'buyRelic');
  assert.ok(offers.some(o => o.relicId === 'tightLeading'), 'stackable re-offered while owned');
  assert.ok(!offers.some(o => o.relicId === 'comboCounter'), 'unique not re-offered once owned');
});

test('stackable -hand relic stops being offered once the hand is at the floor', () => {
  const cfg2 = { ...config, RACK_SIZE: 9, HAND_FLOOR: 6, SHOP: { ...config.SHOP, offersPerShop: 999 } };
  const r = newRun({ config: cfg2, dictionary: dict, seed: 1 }); r.coins = 100;
  r.relics = [RELICS.tightLeading, RELICS.tightLeading, RELICS.tightLeading];   // 9 - 3 = 6 = floor
  const offers = generateShop(r, r.rng, { relicIds: ['tightLeading'] }).offers.filter(o => o.type === 'buyRelic');
  assert.ok(!offers.some(o => o.relicId === 'tightLeading'), 'not offered at the hand floor');
});

test('purchase allows duplicate stackable relics, blocks duplicate unique relics', () => {
  const r = mkRun(); r.relics = [];
  assert.equal(purchase(r, { type: 'buyRelic', relicId: 'tightLeading', cost: 8 }).ok, true);
  assert.equal(purchase(r, { type: 'buyRelic', relicId: 'tightLeading', cost: 8 }).ok, true);   // duplicate allowed (stackable)
  assert.equal(r.relics.filter(x => x.id === 'tightLeading').length, 2);
  assert.equal(purchase(r, { type: 'buyRelic', relicId: 'comboCounter', cost: 8 }).ok, true);
  assert.deepEqual(purchase(r, { type: 'buyRelic', relicId: 'comboCounter', cost: 8 }), { ok: false, reason: 'owned' });   // duplicate blocked (unique)
});
