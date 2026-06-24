# Passages + Bosses Implementation Plan (Phase 2, sub-project 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the flat 8-round run with the tiered **Passage** structure (4 Passages × Word/Phrase/Sentence = 12 encounters) and add archetype-antagonist **bosses** on each Sentence, using the systems-bible warp vocabulary (disable/cap/tax/lock) without modifying the locked `scoring.js`.

**Architecture:** Keep the internal `roundIndex` (now 0..11) as the encounter counter; derive Passage/tier/boss-ness from it. Boss logic lives entirely in `run.js` (the engine) so the eval harness exercises it automatically. A new pure `src/bosses.js` holds boss content + warp helpers. Warps integrate at the `playWord`/encounter-setup layer: **disable** via a modified `tileValues` injected into `scoreWord`, **cap/tax** as a pure post-process of the `scoreWord` result, **lock** at encounter setup.

**Tech Stack:** Vanilla JS ESM, `node --test`, no build step. Seeded RNG in `rng.js`.

## Global Constraints

- **`src/scoring.js` is LOCKED — do not modify it.** All boss warps integrate outside it (`tileValues` DI for disable; post-process for cap/tax; setup for lock).
- **Boss logic lives in `src/run.js`** (engine), never in `main.js` (UI wiring), so `simulateRun` (harness) gets bosses for free.
- **Determinism:** boss order is drawn from a **separate seeded RNG stream** (`makeRng((seed ^ 0x9e3779b9) >>> 0)`) so it does NOT perturb the bag-draw RNG (`run.rng`). No `Math.random()` in logic.
- **`run.boss` is a boss id string (or null)**, not the boss object — so it serializes cleanly; look up `BOSSES[run.boss]` where the object is needed.
- **Provisional targets are tunable starting points** — the author tunes the curve via play.
- DI + logic/UI split; tests inject tiny fixtures.

## File Structure

- `src/bosses.js` — **new.** `BOSSES` (4), `ALL_BOSS_IDS`, `bossTileValues(tileValues, boss)`, `applyBossToScore(scored, boss)`. Pure.
- `src/config.js` — `ROUND_TARGETS` becomes the 12-entry tiered ladder; add `PASSAGES: 4`. (Modify.)
- `src/run.js` — export `passageOf`/`tierOf`/`isBossRound`/`TIERS`; `newRun` builds `run.bossOrder` + sets the encounter boss; `playWord` applies warps; `nextRound` sets the encounter boss. (Modify.)
- `src/storage.js` — serialize/deserialize `boss` + `bossOrder`; schema 3 → 4. (Modify.)
- `src/ui.js` — `renderRun` shows the Passage/tier label + a boss banner. (Modify.)
- `scripts/analyze-sim-v2.js` / `src/sim.js` — runs the 12-encounter bossed structure (automatic); capture output. (Run; minor tweak if needed.)
- Tests in `test/bosses.test.js` (new), `test/run.test.js`, `test/storage.test.js`.

---

### Task 1: `src/bosses.js` — boss content + pure warp helpers

**Files:** Create `src/bosses.js`; Create/append `test/bosses.test.js`.

**Interfaces — Produces:**
- `BOSSES` map; `ALL_BOSS_IDS`.
- `bossTileValues(tileValues, boss)` → a tileValues object (vowels zeroed for a `disable/vowels` boss; the same object reference if no disable).
- `applyBossToScore(scored, boss)` → a `{ points, mult, score }` (cap clamps mult + recomputes score; tax subtracts from score floored at 0; disable/lock/null return `scored` unchanged).

