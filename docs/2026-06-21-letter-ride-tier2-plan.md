# Letter Ride — Tier 2 (Meta-Progression) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the run-over-run loop — a persistent **Meta** currency earned each run, spent in a between-runs **meta-shop** on all four categories (content unlocks, difficulty stakes, decks, loadout upgrades), with deck + stake chosen at run start.

**Architecture:** A new pure `meta.js` owns `MetaState` (persisted separately from the run) and the meta-shop logic. `run.js`'s `newRun` gains stake + loadout application (deck was already supported via `deck.startingBag`). The in-run shop reads its relic/mod pool from `MetaState` via the seam already built in Tier 1 (`generateShop(run, rng, pool)`). `meta.js` may import `RELICS` (content/glue); `run.js` stays RELICS-free (loadout relic objects are resolved in `meta.js` and passed in). The title screen becomes the meta-shop + deck/stake pickers.

**Tech Stack:** Vanilla JS ESM, `node --test`, no build step.

**Source docs:** design `docs/2026-06-20-letter-ride-design.md` §9; roadmap `docs/2026-06-20-letter-ride-plan.md`; Tier 1 plan (built, 59 tests). Tier 3 (Capacitor) follows.

## Global Constraints

- **Three currencies:** Points (in-round), Coins (in-run), **Meta** (this tier — persistent, between-runs). `MetaState` persists to localStorage key `'letterRide.meta'`, **separate** from the run key `'letterRide.run'`.
- **Determinism / DI:** no `Math.random()` in logic; `run.js` does not import `RELICS` (loadout relic objects resolved in `meta.js`). Tests inject tiny configs.
- **Pool seam (from Tier 1):** `generateShop(run, rng, pool)` already gates on `pool.relicIds`/`pool.modIds`. Tier 2 supplies `poolFromMeta(metaState)`; no shop signature change.
- **Wilds enter via a deck** (the `wildcard` deck's starting bag contains `'*'` tiles) — no new shop offer type.
- **Design choices made (all in `config.js`, tunable — flag for review):** fresh `MetaState` base-unlocks 6 of 8 relics + all 4 mods + the `standard` deck + base stake; it **locks** `rareHoarder` + `doubleTrouble`, the `vowelHeavy` + `wildcard` decks, and stakes 1–2, behind Meta. To start with everything unlocked, add ids to `CONFIG.META.baseUnlocked`.
- **Back-compat:** a fresh `MetaState` with the base unlocks reproduces the Tier-1 experience minus the 2 locked relics; `loadMeta` returns `makeMetaState(config)` when no save exists.

## File Structure (Tier 2)

| File | Responsibility | New/Mod |
|---|---|---|
| `src/config.js` | + `META` (earn, baseUnlocked, unlockCost), `DECKS`, `STAKES`, `LOADOUT`. | Mod |
| `src/meta.js` | `MetaState`, persistence, `metaEarned`, `poolFromMeta`, `buildLoadout`, `applyStakeTargets`, `metaShopOffers`, `purchaseMeta`. | New |
| `src/run.js` | `newRun` applies stake (plays/discards deltas) + loadout (extraDiscards/startCoins/startRelics). | Mod |
| `src/main.js`, `src/ui.js` | Title = meta-shop + deck/stake pickers + Start Run; run-end → meta earned → meta screen; in-run shop pool from meta. | Mod |
| `test/meta.test.js`, `test/run.test.js` | Tests. | New/Mod |

---

### Task 17: config META/DECKS/STAKES/LOADOUT + MetaState + metaEarned

**Files:** Modify `src/config.js`; create `src/meta.js`, `test/meta.test.js`.
**Interfaces — Produces:**
- `makeMetaState(config) -> { meta, unlockedRelics:[], unlockedMods:[], unlockedDecks:[], unlockedStakes:[], loadout:{extraDiscards,startCoins,startRelic} }` seeded from `config.META.baseUnlocked`.
- `saveMeta(metaState, storage)` / `loadMeta(storage, config) -> MetaState` (key `'letterRide.meta'`; absent → `makeMetaState(config)`; corrupt → `makeMetaState(config)`).
- `metaEarned(run, config) -> number`.

- [ ] **Step 1: Add config** — inside `CONFIG` in `src/config.js`:

```javascript
  META: {
    earn: { perRoundCleared: 2, winBonus: 10 },
    baseUnlocked: {
      relics: ['vowelBonus','shortAndSweet','lengthy','freshStart','comboCounter','recycler'],
      mods: ['resonator','polished','catalyst','anchor'],
      decks: ['standard'],
      stakes: [0],
    },
    unlockCost: { relic: 15, mod: 12, deck: 20, stake: 10 },
  },
  DECKS: {
    standard:   { id: 'standard',   name: 'Standard',    startingBag: null },  // null => CONFIG.STARTING_BAG
    vowelHeavy: { id: 'vowelHeavy', name: 'Vowel Heavy', startingBag: ['A','A','A','A','E','E','E','E','I','I','O','O','U','U','R','S','T','L','N','D','C','M','B','P','G','H'] },
    wildcard:   { id: 'wildcard',   name: 'Wildcard',    startingBag: ['A','A','A','E','E','E','I','I','O','O','U','R','S','T','L','N','D','C','M','B','P','G','H','F','*','*'] },
  },
  STAKES: [
    { id: 0, name: 'Stake 0', targetMult: 1.0,  playsDelta: 0,  discardsDelta: 0,  metaMult: 1.0 },
    { id: 1, name: 'Stake 1', targetMult: 1.25, playsDelta: 0,  discardsDelta: 0,  metaMult: 1.5 },
    { id: 2, name: 'Stake 2', targetMult: 1.5,  playsDelta: -1, discardsDelta: 0,  metaMult: 2.0 },
  ],
  LOADOUT: {
    extraDiscards: { name: '+1 Discard / round', max: 2, cost: 10 },
    startCoins:    { name: '+5 starting Coins',  max: 2, cost: 8 },   // each level = +5 coins
    startRelic:    { name: 'Start with Vowel Bonus', max: 1, cost: 25, relicId: 'vowelBonus' },
  },
```

- [ ] **Step 2: Write the failing test** (`test/meta.test.js`)

```javascript
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
```

- [ ] **Step 3: Run to verify it fails** — `node --test test/meta.test.js` — FAIL.

- [ ] **Step 4: Implement** `src/meta.js` (Task 17 portion):

```javascript
// src/meta.js — persistent meta-progression state + earn.
const META_KEY = 'letterRide.meta';

export function makeMetaState(config) {
  const b = config.META.baseUnlocked;
  return {
    meta: 0,
    unlockedRelics: [...b.relics],
    unlockedMods: [...b.mods],
    unlockedDecks: [...b.decks],
    unlockedStakes: [...b.stakes],
    loadout: { extraDiscards: 0, startCoins: 0, startRelic: 0 },
  };
}

export function saveMeta(metaState, storage) {
  storage.setItem(META_KEY, JSON.stringify(metaState));
}

export function loadMeta(storage, config) {
  const raw = storage.getItem(META_KEY);
  if (!raw) return makeMetaState(config);
  try {
    const data = JSON.parse(raw);
    const base = makeMetaState(config);
    return { ...base, ...data, loadout: { ...base.loadout, ...(data.loadout || {}) } };
  } catch {
    return makeMetaState(config);
  }
}

export function metaEarned(run, config) {
  const cleared = run.status === 'won' ? run.targets.length : run.roundIndex;
  const e = config.META.earn;
  return cleared * e.perRoundCleared + (run.status === 'won' ? e.winBonus : 0);
}
```

- [ ] **Step 5: Run to verify it passes** — `node --test test/meta.test.js`, then `npm test` — PASS.

- [ ] **Step 6: Commit** — `git add src/config.js src/meta.js test/meta.test.js && git commit -m "feat: MetaState, persistence, and meta earn"`

---

### Task 18: newRun applies stake + loadout

**Files:** Modify `src/run.js`; modify `test/run.test.js`.
**Interfaces — Consumes:** `newRun({ config, dictionary, seed, targets, deck, stake, loadout })` — `stake` is a STAKES entry (`{playsDelta,discardsDelta,...}`), `loadout` is `{ extraDiscards, startCoins, startRelics:[relicObj] }` (relic OBJECTS, resolved by caller — keeps run.js RELICS-free).
**Produces:** newRun now sets `playsLeft = PLAYS_PER_ROUND + (stake.playsDelta||0)`, `discardsLeft = DISCARDS_PER_ROUND + (stake.discardsDelta||0) + (loadout.extraDiscards||0)`, `coins = loadout.startCoins||0`, `relics = [...(loadout.startRelics||[])]`.

- [ ] **Step 1: Write the failing test** (append to `test/run.test.js`)

```javascript
test('newRun applies a stake (plays delta) and loadout (extra discards, start coins, start relic)', () => {
  resetTileIds();
  const relic = { id: 'startTest', evaluate: () => ({}) };
  const run = newRun({
    config, dictionary: dict, seed: 1,
    stake: { playsDelta: -1, discardsDelta: 0 },
    loadout: { extraDiscards: 1, startCoins: 5, startRelics: [relic] },
  });
  assert.equal(run.playsLeft, config.PLAYS_PER_ROUND - 1);
  assert.equal(run.discardsLeft, config.DISCARDS_PER_ROUND + 1);
  assert.equal(run.coins, 5);
  assert.deepEqual(run.relics.map(r => r.id), ['startTest']);
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/run.test.js` — FAIL (current newRun ignores stake/loadout deltas, coins 0, relics []).

- [ ] **Step 3: Implement** — in `src/run.js`, update `newRun`. Change the relevant field initializers (keep everything else):

```javascript
export function newRun({ config, dictionary, seed, targets = config.ROUND_TARGETS, deck = null, stake = null, loadout = {} }) {
  const letters = (deck && deck.startingBag) || config.STARTING_BAG;
  return {
    config, dictionary,
    seed, rng: makeRng(seed),
    targets,
    roundIndex: 0,
    target: targets[0],
    roundTotal: 0,
    playsLeft: config.PLAYS_PER_ROUND + (stake?.playsDelta || 0),
    discardsLeft: config.DISCARDS_PER_ROUND + (stake?.discardsDelta || 0) + (loadout.extraDiscards || 0),
    bag: makeBag(letters.map(l => makeTile(l))),
    tileValues: { ...config.TILE_VALUES },
    relics: [...(loadout.startRelics || [])],
    coins: loadout.startCoins || 0,
    rack: [],
    wordsPlayedThisRound: 0,
    stake, deck,
    status: 'playing',
  };
}
```

**Note:** `nextRound` already resets `playsLeft`/`discardsLeft` to the *base* config values; for the slice, the stake delta and loadout extraDiscards apply to round 1 (the values nextRound resets to don't re-apply them). If you want stake/loadout to persist every round, change `nextRound` to use the same deltas — but per YAGNI and to match how Balatro hands/discards reset, keep the simple base reset for now and flag it. (Round 1 gets the boost; later rounds reset to base.) **Decision flagged for playtest.**

Actually — to avoid a surprising "boost only on round 1," make `nextRound` reset using the same deltas. Add to `run.js` `newRun` a stored `run.playsPerRound` and `run.discardsPerRound` computed once, and have `nextRound` reset to those:

```javascript
// in newRun, add:
    playsPerRound: config.PLAYS_PER_ROUND + (stake?.playsDelta || 0),
    discardsPerRound: config.DISCARDS_PER_ROUND + (stake?.discardsDelta || 0) + (loadout.extraDiscards || 0),
```
and set `playsLeft: <that>`, `discardsLeft: <that>`. Then in `nextRound`, change the resets to:
```javascript
  run.playsLeft = run.playsPerRound;
  run.discardsLeft = run.discardsPerRound;
```
(Falls back correctly: a run created without stake/loadout has `playsPerRound === config.PLAYS_PER_ROUND`.) Update the test to also assert round-2 retains the boost if you wire this; the minimal test above only checks round 1.

- [ ] **Step 4: Run to verify it passes** — `node --test test/run.test.js`, then `npm test` (the Tier-0/1 run tests must still pass — they call newRun without stake/loadout, so `playsPerRound` defaults to config). PASS.

- [ ] **Step 5: Commit** — `git add src/run.js test/run.test.js && git commit -m "feat: newRun applies stake and loadout boosts"`

---

### Task 19: meta→run glue (pool, loadout build, stake targets)

**Files:** Modify `src/meta.js`; modify `test/meta.test.js`.
**Interfaces — Produces (in `meta.js`):**
- `poolFromMeta(metaState) -> { relicIds, modIds }` (= the unlocked sets).
- `applyStakeTargets(baseTargets, stake) -> number[]` (`baseTargets.map(t => Math.ceil(t * (stake?.targetMult ?? 1)))`).
- `buildLoadout(metaState, config, RELICS) -> { extraDiscards, startCoins, startRelics:[relicObj] }` — translates loadout levels into run-applicable values (startCoins level × 5; startRelic level → `[RELICS[CONFIG.LOADOUT.startRelic.relicId]]`). `RELICS` passed in to keep meta.js testable with a fixture.

- [ ] **Step 1: Write the failing test** (append to `test/meta.test.js`)

```javascript
import { poolFromMeta, applyStakeTargets, buildLoadout } from '../src/meta.js';

test('poolFromMeta exposes the unlocked relic/mod ids', () => {
  const m = makeMetaState(config); m.unlockedRelics.push('lengthy');
  assert.deepEqual(poolFromMeta(m), { relicIds: ['vowelBonus','lengthy'], modIds: ['polished'] });
});
test('applyStakeTargets scales targets by targetMult (ceil)', () => {
  assert.deepEqual(applyStakeTargets([40,70], { targetMult: 1.25 }), [50, 88]);
  assert.deepEqual(applyStakeTargets([40,70], null), [40, 70]);    // no stake -> unchanged
});
test('buildLoadout translates levels into run values', () => {
  const cfg = { LOADOUT: { startCoins: { max:2 }, startRelic: { max:1, relicId:'vowelBonus' }, extraDiscards: { max:2 } } };
  const RELICS = { vowelBonus: { id: 'vowelBonus' } };
  const m = { loadout: { extraDiscards: 1, startCoins: 2, startRelic: 1 } };
  const lo = buildLoadout(m, cfg, RELICS);
  assert.equal(lo.extraDiscards, 1);
  assert.equal(lo.startCoins, 10);            // 2 levels * 5
  assert.deepEqual(lo.startRelics.map(r => r.id), ['vowelBonus']);
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/meta.test.js` — FAIL.

- [ ] **Step 3: Implement** — add to `src/meta.js`:

```javascript
export function poolFromMeta(metaState) {
  return { relicIds: metaState.unlockedRelics, modIds: metaState.unlockedMods };
}

export function applyStakeTargets(baseTargets, stake) {
  const mult = stake?.targetMult ?? 1;
  return baseTargets.map(t => Math.ceil(t * mult));
}

export function buildLoadout(metaState, config, RELICS) {
  const lo = metaState.loadout || {};
  const startRelics = [];
  if ((lo.startRelic || 0) > 0) {
    const r = RELICS[config.LOADOUT.startRelic.relicId];
    if (r) startRelics.push(r);
  }
  return {
    extraDiscards: lo.extraDiscards || 0,
    startCoins: (lo.startCoins || 0) * 5,
    startRelics,
  };
}
```

- [ ] **Step 4: Run to verify it passes** — `node --test test/meta.test.js`, then `npm test` — PASS.

- [ ] **Step 5: Commit** — `git add src/meta.js test/meta.test.js && git commit -m "feat: meta->run glue (pool, stake targets, loadout build)"`

---

### Task 20: meta-shop offers + purchaseMeta (all four categories)

**Files:** Modify `src/meta.js`; modify `test/meta.test.js`.
**Interfaces — Produces:**
- `metaShopOffers(metaState, config) -> Offer[]` where Offer ∈ `{type:'unlockRelic',relicId,cost}` | `{type:'unlockMod',modId,cost}` | `{type:'unlockDeck',deckId,cost}` | `{type:'unlockStake',stakeId,cost}` | `{type:'loadout',key,cost}`. Lists every still-locked relic/mod/deck/stake (from `ALL_RELIC_IDS`/`ALL_MOD_IDS`/`config.DECKS`/`config.STAKES` minus the unlocked sets) and every loadout key below its `max`.
- `purchaseMeta(metaState, offer, config) -> { ok, reason? }` — checks `metaState.meta >= offer.cost`; applies (push id into the matching unlocked set / increment `loadout[key]`); deducts; reasons `'broke'` / `'owned'` / `'maxed'`.

- [ ] **Step 1: Write the failing test** (append to `test/meta.test.js`)

```javascript
import { metaShopOffers, purchaseMeta } from '../src/meta.js';

const cfg2 = {
  ...config,
  DECKS: { standard: { id:'standard' }, vowelHeavy: { id:'vowelHeavy' } },
  STAKES: [{ id:0 }, { id:1 }],
  LOADOUT: { extraDiscards: { max:2, cost:10 }, startCoins: { max:2, cost:8 }, startRelic: { max:1, cost:25, relicId:'vowelBonus' } },
};
const ALL_RELICS = ['vowelBonus','lengthy','rareHoarder'];
const ALL_MODS = ['polished','catalyst'];

test('metaShopOffers lists locked content + loadout below max', () => {
  const m = makeMetaState(cfg2);   // unlocks: relics[vowelBonus], mods[polished], decks[standard], stakes[0]
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
  const m = makeMetaState(cfg2); m.meta = 100;
  assert.deepEqual(purchaseMeta(m, { type:'unlockRelic', relicId:'lengthy', cost:15 }, cfg2), { ok:true });
  assert.ok(m.unlockedRelics.includes('lengthy'));
  assert.equal(m.meta, 85);
  assert.deepEqual(purchaseMeta(m, { type:'unlockRelic', relicId:'lengthy', cost:15 }, cfg2), { ok:false, reason:'owned' });
  m.meta = 1;
  assert.deepEqual(purchaseMeta(m, { type:'unlockRelic', relicId:'rareHoarder', cost:15 }, cfg2), { ok:false, reason:'broke' });
});
test('purchaseMeta increments a loadout level up to max', () => {
  const m = makeMetaState(cfg2); m.meta = 100;
  assert.deepEqual(purchaseMeta(m, { type:'loadout', key:'startRelic', cost:25 }, cfg2), { ok:true });
  assert.equal(m.loadout.startRelic, 1);
  assert.deepEqual(purchaseMeta(m, { type:'loadout', key:'startRelic', cost:25 }, cfg2), { ok:false, reason:'maxed' });
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/meta.test.js` — FAIL.

- [ ] **Step 3: Implement** — add to `src/meta.js` (note: `metaShopOffers`/`purchaseMeta` take `allRelicIds`/`allModIds` so meta.js need not import tiles/relics for the id universe — main.js passes `ALL_RELIC_IDS`/`ALL_MOD_IDS`):

```javascript
export function metaShopOffers(metaState, config, allRelicIds, allModIds) {
  const offers = [];
  const c = config.META.unlockCost;
  for (const id of allRelicIds) if (!metaState.unlockedRelics.includes(id)) offers.push({ type: 'unlockRelic', relicId: id, cost: c.relic });
  for (const id of allModIds) if (!metaState.unlockedMods.includes(id)) offers.push({ type: 'unlockMod', modId: id, cost: c.mod });
  for (const id of Object.keys(config.DECKS)) if (!metaState.unlockedDecks.includes(id)) offers.push({ type: 'unlockDeck', deckId: id, cost: c.deck });
  for (const s of config.STAKES) if (!metaState.unlockedStakes.includes(s.id)) offers.push({ type: 'unlockStake', stakeId: s.id, cost: c.stake });
  for (const key of Object.keys(config.LOADOUT)) if ((metaState.loadout[key] || 0) < config.LOADOUT[key].max) offers.push({ type: 'loadout', key, cost: config.LOADOUT[key].cost });
  return offers;
}

export function purchaseMeta(metaState, offer, config) {
  if (metaState.meta < offer.cost) return { ok: false, reason: 'broke' };
  const addUnique = (arr, id) => { if (arr.includes(id)) return false; arr.push(id); return true; };
  switch (offer.type) {
    case 'unlockRelic': if (!addUnique(metaState.unlockedRelics, offer.relicId)) return { ok: false, reason: 'owned' }; break;
    case 'unlockMod':   if (!addUnique(metaState.unlockedMods, offer.modId))   return { ok: false, reason: 'owned' }; break;
    case 'unlockDeck':  if (!addUnique(metaState.unlockedDecks, offer.deckId)) return { ok: false, reason: 'owned' }; break;
    case 'unlockStake': if (!addUnique(metaState.unlockedStakes, offer.stakeId)) return { ok: false, reason: 'owned' }; break;
    case 'loadout': {
      const cur = metaState.loadout[offer.key] || 0;
      if (cur >= config.LOADOUT[offer.key].max) return { ok: false, reason: 'maxed' };
      metaState.loadout[offer.key] = cur + 1;
      break;
    }
    default: return { ok: false, reason: 'unknown' };
  }
  metaState.meta -= offer.cost;
  return { ok: true };
}
```

- [ ] **Step 4: Run to verify it passes** — `node --test test/meta.test.js`, then `npm test` — PASS.

- [ ] **Step 5: Commit** — `git add src/meta.js test/meta.test.js && git commit -m "feat: meta-shop offers + purchaseMeta (unlocks, stakes, decks, loadout)"`

---

### Task 21: Wire the meta screen + run start into the UI

**Files:** Modify `src/main.js`, `src/ui.js`. (Manual-verify.)
**Interfaces:** the app boots to a **meta screen** (title): shows Meta balance, a meta-shop (offers from `metaShopOffers`, buy via `purchaseMeta`), deck + stake pickers (from unlocked sets), and a **Start Run** button. Starting a run builds the run from MetaState (deck/stake/loadout + pool). Run end (win/lose) awards Meta (`metaEarned`, ×`stake.metaMult`), persists MetaState, and returns to the meta screen. The in-run shop pool comes from `poolFromMeta`.

- [ ] **Step 1: `main.js`** — restructure boot around two phases (meta screen ↔ run). Concrete wiring:

```javascript
import { CONFIG } from './config.js';
import { loadFromFile } from './dictionary.js';
import { newRun, drawRack, playWord, discard, nextRound } from './run.js';
import { saveRun, loadRun } from './storage.js';
import { generateShop, purchase } from './shop.js';
import { RELICS, ALL_RELIC_IDS } from './relics.js';
import { ALL_MOD_IDS } from './tiles.js';
import { makeMetaState, saveMeta, loadMeta, metaEarned, poolFromMeta, applyStakeTargets, buildLoadout, metaShopOffers, purchaseMeta } from './meta.js';
import { renderRun, renderMeta, bindControls, flashInvalid } from './ui.js';

try {
  const blocklist = CONFIG.PROFANITY_FILTER ? CONFIG.PROFANITY_BLOCKLIST : [];
  const dictionary = await loadFromFile('assets/enable1.txt', blocklist);
  const meta = loadMeta(window.localStorage, CONFIG);
  let run = loadRun(window.localStorage, { config: CONFIG, dictionary });   // resume an in-progress run if any
  let view = run ? 'run' : 'meta';

  const saveAll = () => { saveMeta(meta, window.localStorage); if (run) saveRun(run, window.localStorage); };
  const render = () => view === 'run' ? renderRun(run) : renderMeta(meta, CONFIG, ALL_RELIC_IDS, ALL_MOD_IDS);
  const pool = () => poolFromMeta(meta);

  function startRun(deckId, stakeId) {
    const deck = CONFIG.DECKS[deckId] || CONFIG.DECKS.standard;
    const stake = CONFIG.STAKES.find(s => s.id === stakeId) || CONFIG.STAKES[0];
    const targets = applyStakeTargets(CONFIG.ROUND_TARGETS, stake);
    const loadout = buildLoadout(meta, CONFIG, RELICS);
    run = newRun({ config: CONFIG, dictionary, seed: Date.now() >>> 0, targets, deck: { startingBag: deck.startingBag }, stake, loadout });
    drawRack(run); view = 'run'; saveAll(); render();
  }
  function endRun() {
    const earned = Math.round(metaEarned(run, CONFIG) * (run.stake?.metaMult || 1));
    meta.meta += earned; run.lastMetaEarned = earned;       // for the meta screen to show
    window.localStorage.removeItem('letterRide.run'); run = null; view = 'meta'; saveAll(); render();
  }

  // resume safety: a finished run sitting in storage shouldn't strand the player
  if (run && (run.status === 'roundCleared') && !run.shop) run.shop = generateShop(run, run.rng, pool());

  bindControls({
    onSubmit(sel) { const r = playWord(run, sel); if (!r.ok) return flashInvalid(r.reason);
      if (run.status === 'roundCleared') run.shop = generateShop(run, run.rng, pool());
      if (run.status === 'playing') drawRack(run); saveAll(); render(); },
    onDiscard() { discard(run); saveAll(); render(); },
    onBuy(offer, targetTileId) { const r = purchase(run, offer, { targetTileId }); if (r.ok) run.shop = generateShop(run, run.rng, pool()); saveAll(); render(); return r; },
    onReroll() { if (run.coins >= run.shop.rerollCost) { run.coins -= run.shop.rerollCost; run.shop = generateShop(run, run.rng, pool()); saveAll(); render(); } },
    onContinue() { run.shop = null; nextRound(run); if (run.status === 'playing') drawRack(run); saveAll(); render(); },
    // run-end transitions to the meta screen:
    onRunEnd() { endRun(); },
    // meta screen actions:
    onMetaBuy(offer) { const r = purchaseMeta(meta, offer, CONFIG); saveAll(); render(); return r; },
    onStartRun(deckId, stakeId) { startRun(deckId, stakeId); },
  });
  render();
} catch (err) {
  document.getElementById('app').textContent = 'Failed to start Letter Ride: ' + err.message + ' — check that assets/enable1.txt is present and served.';
}
```

- [ ] **Step 2: `ui.js`** — add `renderMeta(meta, config, allRelicIds, allModIds)` and a small change to `renderRun`:
  - `renderMeta`: show "Meta: N", the deck picker (buttons for `meta.unlockedDecks`), the stake picker (buttons for `meta.unlockedStakes`, showing stake name), a **Start Run** button (calls `handlers.onStartRun(selectedDeckId, selectedStakeId)` — track local selection, default standard/0), and the meta-shop: `metaShopOffers(meta, config, allRelicIds, allModIds)` as labeled buttons (e.g. "Unlock relic: Rare Hoarder — 15", "Stake 1 — 10", "+1 Discard/round — 10"), disabled when `meta.meta < cost`, clicking → `handlers.onMetaBuy(offer)`. Use `RELICS[id].name`/deck/stake names for labels (import display names or pass them; for the slice, labeling by id is acceptable but prefer names).
  - `renderRun`: when `run.status === 'won' || 'lost'`, the end panel's button becomes **"Back to menu"** → `handlers.onRunEnd()` (instead of "New run"). Show `run.lastMetaEarned` is computed at endRun, so display "Run over — earning Meta…" then the meta screen shows the new balance. Keep the in-run shop screen from Tier 1 (it already uses `run.shop`).
  - Keep `ui.js` rules-free (it calls handlers; never computes meta/purchase logic).

- [ ] **Step 3: Manual verification** — `npm run serve`, open on desktop + phone. Verify: boot shows the meta screen with Meta 0 and locked content; Start Run (standard/Stake 0) plays a full run; on win/lose, "Back to menu" returns to the meta screen with Meta increased; spend Meta to unlock a relic → it now appears in the in-run shop next run; unlock + pick a stake → targets scale; unlock + pick the Wildcard deck → wild tiles appear in racks; buy a loadout (+1 discard) → next run starts with the boost; reload at any point resumes (run mid-play, or the meta screen).

- [ ] **Step 4: Commit** — `git add src/main.js src/ui.js && git commit -m "feat: Tier 2 meta screen + meta-shop + run-start wired"`

> **🛑 TIER 2 GATE (author playtest).** Per the design, gate on **content unlocks first** — does earning Meta and unlocking a relic make you want another run? Is Meta paced right (tune `META.earn` + `unlockCost`)? Do stakes feel fair (tune `STAKES`)? Do loadout boosts trivialize anything (the balance trap — tune `LOADOUT`)? All dials are in `config.js`.

---

## Self-Review (plan author)

- **Spec coverage (design §9):** Meta currency + earn → Task 17; persistence (separate key) → Task 17; stake/deck/loadout application → Task 18; in-run pool gating → Task 19 (poolFromMeta) + Task 21 wiring; all four meta-shop categories → Task 20; meta screen + pickers → Task 21.
- **Type consistency:** `MetaState` shape defined in Task 17 reused unchanged; `metaShopOffers(metaState, config, allRelicIds, allModIds)` / `purchaseMeta(metaState, offer, config)` consistent Tasks 20/21; `newRun` stake/loadout fields (Task 18) match what `buildLoadout` (Task 19) produces (`{extraDiscards, startCoins, startRelics}`) and what `main.js` passes (Task 21); `generateShop(run, rng, pool)` pool = `poolFromMeta` (Tier 1 seam, unchanged).
- **DI kept:** `run.js` stays RELICS-free (loadout relic objects resolved in `meta.js` `buildLoadout`, passed in); `meta.js` takes `allRelicIds`/`allModIds`/`RELICS` as params, no hard import of the id universe into the shop logic.
- **Back-compat:** newRun without stake/loadout → base plays/discards, 0 coins, [] relics (Tier 0/1 tests unaffected); `loadMeta` merges onto a fresh base so older meta saves gain new fields.
- **Flagged for review:** which content starts locked (2 relics + 2 decks + 2 stakes); stake/loadout magnitudes; whether stake/loadout boosts persist every round (Task 18 note) — all `config.js` dials.
- **Placeholder scan:** logic tasks (17-20) have complete code + tests; Task 21 (UI) is manual-verify with complete main.js wiring + concrete ui.js acceptance checks.
