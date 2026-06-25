# Achievements & Meta-Economy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-game achievements system that pays out Meta currency (framed as competence feedback), backed by a persistent player profile, a stake x deck bounty grid, and two coupled Meta-economy fixes (delete the per-run stake `metaMult`; trim loadout to `extraDiscards` with a refund migration).

**Architecture:** Two new pure DOM-free modules (`src/achievements.js` = catalog + checking; `src/profile.js` = persisted player profile). Achievement checks run at the existing `recordPlay` / `recordRunEnd` call sites in `main.js`; a completed achievement adds its id to `profile.completed` and adds Meta to the existing `meta` store. The bounty grid is part of the profile. All rules stay out of the UI.

**Tech Stack:** Vanilla JS, ES modules, no build step. Tests via `node --test` (`npm test`). Persistence via injected `localStorage`-shaped storage.

**Status:** This plan implements a **banked, Tier-4+ deferred** feature. Do NOT execute it until the roadmap reaches the deferred wishlist and the author greenlights it. The spec is `docs/2026-06-25-letter-ride-achievements-meta-design.md`.

## Global Constraints

- **Vanilla JS, ES modules, no build step, no framework.** Match existing hand-rolled style.
- **Strict logic/UI split.** New rules live in pure modules (`achievements`, `profile`); `ui.js`/`main.js` only render + orchestrate. No rules in the UI.
- **Dependency injection.** Storage, dictionary, config, and id-rosters are passed in, never imported as globals inside logic when avoidable (mirror `telemetry.js` / `meta.js`).
- **Determinism.** No `Math.random()` in game logic (the existing cosmetic shuffle in `main.js` is the only sanctioned exception). Achievement predicates are pure.
- **Three-currency rule.** Achievements feed the existing Meta sink; no new currency.
- **Copy rule.** Player-facing copy is concise; **never use em dashes** in copy.
- **Tests** use tiny fixtures (3-word dictionary, small bag), never the full word list. Every logic module gets `test/<module>.test.js`.
- **Numbers marked TUNE** are placeholders for the author's playtest pass, not final values.
- **Conventional commits**, one per task.

## File Structure

- **Create** `src/profile.js` — persisted player profile: lifetime stats, `completed` achievement ids, `bountyGrid`. `makeProfile`/`loadProfile`/`saveProfile` + pure `recordPlay`/`recordRunEnd` updaters.
- **Create** `src/achievements.js` — `ACHIEVEMENTS` catalog (data + pure predicates), `checkAchievements`, `cellKey`, `grantBounties`.
- **Create** `test/profile.test.js`, `test/achievements.test.js`.
- **Modify** `src/config.js` — remove `metaMult` from `STAKES`; remove `startCoins`/`startRelic` from `LOADOUT`; raise `META.unlockCost`; add `META.achievement` (rewards + thresholds) and `META.bounty`.
- **Modify** `src/meta.js` — `makeMetaState` loadout shape + `schemaVersion`; `loadMeta` refund migration; simplify `buildLoadout`.
- **Modify** `src/run.js` — run-scoped accumulators (`totalWordsThisRun`, `discardedThisRun`, `flawlessSoFar`, `archetypeTally`); thread `deck.id`.
- **Modify** `src/storage.js` — serialize/deserialize the new run fields (no version bump; default on read).
- **Modify** `src/main.js` — drop `* metaMult`; thread `deck.id`; set `boughtAnythingThisRun`; load/save profile; build the achievements ctx; call checks + bounty grant; apply awards + toast.
- **Modify** `src/ui.js` — real `renderAchievements`; `achievementToast`.

---

### Task 1: Meta-economy config + migration

**Files:**
- Modify: `src/config.js:36-63` (META, STAKES, LOADOUT)
- Modify: `src/meta.js:4-14` (makeMetaState), `:20-30` (loadMeta), `:47-59` (buildLoadout)
- Modify: `src/main.js:52` (endRun earned line)
- Test: `test/meta.test.js`

**Interfaces:**
- Produces: `config.META.achievement = { reward: {onboarding,mastery,diversity,discovery}, bigWordScore, bigRoundScore, efficientWords, manyMods, manyRelics }`, `config.META.bounty = {0,1,2}`; `metaState.schemaVersion = 2`; `metaState.loadout = { extraDiscards }`.
- Consumes (later tasks): `buildLoadout` returns `{ extraDiscards }`; `metaEarned` is no longer multiplied by stake.

- [ ] **Step 1: Write the failing test** (append to `test/meta.test.js`)

```js
import { makeMetaState, loadMeta, buildLoadout } from '../src/meta.js';
import { CONFIG } from '../src/config.js';

test('loadMeta refunds Meta spent on removed loadout perks exactly once', () => {
  const store = new Map();
  // Simulate an OLD save: schemaVersion absent, perks bought.
  store.set('letterRide.meta', JSON.stringify({
    meta: 0, unlockedRelics: [], unlockedMods: [], unlockedDecks: [], unlockedStakes: [0],
    loadout: { extraDiscards: 1, startCoins: 2, startRelic: 1 },
  }));
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const m = loadMeta(storage, CONFIG);
  // 2 startCoins @8 + 1 startRelic @25 = 41 refunded; extraDiscards kept.
  assert.equal(m.meta, 41);
  assert.equal(m.loadout.extraDiscards, 1);
  assert.equal(m.loadout.startCoins, undefined);
  assert.equal(m.loadout.startRelic, undefined);
  assert.equal(m.schemaVersion, 2);
  // Idempotent: re-loading the migrated state does not refund again.
  storage.setItem('letterRide.meta', JSON.stringify(m));
  const m2 = loadMeta(storage, CONFIG);
  assert.equal(m2.meta, 41);
});

test('config no longer carries metaMult or removed loadout perks', () => {
  assert.ok(CONFIG.STAKES.every(s => s.metaMult === undefined));
  assert.equal(CONFIG.LOADOUT.startCoins, undefined);
  assert.equal(CONFIG.LOADOUT.startRelic, undefined);
  assert.ok(CONFIG.LOADOUT.extraDiscards);
  assert.ok(CONFIG.META.achievement && CONFIG.META.bounty);
});

test('buildLoadout returns only extraDiscards', () => {
  const m = makeMetaState(CONFIG); m.loadout.extraDiscards = 2;
  const lo = buildLoadout(m, CONFIG, {});
  assert.equal(lo.extraDiscards, 2);
  assert.deepEqual(lo.startRelics, []);
});
```

