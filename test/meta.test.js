import { test } from 'node:test';
import assert from 'node:assert';
import { makeMetaState, saveMeta, loadMeta, metaEarned, poolFromMeta, applyStakeTargets, buildLoadout, metaShopOffers, purchaseMeta } from '../src/meta.js';
import { CONFIG } from '../src/config.js';

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
  assert.deepEqual(m.loadout, { extraDiscards: 0 });
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
test('poolFromMeta exposes the unlocked relic/mod ids', () => {
  const m = makeMetaState(config); m.unlockedRelics.push('lengthy');
  assert.deepEqual(poolFromMeta(m), { relicIds: ['vowelBonus','lengthy'], modIds: ['polished'] });
});
test('applyStakeTargets scales targets by targetMult (ceil)', () => {
  assert.deepEqual(applyStakeTargets([40,70], { targetMult: 1.25 }), [50, 88]);
  assert.deepEqual(applyStakeTargets([40,70], null), [40, 70]);    // no stake -> unchanged
});
test('metaShopOffers lists locked content + loadout below max', () => {
  const cfg2 = {
    ...config,
    DECKS: { standard: { id:'standard' }, vowelHeavy: { id:'vowelHeavy' } },
    STAKES: [{ id:0 }, { id:1 }],
    LOADOUT: { extraDiscards: { max:2, cost:10 }, startCoins: { max:2, cost:8 }, startRelic: { max:1, cost:25, relicId:'vowelBonus' } },
  };
  const ALL_RELICS = ['vowelBonus','lengthy','rareHoarder'];
  const ALL_MODS = ['polished','catalyst'];
  const m = makeMetaState(cfg2);
  const offers = metaShopOffers(m, cfg2, ALL_RELICS, ALL_MODS);
  assert.ok(offers.some(o => o.type==='unlockRelic' && o.relicId==='lengthy'));
  assert.ok(offers.some(o => o.type==='unlockRelic' && o.relicId==='rareHoarder'));
  assert.ok(!offers.some(o => o.type==='unlockRelic' && o.relicId==='vowelBonus')); // already unlocked
  assert.ok(offers.some(o => o.type==='unlockMod' && o.modId==='catalyst'));
  assert.ok(offers.some(o => o.type==='unlockDeck' && o.deckId==='vowelHeavy'));
  assert.ok(offers.some(o => o.type==='unlockStake' && o.stakeId===1));
  assert.ok(offers.some(o => o.type==='loadout' && o.key==='extraDiscards'));
});
test('purchaseMeta unlocks a relic and deducts meta; broke/owned/maxed handled', () => {
  const cfg2 = {
    ...config,
    DECKS: { standard: { id:'standard' }, vowelHeavy: { id:'vowelHeavy' } },
    STAKES: [{ id:0 }, { id:1 }],
    LOADOUT: { extraDiscards: { max:2, cost:10 }, startCoins: { max:2, cost:8 }, startRelic: { max:1, cost:25, relicId:'vowelBonus' } },
  };
  const m = makeMetaState(cfg2); m.meta = 100;
  assert.deepEqual(purchaseMeta(m, { type:'unlockRelic', relicId:'lengthy', cost:15 }, cfg2), { ok:true });
  assert.ok(m.unlockedRelics.includes('lengthy'));
  assert.equal(m.meta, 85);
  assert.deepEqual(purchaseMeta(m, { type:'unlockRelic', relicId:'lengthy', cost:15 }, cfg2), { ok:false, reason:'owned' });
  m.meta = 1;
  assert.deepEqual(purchaseMeta(m, { type:'unlockRelic', relicId:'rareHoarder', cost:15 }, cfg2), { ok:false, reason:'broke' });
});
test('purchaseMeta increments a loadout level up to max', () => {
  const cfg2 = {
    ...config,
    DECKS: { standard: { id:'standard' }, vowelHeavy: { id:'vowelHeavy' } },
    STAKES: [{ id:0 }, { id:1 }],
    LOADOUT: { extraDiscards: { max:2, cost:10 }, startCoins: { max:2, cost:8 }, startRelic: { max:1, cost:25, relicId:'vowelBonus' } },
  };
  const m = makeMetaState(cfg2); m.meta = 100;
  assert.deepEqual(purchaseMeta(m, { type:'loadout', key:'startRelic', cost:25 }, cfg2), { ok:true });
  assert.equal(m.loadout.startRelic, 1);
  assert.deepEqual(purchaseMeta(m, { type:'loadout', key:'startRelic', cost:25 }, cfg2), { ok:false, reason:'maxed' });
});

// --- Achievements/meta-economy refactor (Task 1) ---
test('loadMeta refunds Meta spent on removed loadout perks exactly once', () => {
  const store = new Map();
  store.set('letterRide.meta', JSON.stringify({
    meta: 0, unlockedRelics: [], unlockedMods: [], unlockedDecks: [], unlockedStakes: [0],
    loadout: { extraDiscards: 1, startCoins: 2, startRelic: 1 },
  }));
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const m = loadMeta(storage, CONFIG);
  assert.equal(m.meta, 41);                 // 2*8 + 1*25
  assert.equal(m.loadout.extraDiscards, 1);
  assert.equal(m.loadout.startCoins, undefined);
  assert.equal(m.loadout.startRelic, undefined);
  assert.equal(m.schemaVersion, 2);
  storage.setItem('letterRide.meta', JSON.stringify(m));
  const m2 = loadMeta(storage, CONFIG);
  assert.equal(m2.meta, 41);                // idempotent
});

test('config drops the removed economy perks but keeps the modest loadout perks', () => {
  assert.equal(CONFIG.LOADOUT.startCoins, undefined);
  assert.equal(CONFIG.LOADOUT.startRelic, undefined);
  assert.ok(CONFIG.LOADOUT.extraDiscards);
  assert.ok(CONFIG.LOADOUT.freeReroll);
  assert.ok(CONFIG.LOADOUT.round1Play);
  assert.ok(CONFIG.META.achievement && CONFIG.META.bounty);
  assert.ok(CONFIG.LEVELS && Array.isArray(CONFIG.LEVELS.thresholds));
});

test('buildLoadout surfaces extraDiscards, freeRerolls, and round1ExtraPlay', () => {
  const m = makeMetaState(CONFIG);
  m.loadout.extraDiscards = 2; m.loadout.freeReroll = 1; m.loadout.round1Play = 1;
  const lo = buildLoadout(m, CONFIG, {});
  assert.equal(lo.extraDiscards, 2);
  assert.equal(lo.freeRerolls, 1);
  assert.equal(lo.round1ExtraPlay, 1);
  assert.deepEqual(lo.startRelics, []);
});

test('STAKES no longer carry metaMult', () => {
  assert.ok(CONFIG.STAKES.every(s => s.metaMult === undefined));
});
