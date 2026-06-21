import { test } from 'node:test';
import assert from 'node:assert';
import { makeMetaState, saveMeta, loadMeta, metaEarned } from '../src/meta.js';

const config = {
  ROUND_TARGETS: [40,70,110,160,230,320,440,600],
  META: { earn: { perRoundCleared: 2, winBonus: 10 },
    baseUnlocked: { relics: ['vowelBonus'], mods: ['polished'], decks: ['standard'], stakes: [0] },
    unlockCost: { relic: 15, mod: 12, deck: 20, stake: 10 } },
};
const fakeStorage = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k,v) => { m[k]=v; } }; };

test('makeMetaState seeds from baseUnlocked, meta starts at 0', () => {
  const m = makeMetaState(config);
  assert.equal(m.meta, 0);
  assert.deepEqual(m.unlockedRelics, ['vowelBonus']);
  assert.deepEqual(m.unlockedStakes, [0]);
  assert.deepEqual(m.loadout, { extraDiscards: 0, startCoins: 0, startRelic: 0 });
});
test('save/load round-trips; absent -> fresh', () => {
  const s = fakeStorage();
  assert.equal(loadMeta(s, config).meta, 0);          // absent -> fresh
  const m = makeMetaState(config); m.meta = 42; m.unlockedRelics.push('lengthy');
  saveMeta(m, s);
  const back = loadMeta(s, config);
  assert.equal(back.meta, 42);
  assert.ok(back.unlockedRelics.includes('lengthy'));
});
test('loadMeta tolerates corrupt JSON -> fresh', () => {
  const s = fakeStorage(); s.setItem('letterRide.meta', '{bad');
  assert.equal(loadMeta(s, config).meta, 0);
});
test('metaEarned: win pays all rounds + bonus; loss pays rounds cleared', () => {
  const won = { status: 'won', roundIndex: 7, targets: config.ROUND_TARGETS };
  assert.equal(metaEarned(won, config), 8 * 2 + 10);   // 8 rounds *2 + 10 = 26
  const lost = { status: 'lost', roundIndex: 3, targets: config.ROUND_TARGETS };
  assert.equal(metaEarned(lost, config), 3 * 2);        // cleared 3 -> 6
});