(Assumes the file already has `import test from 'node:test'` / `assert` at top, matching the other tests; if not, add `import { test } from 'node:test'; import assert from 'node:assert';`.)

- [ ] **Step 2: Run it to verify failure**

Run: `npm test -- test/meta.test.js` (or `node --test test/meta.test.js`)
Expected: FAIL — `m.meta` is 0 (no migration), `metaMult` still present.

- [ ] **Step 3: Edit `src/config.js`** — replace the `META`, `STAKES`, and `LOADOUT` blocks.

Replace `META.unlockCost` line and add new keys (within `META`):

```js
  META: {
    earn: { perRoundCleared: 2, winBonus: 10 },
    baseUnlocked: {
      relics: ['vowelBonus','shortAndSweet','lengthy','freshStart','comboCounter','recycler'],
      mods: ['resonator','polished','catalyst','anchor'],
      decks: ['standard','rareRich','doubled','lean'],
      stakes: [0],
    },
    unlockCost: { relic: 25, mod: 20, deck: 35, stake: 15 },   // TUNE: raised to absorb the larger faucet
    achievement: {
      reward: { onboarding: 3, mastery: 12, diversity: 8, discovery: 5 },  // TUNE: Meta by bucket
      bigWordScore: 150,    // TUNE
      bigRoundScore: 400,   // TUNE
      efficientWords: 12,   // TUNE: win in <= N total words
      manyMods: 4,          // TUNE
      manyRelics: 4,        // TUNE
    },
    bounty: { 0: 5, 1: 10, 2: 20 },   // TUNE: one-time per (stake,deck) cell, by stake tier
  },
```

Replace the `STAKES` block (drop every `metaMult`):

```js
  STAKES: [
    { id: 0, name: 'Stake 0', targetMult: 1.0,  playsDelta: 0,  discardsDelta: 0 },
    { id: 1, name: 'Stake 1', targetMult: 1.25, playsDelta: 0,  discardsDelta: 0 },
    { id: 2, name: 'Stake 2', targetMult: 1.5,  playsDelta: -1, discardsDelta: 0 },
  ],
```

Replace the `LOADOUT` block (keep only `extraDiscards`):

```js
  LOADOUT: {
    extraDiscards: { name: '+1 Discard / round', max: 2, cost: 10 },
  },
```

- [ ] **Step 4: Edit `src/meta.js`** — `makeMetaState`, `loadMeta`, `buildLoadout`.

Replace `makeMetaState` (lines 4-14):

```js
export const META_SCHEMA_VERSION = 2;

export function makeMetaState(config) {
  const b = config.META.baseUnlocked;
  return {
    schemaVersion: META_SCHEMA_VERSION,
    meta: 0,
    unlockedRelics: [...b.relics],
    unlockedMods: [...b.mods],
    unlockedDecks: [...b.decks],
    unlockedStakes: [...b.stakes],
    loadout: { extraDiscards: 0 },
  };
}
```

Replace `loadMeta` (lines 20-30):

```js
// Historical costs of the removed perks, for one-time refund of already-spent Meta.
const REMOVED_PERK_COST = { startCoins: 8, startRelic: 25 };

export function loadMeta(storage, config) {
  const raw = storage.getItem(META_KEY);
  if (!raw) return makeMetaState(config);
  try {
    const data = JSON.parse(raw);
    const base = makeMetaState(config);
    const merged = { ...base, ...data, loadout: { ...base.loadout, ...(data.loadout || {}) } };
    if ((data.schemaVersion || 0) < META_SCHEMA_VERSION) {
      const lo = data.loadout || {};
      const refund = (lo.startCoins || 0) * REMOVED_PERK_COST.startCoins
                   + (lo.startRelic || 0) * REMOVED_PERK_COST.startRelic;
      merged.meta = (merged.meta || 0) + refund;
      merged.loadout = { extraDiscards: lo.extraDiscards || 0 };   // drop removed keys
      merged.schemaVersion = META_SCHEMA_VERSION;
    }
    return merged;
  } catch {
    return makeMetaState(config);
  }
}
```

Replace `buildLoadout` (lines 47-59):

```js
export function buildLoadout(metaState, config, RELICS) {
  const lo = metaState.loadout || {};
  return { extraDiscards: lo.extraDiscards || 0, startRelics: [] };
}
```

- [ ] **Step 5: Edit `src/main.js:52`** — drop the stake multiplier.

Change:
```js
    const earned = Math.round(metaEarned(run, CONFIG) * (run.stake?.metaMult || 1));
```
to:
```js
    const earned = metaEarned(run, CONFIG);
```

- [ ] **Step 6: Run tests to verify pass**

Run: `npm test -- test/meta.test.js`
Expected: PASS (all three new tests + existing meta tests).
Then `npm test` — expected: full suite green (no other module depended on `metaMult` or the removed perks).

- [ ] **Step 7: Commit**

```bash
git add src/config.js src/meta.js src/main.js test/meta.test.js
git commit -m "feat: meta-economy refactor — drop metaMult, trim loadout, refund migration"
```

---

### Task 2: Run-scoped accumulators + deckId threading

**Files:**
- Modify: `src/run.js:79-115` (newRun), `:127-169` (playWord), `:171-179` (discard)
- Modify: `src/storage.js:9-42` (serializeRun), `:44-82` (deserializeRun)
- Modify: `src/main.js:48` (startRun deck), `:91-100` (onBuy)
- Test: `test/run.test.js`, `test/storage.test.js`

**Interfaces:**
- Produces (on the `run` object): `totalWordsThisRun:number`, `discardedThisRun:boolean`, `flawlessSoFar:boolean`, `archetypeTally:{[id]:number}`, `boughtAnythingThisRun:boolean`, and `deck.id` present at win time.
- Consumes: `ARCHETYPES`, `ALL_ARCHETYPE_IDS` from `archetypes.js` (already the home of build classification).

- [ ] **Step 1: Write the failing test** (append to `test/run.test.js`)