- [ ] **Step 1: Write the failing test** (`test/bosses.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { BOSSES, ALL_BOSS_IDS, bossTileValues, applyBossToScore } from '../src/bosses.js';

test('roster has the four starter bosses', () => {
  assert.deepEqual(ALL_BOSS_IDS.sort(), ['ceiling', 'mute', 'toll', 'vise']);
});

test('bossTileValues zeroes vowels for The Mute, no-op otherwise', () => {
  const tv = { A: 1, E: 1, R: 1, Z: 10 };
  const muted = bossTileValues(tv, BOSSES.mute);
  assert.equal(muted.A, 0); assert.equal(muted.E, 0); assert.equal(muted.R, 1); assert.equal(muted.Z, 10);
  assert.equal(bossTileValues(tv, BOSSES.ceiling), tv);   // non-disable boss: same ref
  assert.equal(bossTileValues(tv, null), tv);
});

test('applyBossToScore: cap clamps mult, tax subtracts, others no-op', () => {
  const scored = { points: 20, mult: 10, score: 200 };
  assert.deepEqual(applyBossToScore(scored, BOSSES.ceiling), { points: 20, mult: 4, score: 80 });   // capped at 4
  assert.deepEqual(applyBossToScore(scored, BOSSES.toll), { points: 20, mult: 10, score: 185 });    // -15
  assert.deepEqual(applyBossToScore({ points: 5, mult: 1, score: 5 }, BOSSES.toll), { points: 5, mult: 1, score: 0 }); // floored
  assert.equal(applyBossToScore(scored, BOSSES.mute), scored);   // disable handled via tileValues, not here
  assert.equal(applyBossToScore(scored, null), scored);
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/bosses.test.js` → FAIL (module missing).

- [ ] **Step 3: Implement `src/bosses.js`**

```js
// src/bosses.js — boss content + pure warp helpers. A boss warps one Sentence encounter.
// Verbs (from the systems bible): disable (zero some tile values) · cap (clamp mult) ·
// tax (subtract points) · lock (encounter-setup, handled in run.js). scoring.js is never touched.
const VOWELS = ['A', 'E', 'I', 'O', 'U'];

export const BOSSES = {
  mute:    { id: 'mute',    name: 'The Mute',    desc: 'Vowels score 0',                   warp: { verb: 'disable', letters: 'vowels' } },
  ceiling: { id: 'ceiling', name: 'The Ceiling', desc: 'Mult is capped at x4',             warp: { verb: 'cap',     maxMult: 4 } },
  toll:    { id: 'toll',    name: 'The Toll',    desc: 'Each word scores 15 fewer Points', warp: { verb: 'tax',     points: 15 } },
  vise:    { id: 'vise',    name: 'The Vise',    desc: 'No discards this round',           warp: { verb: 'lock',    lock: 'discard' } },
};

export const ALL_BOSS_IDS = Object.keys(BOSSES);

// disable: return a tileValues copy with the disabled letters zeroed. Injected into scoreWord (pure DI).
// Returns the SAME reference when there is nothing to disable (so callers can cheaply detect no-op).
export function bossTileValues(tileValues, boss) {
  if (!boss || boss.warp.verb !== 'disable') return tileValues;
  const out = { ...tileValues };
  if (boss.warp.letters === 'vowels') for (const v of VOWELS) out[v] = 0;
  return out;
}

// cap + tax: adjust a scoreWord result. Pure; returns a NEW {points,mult,score}.
// disable is applied via bossTileValues; lock is applied at encounter setup; both no-op here.
export function applyBossToScore(scored, boss) {
  if (!boss) return scored;
  if (boss.warp.verb === 'cap') {
    const mult = Math.min(scored.mult, boss.warp.maxMult);
    return { ...scored, mult, score: scored.points * mult };
  }
  if (boss.warp.verb === 'tax') {
    return { ...scored, score: Math.max(0, scored.score - boss.warp.points) };
  }
  return scored;
}
```

- [ ] **Step 4: Run to verify it passes** — `node --test test/bosses.test.js` → PASS.

- [ ] **Step 5: Full suite + commit**

```bash
npm test   # expect green
git add src/bosses.js test/bosses.test.js
git commit -m "feat: bosses.js — 4 starter bosses + pure warp helpers (disable/cap/tax)"
```

---

### Task 2: Passage/tier model + 12-entry tiered target ladder

**Files:** Modify `src/config.js`, `src/run.js`; append `test/run.test.js`.

**Interfaces — Produces:** `TIERS`, `passageOf(roundIndex)`, `tierOf(roundIndex)`, `isBossRound(roundIndex)` exported from `run.js`. `CONFIG.ROUND_TARGETS` is now length 12; `CONFIG.PASSAGES === 4`.

- [ ] **Step 1: Write the failing test** (append `test/run.test.js`)

```js
import { passageOf, tierOf, isBossRound, TIERS } from '../src/run.js';

test('Passage/tier derivation over 12 encounters', () => {
  assert.deepEqual(TIERS, ['Word', 'Phrase', 'Sentence']);
  assert.deepEqual([0,1,2,3,11].map(passageOf), [1,1,1,2,4]);
  assert.deepEqual([0,1,2].map(tierOf), ['Word','Phrase','Sentence']);
  assert.deepEqual([0,1,2,5,11].map(isBossRound), [false,false,true,true,true]);
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/run.test.js` → FAIL (exports missing).

- [ ] **Step 3a: Implement the helpers in `src/run.js`** (add near the top, after the imports)

```js
// Encounter structure: the target ladder is PASSAGES groups of (Word, Phrase, Sentence).
// roundIndex (0-based) is the flat encounter counter; Passage/tier/boss-ness derive from it.
export const TIERS = ['Word', 'Phrase', 'Sentence'];
export function passageOf(roundIndex) { return Math.floor(roundIndex / 3) + 1; }
export function tierOf(roundIndex) { return TIERS[roundIndex % 3]; }
export function isBossRound(roundIndex) { return roundIndex % 3 === 2; }
```

- [ ] **Step 3b: Replace `ROUND_TARGETS` + add `PASSAGES` in `src/config.js`**

Change the `ROUND_TARGETS` line to the 12-entry tiered ladder (provisional, tunable) and add `PASSAGES`:

```js
  PASSAGES: 4,                                             // run = PASSAGES x (Word, Phrase, Sentence)
  // 4 Passages x (Word, Phrase, Sentence) — provisional exponential ladder, tuned via play:
  ROUND_TARGETS: [
    40,  60,  90,      // Passage 1: Word, Phrase, Sentence(boss)
    120, 175, 260,     // Passage 2
    340, 480, 700,     // Passage 3
    950, 1300, 1800,   // Passage 4 (final boss)
  ],
```

(Leave `TIER0_TARGETS` as-is; it is the separate no-shop floor instrument.)

- [ ] **Step 4: Run to verify it passes** — `node --test test/run.test.js` → PASS.

- [ ] **Step 5: Full suite** — `npm test`. NOTE: some existing tests/harness may assume an 8-entry curve or specific targets; if a test breaks purely because the ladder length changed (e.g. an assertion on `targets.length` or a hard-coded round target), update that assertion to the new structure (do not weaken it). Report any such updates.

- [ ] **Step 6: Commit**

```bash
git add src/config.js src/run.js test/run.test.js
git commit -m "feat: 12-encounter Passage structure (4 x Word/Phrase/Sentence) + tiered targets"
```

---

### Task 3: Boss selection + warp application in `run.js`

**Files:** Modify `src/run.js`; append `test/run.test.js`.

**Interfaces:**
- Consumes: `BOSSES`, `ALL_BOSS_IDS`, `bossTileValues`, `applyBossToScore` from `bosses.js`; `passageOf`/`isBossRound` (Task 2).
- Produces: `run.bossOrder` (array of boss ids, seeded, set at `newRun`); `run.boss` (the active encounter's boss id or null); warps applied in `playWord`.

- [ ] **Step 1: Write the failing tests** (append `test/run.test.js`)

```js
import { newRun as newRunB, playWord as playWordB, nextRound as nextRoundB } from '../src/run.js';
import { BOSSES } from '../src/bosses.js';

const bossCfg = {
  STARTING_BAG: ['A','E','I','O','R','S','T','N','L','D','C','B'],
  TILE_VALUES: { A:1,E:1,I:1,O:1,R:1,S:1,T:1,N:1,L:1,D:2,C:3,B:3 },
  RACK_SIZE: 9, PLAYS_PER_ROUND: 4, DISCARDS_PER_ROUND: 2, MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 5, COINS_ON_CLEAR: null,
  ROUND_TARGETS: [9999,9999,9999, 9999,9999,9999, 9999,9999,9999, 9999,9999,9999],   // never auto-clear
};
const dictB = (await import('../src/dictionary.js')).makeDictionary(['rat','rate','oat']);

test('bossOrder is seeded + deterministic + one of each boss', () => {
  const a = newRunB({ config: bossCfg, dictionary: dictB, seed: 5 });
  const b = newRunB({ config: bossCfg, dictionary: dictB, seed: 5 });
  assert.deepEqual(a.bossOrder, b.bossOrder);
  assert.deepEqual([...a.bossOrder].sort(), ['ceiling','mute','toll','vise']);
  assert.equal(a.boss, null);                 // encounter 0 is a Word, no boss
});

test('The Vise zeroes discards on its boss encounter', () => {
  // Force a run whose first Sentence boss is vise: spin nextRound to a Sentence and set bossOrder.
  const run = newRunB({ config: bossCfg, dictionary: dictB, seed: 5 });
  run.bossOrder = ['vise','mute','toll','ceiling'];        // passage 1's boss = vise
  nextRoundB(run); nextRoundB(run);                        // advance to roundIndex 2 (Passage 1 Sentence)
  assert.equal(run.boss, 'vise');
  assert.equal(run.discardsLeft, 0);                       // lock applied at encounter setup
});

test('The Toll taxes the played word on its boss encounter', () => {
  const run = newRunB({ config: bossCfg, dictionary: dictB, seed: 5 });
  run.bossOrder = ['toll','mute','vise','ceiling'];
  nextRoundB(run); nextRoundB(run);                        // Passage 1 Sentence, boss = toll
  assert.equal(run.boss, 'toll');
  run.rack = ['R','A','T'].map((l,i) => ({ id:'z'+i, letter:l, mods:[] }));
  const sel = run.rack.map(t => ({ tile:t, letter:t.letter }));
  const r = playWordB(run, sel);                           // RAT = 3 points, mult 1 => 3, minus 15 tax => 0
  assert.equal(r.scored.score, 0);
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/run.test.js` → FAIL.

- [ ] **Step 3: Implement in `src/run.js`**

Add to the imports at the top:

```js
import { BOSSES, ALL_BOSS_IDS, bossTileValues, applyBossToScore } from './bosses.js';
```

Add an encounter-boss helper (after the `isBossRound` helper from Task 2):

```js
// Set run.boss for the current encounter (a boss id on Sentence encounters, else null) and apply
// any setup-time warp (lock). Called at newRun and on each nextRound. The boss OBJECT is BOSSES[run.boss].
function applyEncounterBoss(run) {
  run.boss = null;
  if (!isBossRound(run.roundIndex)) return;
  const passageIdx = passageOf(run.roundIndex) - 1;                     // 0-based passage
  run.boss = (run.bossOrder && run.bossOrder[passageIdx % run.bossOrder.length]) || null;
  const boss = run.boss ? BOSSES[run.boss] : null;
  if (boss && boss.warp.verb === 'lock' && boss.warp.lock === 'discard') run.discardsLeft = 0;
}
```

In `newRun`, add `bossOrder` + `boss` to the run object (after `status: 'playing',` — keep order tidy):

```js
    bossOrder: shuffle([...ALL_BOSS_IDS], makeRng((seed ^ 0x9e3779b9) >>> 0)),   // seeded, separate stream
    boss: null,
```

Then, in `newRun`, AFTER `startRound(run);` add:

```js
  applyEncounterBoss(run);
```

In `nextRound`, AFTER `run.status = 'playing';` and `startRound(run);` add (the lock must apply after `discardsLeft` is reset):

```js
  applyEncounterBoss(run);
```

(Confirm ordering: `nextRound` sets `run.discardsLeft = run.discardsPerRound;` then `startRound`; then `applyEncounterBoss` may zero `discardsLeft` for a lock boss. Good.)

In `playWord`, replace the `scoreWord` call + `run.roundTotal += scored.score;` block with the bossed version:

```js
  const boss = run.boss ? BOSSES[run.boss] : null;
  const allMods = [...run.relics, ...honeModifiers(run.honeLevels)];
  const scored0 = scoreWord(selection, {
    tileValues: bossTileValues(run.tileValues, boss),        // disable: vowels zeroed (else same ref)
    lengthBonusPerLetter: run.config.LENGTH_BONUS_PER_LETTER,
    relics: allMods,
    context: { wordsPlayedThisRound: run.wordsPlayedThisRound, enablers, relicState: run.relicState },
  });
  const scored = applyBossToScore(scored0, boss);            // cap/tax (else unchanged)
  run.roundTotal += scored.score;
```

(The rest of `playWord` — counters, consume/refill, status — is unchanged, and now uses the bossed `scored`.)

- [ ] **Step 4: Run to verify it passes** — `node --test test/run.test.js` → PASS.

- [ ] **Step 5: Full suite + commit**

```bash
npm test   # expect green
git add src/run.js test/run.test.js
git commit -m "feat: boss selection (seeded, per-Passage) + warp application in run.js"
```

---

### Task 4: Persist `boss` + `bossOrder` (schema 3 → 4)

**Files:** Modify `src/storage.js`; append `test/storage.test.js`.

- [ ] **Step 1: Write the failing test** (append `test/storage.test.js`, mirror existing fixtures)

```js
test('boss + bossOrder round-trip; schema is 4', () => {
  const run = newRun({ config, dictionary, seed: 5 });
  const data = serializeRun(run);
  assert.equal(data.version, 4);
  assert.deepEqual(data.bossOrder, run.bossOrder);
  const restored = deserializeRun(data, { config, dictionary });
  assert.deepEqual(restored.bossOrder, run.bossOrder);
  assert.equal(restored.boss, run.boss);
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL (version 3; fields absent).

- [ ] **Step 3: Implement in `src/storage.js`**

In `serializeRun`: change `version: 3` → `version: 4`; add after `relicState: run.relicState || {},`:

```js
    boss: run.boss ?? null,
    bossOrder: run.bossOrder || [],
```

In `deserializeRun`: add after `relicState: data.relicState || {},`:

```js
    boss: data.boss ?? null,
    bossOrder: data.bossOrder || [],
```

In `loadRun`: change the guard `if (data.version !== 3)` → `if (data.version !== 4)`.

- [ ] **Step 4: Run to verify it passes** — PASS.

- [ ] **Step 5: Full suite + commit**

```bash
npm test
git add src/storage.js test/storage.test.js
git commit -m "feat: persist boss + bossOrder; bump save schema v3->v4"
```

---

### Task 5: UI — Passage/tier label + boss banner (browser-verified)

**Files:** Modify `src/ui.js`.

**Interfaces:** Consumes `passageOf`/`tierOf` from `run.js`, `BOSSES` from `bosses.js`.

- [ ] **Step 1: Add imports** at the top of `src/ui.js` (alongside existing imports):

```js
import { passageOf, tierOf } from './run.js';
import { BOSSES } from './bosses.js';
```

- [ ] **Step 2: Replace the HUD round label** in `renderRun`. Change the line (currently ~318):

```js
      <div>Round ${run.roundIndex + 1}/${run.targets.length}</div>
```

to show the Passage + tier:

```js
      <div>Passage ${passageOf(run.roundIndex)}/${run.config.PASSAGES} &middot; ${tierOf(run.roundIndex)}</div>
```

- [ ] **Step 3: Add a boss banner** in `renderRun`, immediately above the rack (find where the rack `<div>` is rendered; insert before it). The banner shows only on a boss encounter:

```js
    ${run.boss && BOSSES[run.boss] ? `<div id="boss-banner"><b>${BOSSES[run.boss].name}</b> &middot; ${BOSSES[run.boss].desc}</div>` : ''}
```

- [ ] **Step 4: Add minimal CSS** for `#boss-banner` in `style.css` (a clear, non-emoji warning band — e.g. a bordered row with an accent color). Keep it consistent with the existing card styling.

- [ ] **Step 5: Verify** — `npm test` (UI not unit-tested; confirm nothing breaks). Browser-smoke is done by the controller after this task.

- [ ] **Step 6: Commit**

```bash
git add src/ui.js style.css
git commit -m "feat: UI shows Passage/tier label + boss banner (legible before play)"
```

---

### Task 6: Harness — measure the 12-encounter bossed structure

**Files:** Run `scripts/analyze-sim-v2.js`; tweak `src/sim.js`/the script only if needed.

**Interfaces:** `simulateRun`/`runPersona` already call `newRun`/`playWord`/`nextRound`, which now set + apply bosses — so the harness exercises bosses automatically. The 12-entry `ROUND_TARGETS` flows through unchanged.

- [ ] **Step 1: Run the harness** — `npm run analyze:sim-v2`. Capture the full output table VERBATIM. The `roundReached` p10/p50/p90 now range 0..12 (was 0..8). Win-rates reflect the new tiered curve + bosses.

- [ ] **Step 2: Sanity-check** that runs traverse all 12 encounters and bosses fire on Sentences (e.g. a temporary log, or confirm via the win-rate distribution that runs reach Passage 2+). Remove any temporary logging.

- [ ] **Step 3 (only if a real defect surfaces):** if the harness throws or mis-handles the 12-structure, fix `src/sim.js` minimally + add a test. Otherwise no code change.

- [ ] **Step 4: Report** the captured table to the controller (this is a REPORT — do not tune any numbers). Commit only if code changed:

```bash
git add src/sim.js && git commit -m "fix: harness handles 12-encounter bossed structure"   # only if needed
```

---

## Self-Review notes

- **Spec coverage:** B1/B2/B3 structure = Tasks 2+3; B4 verb integration = Tasks 1+3 (disable=tileValues, cap/tax=applyBossToScore, lock=applyEncounterBoss); B5 roster = Task 1; B6 seeded selection = Task 3; B7 legibility = Task 5; B8 persistence = Task 4; harness = Task 6.
- **scoring.js untouched** across all tasks (disable via injected tileValues, cap/tax post-process, lock at setup).
- **Determinism:** `bossOrder` uses a separate seeded stream so bag draws are unchanged; no `Math.random()`.
- **Type consistency:** `run.boss` is a boss id string|null everywhere; `BOSSES[run.boss]` yields the object; `bossOrder` is a string[]; helpers take `roundIndex` and are 0-based with 1-based Passage output.
- **Provisional targets** are tunable; the author owns the final curve.
