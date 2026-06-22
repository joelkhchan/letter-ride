// test/storage.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { serializeRun, deserializeRun, saveRun, loadRun } from '../src/storage.js';
import { newRun, drawRack, nextRound } from '../src/run.js';
import { makeDictionary } from '../src/dictionary.js';
import { resetTileIds } from '../src/tiles.js';
import { RELICS } from '../src/relics.js';

const dict = makeDictionary(['cat']);
const config = {
  STARTING_BAG: ['C','A','T','E','S'], TILE_VALUES: { C:3, A:1, T:1, E:1, S:1 },
  RACK_SIZE: 3, PLAYS_PER_ROUND: 2, DISCARDS_PER_ROUND: 1, MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 5, ROUND_TARGETS: [5, 100],
};
const fakeStorage = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } }; };

test('round-trip preserves round state, tile ids, rack, and upgraded tileValues', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  drawRack(run);
  run.coins = 4; run.roundTotal = 12; run.tileValues.E = 3;   // simulate an upgrade
  const ids = run.bag.tiles.map(t => t.id);
  const rackIds = run.rack.map(t => t.id);

  const restored = deserializeRun(serializeRun(run), { config, dictionary: dict });
  assert.equal(restored.roundTotal, 12);
  assert.equal(restored.coins, 4);
  assert.equal(restored.tileValues.E, 3);
  assert.deepEqual(restored.bag.tiles.map(t => t.id), ids);       // ids preserved
  assert.deepEqual(restored.rack.map(t => t.id), rackIds);        // same rack
});

test('rng continues the same sequence after restore', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.rng(); run.rng(); run.rng();      // advance to a snapshot point
  const restored = deserializeRun(serializeRun(run), { config, dictionary: dict });
  // both rngs now sit at the same post-3-calls state; they must resume identically
  assert.equal(restored.rng(), run.rng());
});

test('loadRun returns null when absent', () => {
  assert.equal(loadRun(fakeStorage(), { config, dictionary: dict }), null);
});

test('loadRun returns null (no throw) on corrupt or stale-version save', () => {
  const s = fakeStorage();
  s.setItem('letterRide.run', '{ not valid json');
  assert.equal(loadRun(s, { config, dictionary: dict }), null);
  s.setItem('letterRide.run', JSON.stringify({ version: 999 }));
  assert.equal(loadRun(s, { config, dictionary: dict }), null);
});

test('saveRun then loadRun reconstructs the run', () => {
  resetTileIds();
  const s = fakeStorage();
  const run = newRun({ config, dictionary: dict, seed: 9 });
  drawRack(run);
  saveRun(run, s);
  const loaded = loadRun(s, { config, dictionary: dict });
  assert.equal(loaded.seed, 9);
  assert.deepEqual(loaded.rack.map(t => t.id), run.rack.map(t => t.id));
});

test('owned relics survive save -> load with a working evaluate', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  drawRack(run);
  run.relics = [RELICS.vowelBonus];
  const restored = deserializeRun(serializeRun(run), { config, dictionary: dict });
  assert.equal(restored.relics.length, 1);
  assert.equal(restored.relics[0].id, 'vowelBonus');
  assert.equal(typeof restored.relics[0].evaluate, 'function');
});

test('deserializeRun -> nextRound resets playsLeft/discardsLeft from persisted per-round values', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1,
    stake: { playsDelta: -1, discardsDelta: 0 },
    loadout: { extraDiscards: 1, startCoins: 0, startRelics: [] } });
  const restored = deserializeRun(serializeRun(run), { config, dictionary: dict });
  nextRound(restored);
  assert.equal(restored.playsLeft, config.PLAYS_PER_ROUND - 1);
  assert.equal(restored.discardsLeft, config.DISCARDS_PER_ROUND + 1);
});

test('lastAward survives serialize -> deserialize', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.lastAward = [{ label: 'Base score', amount: 10 }, { label: 'Bonus', amount: 5 }];
  const restored = deserializeRun(serializeRun(run), { config, dictionary: dict });
  assert.deepEqual(restored.lastAward, run.lastAward);
});

test('honeLevels survives serialize -> deserialize', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.honeLevels = { rareLetter: 3 };
  const restored = deserializeRun(serializeRun(run), { config, dictionary: dict });
  assert.deepEqual(restored.honeLevels, { rareLetter: 3 });
});

test('honeLevels deserializes to {} when missing from save', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  const serialized = serializeRun(run);
  delete serialized.honeLevels;  // simulate pre-archetype save
  const restored = deserializeRun(serialized, { config, dictionary: dict });
  assert.deepEqual(restored.honeLevels, {});
});

test('wildcardRares enabler field survives serialize -> deserialize', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  drawRack(run);
  run.relics = [RELICS.wildcardRares];
  const restored = deserializeRun(serializeRun(run), { config, dictionary: dict });
  assert.ok(restored.relics.some(r => r.enabler === 'wildsAreRare'));
});