```js
import { newRun, playWord, discard } from '../src/run.js';
// Reuse the file's existing fixture helpers (tiny dictionary + bag). The pattern below
// assumes a `makeTestRun()` style helper already used in this file; if not, build a run via
// newRun({ config, dictionary, seed: 1, targets: [1], deck: { id: 'standard', startingBag: ['C','A','T'] } }).

test('run tracks totalWordsThisRun and discardedThisRun', () => {
  const run = makeTestRun({ targets: [9999] });   // unreachable target so the round stays open
  const sel = selectWord(run, 'CAT');              // existing helper that maps letters->rack tiles
  playWord(run, sel);
  assert.equal(run.totalWordsThisRun, 1);
  assert.equal(run.discardedThisRun, false);
  discard(run, [{ tile: run.rack[0], letter: run.rack[0].letter }]);
  assert.equal(run.discardedThisRun, true);
});

test('archetypeTally accumulates and flawlessSoFar flips on a final-play clear', () => {
  const run = makeTestRun({ targets: [1] });       // clears on first word
  run.playsLeft = 1;                               // force "final play" condition
  const sel = selectWord(run, 'CAT');
  playWord(run, sel);
  assert.equal(run.status, 'roundCleared');
  assert.equal(run.flawlessSoFar, false);          // cleared on the last play -> not flawless
  assert.ok(run.archetypeTally.shortWord >= 1);    // CAT is length 3
});
```

(Use whatever fixture/selection helpers `test/run.test.js` already defines; the assertions are the contract.)

- [ ] **Step 2: Run it to verify failure**

Run: `npm test -- test/run.test.js`
Expected: FAIL — `run.totalWordsThisRun` is undefined.

- [ ] **Step 3: Edit `src/run.js`** — import classifiers, init + update accumulators.

At the top imports, change line 6:
```js
import { honeModifiers } from './archetypes.js';
```
to:
```js
import { honeModifiers, ARCHETYPES, ALL_ARCHETYPE_IDS } from './archetypes.js';
```

In `newRun`, inside the `const run = { ... }` literal, add these fields (next to `wordsPlayedThisRound: 0,`):
```js
    wordsPlayedThisRound: 0,
    totalWordsThisRun: 0,
    discardedThisRun: false,
    flawlessSoFar: true,
    archetypeTally: {},
    boughtAnythingThisRun: false,
```

In `playWord`, after `run.wordsPlayedThisRound += 1;` (line 157), add:
```js
    run.totalWordsThisRun += 1;
    for (const id of ALL_ARCHETYPE_IDS) {
      if (ARCHETYPES[id].matches(ratchetCtx)) run.archetypeTally[id] = (run.archetypeTally[id] || 0) + 1;
    }
```

In `playWord`, change the clear line (165) so a final-play clear breaks flawless:
```js
  if (run.roundTotal >= run.target) { run.status = 'roundCleared'; if (run.playsLeft <= 0) run.flawlessSoFar = false; if (run.config.COINS_ON_CLEAR) awardCoins(run); }
```

In `discard`, after `run.discardsLeft -= 1;` (line 173), add:
```js
  run.discardedThisRun = true;
```

(Do NOT reset these in `nextRound` — they are run-wide, not per-round.)

- [ ] **Step 4: Edit `src/storage.js`** — persist the new fields (default on read, no version bump).

In `serializeRun`, after the `wordsPlayedThisRound: run.wordsPlayedThisRound,` line, add:
```js
    totalWordsThisRun: run.totalWordsThisRun ?? 0,
    discardedThisRun: run.discardedThisRun ?? false,
    flawlessSoFar: run.flawlessSoFar ?? true,
    archetypeTally: run.archetypeTally ?? {},
    boughtAnythingThisRun: run.boughtAnythingThisRun ?? false,
```

In `deserializeRun`, after the `wordsPlayedThisRound: data.wordsPlayedThisRound,` line, add:
```js
    totalWordsThisRun: data.totalWordsThisRun ?? 0,
    discardedThisRun: data.discardedThisRun ?? false,
    flawlessSoFar: data.flawlessSoFar ?? true,
    archetypeTally: data.archetypeTally ?? {},
    boughtAnythingThisRun: data.boughtAnythingThisRun ?? false,
```

(`run.deck` is already serialized verbatim, so once `main.js` threads `deck.id` it round-trips with no storage change.)

- [ ] **Step 5: Edit `src/main.js`** — thread `deck.id` and set the buy flag.

Change line 48:
```js
    run = newRun({ config: CONFIG, dictionary, seed: Date.now() >>> 0, targets, deck: { startingBag: deck.startingBag }, stake, loadout });
```
to:
```js
    run = newRun({ config: CONFIG, dictionary, seed: Date.now() >>> 0, targets, deck: { id: deck.id, startingBag: deck.startingBag }, stake, loadout });
```

In `onBuy`, inside `if (r.ok) {` (after line 93), add:
```js
        run.boughtAnythingThisRun = true;
```

- [ ] **Step 6: Run tests to verify pass**

Run: `npm test -- test/run.test.js test/storage.test.js`
Expected: PASS. Then `npm test` — full suite green.

- [ ] **Step 7: Commit**

```bash
git add src/run.js src/storage.js src/main.js test/run.test.js
git commit -m "feat: run-scoped accumulators + deckId threading for achievements"
```

---

### Task 3: Player profile store (`src/profile.js`)

**Files:**
- Create: `src/profile.js`
- Test: `test/profile.test.js`

**Interfaces:**
- Produces: `makeProfile()`, `loadProfile(storage)`, `saveProfile(profile, storage)`, `recordPlay(profile, ctx)`, `recordRunEnd(profile, summary)`.
- Profile shape: `{ stats: { runs, wins, roundsCleared, wordsPlayed, bestWordScore, bestWord, bestRunScore, relicsEverUsed[], modsEverApplied[] }, completed: string[], bountyGrid: {[key]: true} }`.
- Consumes: `ctx` from achievements (Task 5) for `recordPlay`; `summary = { won, roundsCleared, runScore, relicIds, modIds }` for `recordRunEnd`.

- [ ] **Step 1: Write the failing test** (`test/profile.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { makeProfile, loadProfile, saveProfile, recordPlay, recordRunEnd } from '../src/profile.js';

function memStore() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; }

test('recordPlay tracks word count and personal-best word', () => {
  const p = makeProfile();
  recordPlay(p, { word: 'CAT', score: 30 });
  recordPlay(p, { word: 'DOGE', score: 80 });
  recordPlay(p, { word: 'OX', score: 10 });
  assert.equal(p.stats.wordsPlayed, 3);
  assert.equal(p.stats.bestWordScore, 80);
  assert.equal(p.stats.bestWord, 'DOGE');
});

test('recordRunEnd accumulates runs/wins/bests and dedupes used-id sets', () => {
  const p = makeProfile();
  recordRunEnd(p, { won: true, roundsCleared: 9, runScore: 500, relicIds: ['a','b'], modIds: ['x'] });
  recordRunEnd(p, { won: false, roundsCleared: 2, runScore: 100, relicIds: ['b','c'], modIds: ['x','y'] });
  assert.equal(p.stats.runs, 2);
  assert.equal(p.stats.wins, 1);
  assert.equal(p.stats.roundsCleared, 11);
  assert.equal(p.stats.bestRunScore, 500);
  assert.deepEqual([...p.stats.relicsEverUsed].sort(), ['a','b','c']);
  assert.deepEqual([...p.stats.modsEverApplied].sort(), ['x','y']);
});

test('loadProfile tolerates corruption and round-trips', () => {
  const s = memStore();
  s.setItem('letterRide.profile', '{not json');
  const fresh = loadProfile(s);
  assert.equal(fresh.stats.runs, 0);
  recordRunEnd(fresh, { won: true, roundsCleared: 9, runScore: 1, relicIds: [], modIds: [] });
  saveProfile(fresh, s);
  const again = loadProfile(s);
  assert.equal(again.stats.runs, 1);
  assert.equal(again.stats.wins, 1);
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npm test -- test/profile.test.js`
Expected: FAIL — `src/profile.js` does not exist.

- [ ] **Step 3: Create `src/profile.js`**

```js
// src/profile.js — persisted, player-facing profile: lifetime stats, completed achievements,
// and the stake x deck bounty grid. Pure functions; storage injected. Distinct from telemetry
// (which is dev-only/resettable); the profile is the authoritative player-facing store.
const PROFILE_KEY = 'letterRide.profile';

export function makeProfile() {
  return {
    stats: {
      runs: 0, wins: 0, roundsCleared: 0, wordsPlayed: 0,
      bestWordScore: 0, bestWord: '', bestRunScore: 0,
      relicsEverUsed: [], modsEverApplied: [],
    },
    completed: [],
    bountyGrid: {},
  };
}

export function loadProfile(storage) {
  const raw = storage.getItem(PROFILE_KEY);
  if (!raw) return makeProfile();
  try {
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return makeProfile();
    const base = makeProfile();
    return {
      stats: { ...base.stats, ...(data.stats || {}) },
      completed: Array.isArray(data.completed) ? data.completed : [],
      bountyGrid: (data.bountyGrid && typeof data.bountyGrid === 'object') ? data.bountyGrid : {},
    };
  } catch {
    return makeProfile();
  }
}

export function saveProfile(profile, storage) {
  storage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

const addUnique = (arr, id) => { if (!arr.includes(id)) arr.push(id); };

export function recordPlay(profile, ctx) {
  const s = profile.stats;
  s.wordsPlayed += 1;
  if ((ctx.score || 0) > s.bestWordScore) { s.bestWordScore = ctx.score || 0; s.bestWord = ctx.word || ''; }
}

export function recordRunEnd(profile, summary) {
  const s = profile.stats;
  s.runs += 1;
  if (summary.won) s.wins += 1;
  s.roundsCleared += summary.roundsCleared || 0;
  if ((summary.runScore || 0) > s.bestRunScore) s.bestRunScore = summary.runScore || 0;
  for (const id of summary.relicIds || []) addUnique(s.relicsEverUsed, id);
  for (const id of summary.modIds || []) addUnique(s.modsEverApplied, id);
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- test/profile.test.js`
Expected: PASS (all three).

- [ ] **Step 5: Commit**

```bash
git add src/profile.js test/profile.test.js
git commit -m "feat: player profile store (lifetime stats, completed, bounty grid)"
```

---

### Task 4: Achievement catalog + checking (`src/achievements.js`)

**Files:**
- Create: `src/achievements.js`
- Test: `test/achievements.test.js`

**Interfaces:**
- Produces: `ACHIEVEMENTS` (array), `checkAchievements(profile, ctx, config)` -> `[{ id, name, desc, bucket, reward }]` (only newly completed, not already in `profile.completed`; pure, no mutation), `cellKey(stakeId, deckId)`, `grantBounties(profile, stakeId, deckId, config)` -> `{ granted: string[], meta: number }` (mutates `profile.bountyGrid`).
- Consumes: a `ctx` object with two shapes — play-phase `{ phase:'play', letters[], word, score, wordsPlayedThisRound, status, playsLeft, prevRoundTotal, target, roundTotal, roundIndex }` and end-phase `{ phase:'end', won, roundIndex, boughtAnythingThisRun, discardedThisRun, totalWordsThisRun, flawlessSoFar, archetypeTally, relicsCount, modsCount, stakeId, allRelicIds[], allModIds[] }`. (Built by Task 5.)

- [ ] **Step 1: Write the failing test** (`test/achievements.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { ACHIEVEMENTS, checkAchievements, cellKey, grantBounties } from '../src/achievements.js';
import { makeProfile } from '../src/profile.js';
import { CONFIG } from '../src/config.js';

test('catalog has unique ids and a known bucket each', () => {
  const ids = ACHIEVEMENTS.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length);
  const buckets = new Set(['onboarding','mastery','diversity','discovery']);
  assert.ok(ACHIEVEMENTS.every(a => buckets.has(a.bucket)));
});

test('a single-word round clear unlocks oneWordClear, paid from the mastery bucket', () => {
  const p = makeProfile();
  const ctx = { phase: 'play', letters: ['C','A','T'], word: 'CAT', score: 20, wordsPlayedThisRound: 1, status: 'roundCleared', playsLeft: 3, prevRoundTotal: 0, target: 10, roundTotal: 20, roundIndex: 0 };
  const got = checkAchievements(p, ctx, CONFIG);
  const ids = got.map(a => a.id);
  assert.ok(ids.includes('oneWordClear'));
  assert.equal(got.find(a => a.id === 'oneWordClear').reward, CONFIG.META.achievement.reward.mastery);
});

test('no double-award: an id already in completed is never returned', () => {
  const p = makeProfile(); p.completed.push('oneWordClear');
  const ctx = { phase: 'play', letters: ['C','A','T'], word: 'CAT', score: 20, wordsPlayedThisRound: 1, status: 'roundCleared', playsLeft: 3, prevRoundTotal: 0, target: 10, roundTotal: 20, roundIndex: 0 };
  assert.ok(!checkAchievements(p, ctx, CONFIG).map(a => a.id).includes('oneWordClear'));
});

test('"win leaning vowels" reads the dominant non-trivial archetype', () => {
  const p = makeProfile();
  const ctx = { phase: 'end', won: true, roundIndex: 8, boughtAnythingThisRun: true, discardedThisRun: true, totalWordsThisRun: 30, flawlessSoFar: false, archetypeTally: { vowelHeavy: 5, shortWord: 1, escalation: 6 }, relicsCount: 1, modsCount: 0, stakeId: 0, allRelicIds: [], allModIds: [] };
  assert.ok(checkAchievements(p, ctx, CONFIG).map(a => a.id).includes('winVowels'));
});

test('completeness predicate compares against the live roster and never re-pays', () => {
  const p = makeProfile();
  p.stats.relicsEverUsed = ['a','b'];
  const base = { phase:'end', won:true, roundIndex:8, boughtAnythingThisRun:true, discardedThisRun:true, totalWordsThisRun:30, flawlessSoFar:false, archetypeTally:{}, relicsCount:1, modsCount:0, stakeId:0, allModIds:[] };
  // roster fully covered -> curator unlocks
  assert.ok(checkAchievements(p, { ...base, allRelicIds: ['a','b'] }, CONFIG).map(a=>a.id).includes('curator'));
  // mark earned, then grow the roster: stays earned, not re-paid, not un-completed
  p.completed.push('curator');
  assert.ok(!checkAchievements(p, { ...base, allRelicIds: ['a','b','c'] }, CONFIG).map(a=>a.id).includes('curator'));
});

test('grantBounties auto-grants lower stakes for the same deck, once', () => {
  const p = makeProfile();
  const r1 = grantBounties(p, 2, 'standard', CONFIG);   // clearing stake 2 grants 0,1,2 for standard
  assert.deepEqual(r1.granted.sort(), ['0:standard','1:standard','2:standard']);
  assert.equal(r1.meta, CONFIG.META.bounty[0] + CONFIG.META.bounty[1] + CONFIG.META.bounty[2]);
  const r2 = grantBounties(p, 1, 'standard', CONFIG);   // already granted -> nothing new
  assert.deepEqual(r2.granted, []);
  assert.equal(r2.meta, 0);
  assert.equal(cellKey(1, 'standard'), '1:standard');
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npm test -- test/achievements.test.js`
Expected: FAIL — `src/achievements.js` does not exist.

- [ ] **Step 3: Create `src/achievements.js`**

```js
// src/achievements.js — achievement catalog (data + pure predicates) and checking logic.
// Predicates are pure functions of (profile, ctx, config). No DOM, no storage, no rng.
// Build-diversity predicates reuse the dominant-archetype tally produced in run.js.

// Dominant build archetype this run, ignoring 'escalation' (which matches every play).
function dominantArchetype(tally = {}) {
  let best = null, bestN = 0;
  for (const [id, n] of Object.entries(tally)) {
    if (id === 'escalation') continue;
    if (n > bestN) { best = id; bestN = n; }
  }
  return best;
}

const isPlay = (c) => c.phase === 'play';
const isEnd  = (c) => c.phase === 'end';
const has = (letters, ch) => (letters || []).includes(ch);

// Each entry: { id, bucket, name, desc, predicate(profile, ctx, config). reward defaults to
// config.META.achievement.reward[bucket]; an explicit `reward` overrides. }
export const ACHIEVEMENTS = [
  // --- Onboarding (small) ---
  { id: 'firstRound',     bucket: 'onboarding', name: 'First Impression', desc: 'Clear your first round.',
    predicate: (p, c) => isPlay(c) && c.status === 'roundCleared' },
  { id: 'firstWin',       bucket: 'onboarding', name: 'Off the Press',     desc: 'Win your first full run.',
    predicate: (p, c) => isEnd(c) && c.won },
  { id: 'firstRelic',     bucket: 'onboarding', name: 'Stocked',           desc: 'Finish a run owning a relic.',
    predicate: (p, c) => isEnd(c) && c.relicsCount >= 1 },
  { id: 'fiveLetter',     bucket: 'onboarding', name: 'Set in Type',       desc: 'Play a 5+ letter word.',
    predicate: (p, c) => isPlay(c) && (c.letters || []).length >= 5 },
  { id: 'reachPassage2',  bucket: 'onboarding', name: 'Type Founder',      desc: 'Reach Passage 2.',
    predicate: (p, c) => isPlay(c) && Math.floor((c.roundIndex || 0) / 3) + 1 >= 2 },

  // --- Mastery (bulk of the Meta budget) ---
  { id: 'winNoBuy',       bucket: 'mastery', name: 'Clean Sheet',  desc: 'Win a run buying nothing.',
    predicate: (p, c) => isEnd(c) && c.won && !c.boughtAnythingThisRun },
  { id: 'oneWordClear',   bucket: 'mastery', name: 'One and Done', desc: 'Clear a round in a single word.',
    predicate: (p, c) => isPlay(c) && c.status === 'roundCleared' && c.wordsPlayedThisRound === 1 },
  { id: 'bigWord',        bucket: 'mastery', name: 'Heavy Impression', desc: 'Play a single word worth a lot.',
    predicate: (p, c, cfg) => isPlay(c) && (c.score || 0) >= cfg.META.achievement.bigWordScore },
  { id: 'winStake1',      bucket: 'mastery', name: 'Pressrun',     desc: 'Win on Stake 1.',
    predicate: (p, c) => isEnd(c) && c.won && (c.stakeId || 0) >= 1 },
  { id: 'winStake2',      bucket: 'mastery', name: 'Master Printer', desc: 'Win on Stake 2.', reward: 25,
    predicate: (p, c) => isEnd(c) && c.won && (c.stakeId || 0) >= 2 },
  { id: 'bigRound',       bucket: 'mastery', name: 'Engine Room',  desc: 'Score big in a single round.',
    predicate: (p, c, cfg) => isPlay(c) && c.status === 'roundCleared' && (c.roundTotal || 0) >= cfg.META.achievement.bigRoundScore },
  { id: 'speedWin',       bucket: 'mastery', name: 'Speed Set',    desc: 'Win in few total words.',
    predicate: (p, c, cfg) => isEnd(c) && c.won && (c.totalWordsThisRun || 0) <= cfg.META.achievement.efficientWords },
  { id: 'winNoDiscard',   bucket: 'mastery', name: 'No Waste',     desc: 'Win without discarding.',
    predicate: (p, c) => isEnd(c) && c.won && !c.discardedThisRun },
  { id: 'clutch',         bucket: 'mastery', name: 'Comeback',     desc: 'Clear a round on your final play from behind.',
    predicate: (p, c) => isPlay(c) && c.status === 'roundCleared' && c.playsLeft <= 0 && (c.prevRoundTotal || 0) < c.target },
  { id: 'flawless',       bucket: 'mastery', name: 'Full Press',   desc: 'Win without ever clearing on your last play.',
    predicate: (p, c) => isEnd(c) && c.won && c.flawlessSoFar },

  // --- Build diversity (moderate) ---
  { id: 'winVowels',      bucket: 'diversity', name: 'Vowel Movement', desc: 'Win leaning vowels.',
    predicate: (p, c) => isEnd(c) && c.won && dominantArchetype(c.archetypeTally) === 'vowelHeavy' },
  { id: 'winRare',        bucket: 'diversity', name: 'Rare Earth',     desc: 'Win leaning rare letters.',
    predicate: (p, c) => isEnd(c) && c.won && dominantArchetype(c.archetypeTally) === 'rareLetter' },
  { id: 'winShort',       bucket: 'diversity', name: 'Short Stack',    desc: 'Win with a short-word build.',
    predicate: (p, c) => isEnd(c) && c.won && dominantArchetype(c.archetypeTally) === 'shortWord' },
  { id: 'winLong',        bucket: 'diversity', name: 'Long Hauler',    desc: 'Win with a long-word build.',
    predicate: (p, c) => isEnd(c) && c.won && dominantArchetype(c.archetypeTally) === 'longWord' },
  { id: 'winManyMods',    bucket: 'diversity', name: 'Enchanter’s Run', desc: 'Win using several tile-mods.',
    predicate: (p, c, cfg) => isEnd(c) && c.won && (c.modsCount || 0) >= cfg.META.achievement.manyMods },
  { id: 'winManyRelics',  bucket: 'diversity', name: 'Relic Hound',    desc: 'Win with several relics.',
    predicate: (p, c, cfg) => isEnd(c) && c.won && (c.relicsCount || 0) >= cfg.META.achievement.manyRelics },

  // --- Discovery / long-tail prestige (low) ---
  { id: 'curator',        bucket: 'discovery', name: 'Curator',  desc: 'Use every relic at least once.',
    predicate: (p, c) => isEnd(c) && (c.allRelicIds || []).length > 0 && (c.allRelicIds || []).every(id => p.stats.relicsEverUsed.includes(id)) },
  { id: 'enchanter',      bucket: 'discovery', name: 'Enchanter', desc: 'Apply every tile-mod at least once.',
    predicate: (p, c) => isEnd(c) && (c.allModIds || []).length > 0 && (c.allModIds || []).every(id => p.stats.modsEverApplied.includes(id)) },
  { id: 'qNoU',           bucket: 'discovery', name: 'Q Without U', desc: 'Play a word with Q and no U.',
    predicate: (p, c) => isPlay(c) && has(c.letters, 'Q') && !has(c.letters, 'U') },
  { id: 'fullHouse',      bucket: 'discovery', name: 'Full House', desc: 'Play a word using all five vowels.',
    predicate: (p, c) => isPlay(c) && ['A','E','I','O','U'].every(v => has(c.letters, v)) },
];

function rewardFor(def, config) {
  return def.reward ?? config.META.achievement.reward[def.bucket];
}

// Pure: returns newly-completed achievements (not already in profile.completed). No mutation.
export function checkAchievements(profile, ctx, config) {
  const done = new Set(profile.completed);
  const out = [];
  for (const def of ACHIEVEMENTS) {
    if (done.has(def.id)) continue;
    let ok = false;
    try { ok = def.predicate(profile, ctx, config); } catch { ok = false; }
    if (ok) out.push({ id: def.id, name: def.name, desc: def.desc, bucket: def.bucket, reward: rewardFor(def, config) });
  }
  return out;
}

export function cellKey(stakeId, deckId) { return `${stakeId}:${deckId}`; }

// Mutates profile.bountyGrid: grants the (stake,deck) cell and all lower stakes for that deck.
// Returns the newly granted keys and the total Meta to award.
export function grantBounties(profile, stakeId, deckId, config) {
  if (deckId == null) return { granted: [], meta: 0 };
  const granted = [];
  let meta = 0;
  for (let s = 0; s <= stakeId; s++) {
    const key = cellKey(s, deckId);
    if (!profile.bountyGrid[key]) {
      profile.bountyGrid[key] = true;
      granted.push(key);
      meta += config.META.bounty[s] || 0;
    }
  }
  return { granted, meta };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- test/achievements.test.js`
Expected: PASS (all six).

- [ ] **Step 5: Commit**

```bash
git add src/achievements.js test/achievements.test.js
git commit -m "feat: achievement catalog + checking + bounty grid logic"
```

---

### Task 5: Orchestration in `main.js`

**Files:**
- Modify: `src/main.js` (imports, boot, `saveAll`, `onSubmit`, `endRun`, award + toast plumbing)
- Test: manual (main.js is not unit-tested, per the project rule that UI/orchestration is verified by hand). Logic it calls is covered by Tasks 1-4.

**Interfaces:**
- Consumes: `loadProfile/saveProfile/recordPlay/recordRunEnd` (Task 3), `checkAchievements/grantBounties` (Task 4), `achievementToast` (Task 6), `ALL_RELIC_IDS`/`ALL_MOD_IDS` (already imported).
- Produces: a single `awardAchievements(list, bountyMeta)` helper that adds Meta, marks `profile.completed`, and queues toasts.

- [ ] **Step 1: Add imports.**

Change the profile-less import line (after the telemetry import, line 10) by adding:
```js
import { loadProfile, saveProfile, recordPlay as profileRecordPlay, recordRunEnd as profileRecordRunEnd } from './profile.js';
import { checkAchievements, grantBounties } from './achievements.js';
```
And add `achievementToast` to the `ui.js` import list (line 12).

- [ ] **Step 2: Load profile at boot + include in saveAll.**

After `let telemetry = loadTelemetry(window.localStorage);` (line 19), add:
```js
  const profile = loadProfile(window.localStorage);
```

Change `saveAll` (line 32) to also persist the profile:
```js
  const saveAll = () => { saveMeta(meta, window.localStorage); saveTelemetry(telemetry, window.localStorage); saveProfile(profile, window.localStorage); if (run) saveRun(run, window.localStorage); };
```

- [ ] **Step 3: Add the award helper** (place just above `function startRun`):

```js
  // Apply a batch of newly-completed achievements + bounty Meta: pay Meta, mark completed, toast.
  function awardAchievements(list, bountyMeta = 0) {
    let gained = bountyMeta;
    for (const a of list) { profile.completed.push(a.id); gained += a.reward; }
    if (gained > 0) meta.meta += gained;
    for (const a of list) achievementToast(a);          // feat-first toast; Meta shown muted (Task 6)
    if (bountyMeta > 0) achievementToast({ name: 'Bounty', desc: 'Stake cleared with this deck.', reward: bountyMeta });
    return gained;
  }
```

- [ ] **Step 4: Check on each play.** In `onSubmit`, immediately after the existing `recordPlay(telemetry, ...)` call (line 76) and the `run.bestPlay` block, add:

```js
      profileRecordPlay(profile, { word: playedWord, score: r.scored.score });
      const playCtx = {
        phase: 'play',
        letters: sel.map(s => s.letter.toUpperCase()),
        word: playedWord.toUpperCase(),
        score: r.scored.score,
        wordsPlayedThisRound: run.wordsPlayedThisRound,
        status: run.status,
        playsLeft: run.playsLeft,
        prevRoundTotal: run.roundTotal - r.scored.score,
        target: run.target,
        roundTotal: run.roundTotal,
        roundIndex: run.roundIndex,
      };
      awardAchievements(checkAchievements(profile, playCtx, CONFIG));
```

(Place this BEFORE the `if (run.status === 'roundCleared')` shop block so the toast fires with the clear; ordering does not affect correctness since the ctx is captured first.)

- [ ] **Step 5: Check at run end.** Replace `endRun` (lines 51-60) with:

```js
  function endRun() {
    const earned = metaEarned(run, CONFIG);
    meta.meta += earned; run.lastMetaEarned = earned;       // for the meta screen to show
    const relicIds = run.relics.map(r => r.id);
    const modIds = [...new Set(run.bag.tiles.flatMap(t => t.mods.map(m => m.id)))];
    recordRunEnd(telemetry, { won: run.status === 'won', ownedIds: [...relicIds, ...modIds] });
    const won = run.status === 'won';
    const roundsCleared = won ? run.targets.length : run.roundIndex;
    // Update lifetime sets FIRST so completeness predicates (curator/enchanter) see this run's ids.
    profileRecordRunEnd(profile, { won, roundsCleared, runScore: run.roundTotal, relicIds, modIds });
    const bounty = won ? grantBounties(profile, run.stake?.id ?? 0, run.deck?.id ?? null, CONFIG) : { meta: 0 };
    const endCtx = {
      phase: 'end', won, roundIndex: run.roundIndex,
      boughtAnythingThisRun: !!run.boughtAnythingThisRun,
      discardedThisRun: !!run.discardedThisRun,
      totalWordsThisRun: run.totalWordsThisRun || 0,
      flawlessSoFar: run.flawlessSoFar !== false,
      archetypeTally: run.archetypeTally || {},
      relicsCount: relicIds.length, modsCount: modIds.length,
      stakeId: run.stake?.id ?? 0,
      allRelicIds: ALL_RELIC_IDS, allModIds: ALL_MOD_IDS,
    };
    awardAchievements(checkAchievements(profile, endCtx, CONFIG), bounty.meta);
    run.lastMetaEarned = earned + (run._lastAwardGained || 0);   // (display only; optional)
    window.localStorage.removeItem('letterRide.run'); run = null; view = 'meta'; saveAll(); render();
  }
```

(The `run._lastAwardGained` line is cosmetic; if the meta screen does not need the combined figure, drop it. `awardAchievements` returns the gained amount if you want to surface it.)

- [ ] **Step 6: Pass the profile to the achievements screen render.** Change line 38:
```js
    if (view === 'achievements') return renderAchievements();
```
to:
```js
    if (view === 'achievements') return renderAchievements(profile, CONFIG, ACHIEVEMENTS, ALL_RELIC_IDS, ALL_MOD_IDS);
```
and add the import `import { ACHIEVEMENTS } from './achievements.js';` (extend the Task-5 Step-1 import).

- [ ] **Step 7: Smoke test in the browser.**

Run: `npm run serve`, open the app. Play a quick run (use a low target by editing nothing; just play). Verify: no console errors; a toast fires on the first 5-letter word and on a round clear; after the run ends, the Meta total on the meta screen reflects drip + any achievement payouts; the Achievements menu opens the new screen (Task 6).

Use the `browser-smoke` skill to gate this if available.

- [ ] **Step 8: Commit**

```bash
git add src/main.js
git commit -m "feat: wire achievement checks + bounty grid into run/play orchestration"
```

---

### Task 6: Achievements screen + toast (`ui.js`)

**Files:**
- Modify: `src/ui.js:1114-1123` (replace `renderAchievements`), add `achievementToast`
- Modify: `src/style.css` (toast + screen styles, optional — reuse existing menu classes where possible)
- Test: manual (UI is verified by hand per the project rule).

**Interfaces:**
- Consumes: `renderAchievements(profile, config, ACHIEVEMENTS, allRelicIds, allModIds)`, `achievementToast({ name, desc, reward })`.
- Produces: rendered DOM only.

- [ ] **Step 1: Replace `renderAchievements` in `src/ui.js`.**

```js
export function renderAchievements(profile, config, ACHIEVEMENTS, allRelicIds = [], allModIds = []) {
  const done = new Set(profile?.completed || []);
  const buckets = [
    ['onboarding', 'Getting Started'],
    ['mastery', 'Mastery'],
    ['diversity', 'Build Diversity'],
    ['discovery', 'Discovery'],
  ];
  const rewardFor = (a) => a.reward ?? config.META.achievement.reward[a.bucket];
  // Feat-first rows: name + desc lead; Meta shown small and muted (competence-feedback framing).
  const rowsFor = (bucket) => (ACHIEVEMENTS || [])
    .filter(a => a.bucket === bucket)
    .map(a => {
      const got = done.has(a.id);
      return `<div class="ach-row ${got ? 'done' : 'locked'}">
        <span class="ach-name">${a.name}</span>
        <span class="ach-desc">${a.desc}</span>
        <span class="ach-meta">${got ? 'earned' : `+${rewardFor(a)} Meta`}</span>
      </div>`;
    }).join('');
  const sections = buckets.map(([k, label]) =>
    `<div class="ach-section"><h3>${label}</h3>${rowsFor(k)}</div>`).join('');

  // Bounty grid: stakes x unlocked decks. Lower tiers auto-granted, so only the cell state shows.
  const stakes = config.STAKES.map(s => s.id);
  const decks = Object.keys(config.DECKS);
  const gridRows = decks.map(d => {
    const cells = stakes.map(s => {
      const on = profile?.bountyGrid?.[`${s}:${d}`];
      return `<td class="bounty-cell ${on ? 'on' : 'off'}">${on ? '★' : '·'}</td>`;
    }).join('');
    return `<tr><th>${config.DECKS[d].name}</th>${cells}</tr>`;
  }).join('');
  const gridHead = `<tr><th></th>${stakes.map(s => `<th>S${s}</th>`).join('')}</tr>`;

  const s = profile?.stats || {};
  const statsPanel = `<div class="ach-stats">
    <p>Runs <b>${s.runs || 0}</b> &nbsp; Wins <b>${s.wins || 0}</b> &nbsp; Rounds cleared <b>${s.roundsCleared || 0}</b></p>
    <p>Best word <b>${s.bestWord || '—'}</b> (${s.bestWordScore || 0}) &nbsp; Best run <b>${s.bestRunScore || 0}</b></p>
  </div>`;

  app().innerHTML = `
    <div id="menu-screen" class="achievements">
      <div class="menu-title small">Achievements</div>
      ${statsPanel}
      ${sections}
      <div class="ach-section"><h3>Bounties</h3>
        <table class="bounty-grid">${gridHead}${gridRows}</table>
      </div>
      <div class="menu-buttons"><button id="ach-back" class="menu-btn">Back</button></div>
    </div>`;
  const e = document.getElementById('ach-back'); if (e) e.onclick = () => handlers.onBackToMenu?.();
}
```

- [ ] **Step 2: Add `achievementToast`** (near the other exported UI helpers in `ui.js`):

```js
// Feat-first celebration toast. Leads with the achievement name; the Meta reward is muted and
// secondary (never the headline) to avoid framing play as reward-chasing. Respects mute via sfx.
let _toastQueue = [];
let _toastBusy = false;
export function achievementToast(a) {
  _toastQueue.push(a);
  if (!_toastBusy) _drainToasts();
}
function _drainToasts() {
  const a = _toastQueue.shift();
  if (!a) { _toastBusy = false; return; }
  _toastBusy = true;
  const el = document.createElement('div');
  el.className = 'ach-toast';
  el.innerHTML = `<span class="t-name">${a.name}</span><span class="t-desc">${a.desc || ''}</span>` +
                 (a.reward ? `<span class="t-meta">+${a.reward} Meta</span>` : '');
  document.body.appendChild(el);
  try { sfx('cash'); } catch {}
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => { el.remove(); _drainToasts(); }, 300); }, 2200);
}
```

(`sfx` is the existing `play` import alias in `ui.js`; if `ui.js` imports audio under a different name, use that. If `ui.js` has no audio import, import `{ play as sfx }` from `./audio.js` at the top.)

- [ ] **Step 3: Add styles to `src/style.css`** (append; reuse `--gold`/`--night-2`/`--line` tokens already in the file):

```css
.achievements .ach-section { margin: 12px 0; }
.achievements .ach-section h3 { color: var(--gold); font-family: var(--font-display); margin: 0 0 6px; }
.ach-row { display: grid; grid-template-columns: 1fr 2fr auto; gap: 8px; align-items: baseline; padding: 4px 0; border-bottom: 1px solid var(--line); }
.ach-row.locked { opacity: 0.55; }
.ach-name { font-weight: 700; }
.ach-desc { color: var(--ink-2, #b9b2a6); font-size: 0.9em; }
.ach-meta { font-size: 0.8em; color: var(--gold); opacity: 0.75; }   /* muted, secondary */
.bounty-grid { border-collapse: collapse; }
.bounty-grid th, .bounty-grid td { padding: 4px 10px; text-align: center; }
.bounty-cell.on { color: var(--gold); } .bounty-cell.off { opacity: 0.4; }
.ach-toast { position: fixed; right: 16px; bottom: 16px; background: var(--night-2); border: 1px solid var(--gold);
  border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 2px;
  transform: translateY(20px); opacity: 0; transition: transform .3s, opacity .3s; z-index: 50; }
.ach-toast.show { transform: translateY(0); opacity: 1; }
.ach-toast .t-name { font-weight: 700; color: var(--gold); }
.ach-toast .t-desc { font-size: 0.85em; }
.ach-toast .t-meta { font-size: 0.75em; opacity: 0.7; }   /* muted */
```

(If a token like `--ink-2` does not exist, drop it and use a literal or an existing variable; check `:root` in `style.css`.)

- [ ] **Step 4: Manual verification.**

Run: `npm run serve`. Open Achievements from the menu: verify the four bucket sections render, locked rows are dimmed and show `+N Meta` muted, earned rows show `earned`, the stats panel shows zeros on a fresh profile, and the bounty grid renders decks x stakes. Complete a quick achievement and confirm the toast appears feat-first with a muted Meta line and a chime (with sound on).

Use the `browser-smoke` skill if available to confirm no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui.js src/style.css
git commit -m "feat: achievements screen + feat-first unlock toast"
```

---

## Self-Review

**Spec coverage:**
- Achievements pay Meta, competence-feedback framing → Tasks 4 (rewards), 5 (award), 6 (feat-first toast + muted Meta). Covered.
- Additive faucet + raised unlock costs → Task 1. Covered.
- Four buckets, ~24-30, no pure-grind → Task 4 catalog (25 entries, no cumulative counters). Covered.
- Stake x deck bounty grid, lower-tier auto-grant → Task 4 `grantBounties`, Task 5 wiring, Task 6 grid render. Covered.
- Loadout trimmed to extraDiscards + migration/refund → Task 1. Covered.
- Rich lifetime profile store → Task 3 + stats panel in Task 6. Covered.
- Prerequisite wiring (deckId, run accumulators, extended play-ctx, metaMult code edit) → Tasks 1, 2, 5. Covered.
- Completeness predicate vs growing roster; double-award guard → Task 4 + tests. Covered.

**Placeholder scan:** No "TBD/TODO/handle edge cases" left; all code blocks are concrete. Numeric balance values are explicit constants tagged TUNE (intentional per the spec).

**Type consistency:** `checkAchievements(profile, ctx, config)` and the ctx field names (`phase`, `status`, `playsLeft`, `prevRoundTotal`, `archetypeTally`, `allRelicIds`, `allModIds`, `stakeId`, `relicsCount`, `modsCount`) are produced in Task 5 exactly as consumed in Task 4. `grantBounties`/`cellKey` signatures match between Tasks 4 and 5. `recordPlay`/`recordRunEnd` are imported under aliases (`profileRecordPlay`/`profileRecordRunEnd`) in main.js to avoid colliding with the telemetry imports of the same names — verified the alias is used at every call site.

**Notes for the implementer:** `test/run.test.js` helper names (`makeTestRun`, `selectWord`) are placeholders for whatever that file already provides; use the file's real fixtures. Confirm `ui.js` already imports `play as sfx` from `./audio.js` before relying on it in the toast (add the import if absent).
