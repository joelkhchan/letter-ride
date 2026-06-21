# Letter Ride — Tier 0 (Spine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable, resumable "tap words from a drawn rack vs. rising Points targets" game — the Tier 0 spine — to playtest whether the tap-to-build word-finding mechanic is fun before any shop, modifiers, or meta are built.

**Architecture:** Pure-logic ES modules (no DOM) hold all rules and are unit-tested headless with `node --test`. A thin `ui.js`/`main.js` renders state and emits actions (tap-to-build). All randomness flows through one seeded RNG whose state is save/restorable. `dictionary` and `tileValues` are injected so tests use tiny fixtures. Tiles are instances (`{id, letter, mods}`) from day one so later tiers plug in without signature churn.

**Tech Stack:** Vanilla JavaScript (ES modules), HTML5, CSS. `node --test` (no test framework). `npx serve` for dev/playtest. No build step.

**Source docs:** design spec `docs/2026-06-20-letter-ride-design.md`; 4-tier roadmap `docs/2026-06-20-letter-ride-plan.md`. This plan details **Tier 0 only**; Tiers 1–3 are authored just-in-time after each 🛑 gate.

## Global Constraints

- **Scarcity pillar (non-negotiable):** letters are always drawn from a bag, never an open alphabet.
- **Scoring formula (phase-ordered):** `Points = Wit × Mult`. All `+Mult` summed into `(1 + ΣaddMult)`, then **all** `×Mult` multiply that — regardless of modifier order. (Tier 0 has no modifiers, but the engine and signature ship now.)
- **Three currencies, no others:** Points (in-round), Coins (Tier 1), Meta (Tier 2). Tier 0 only uses Points; `coins` is present and 0.
- **Minimum word length: 3.**
- **Tiles are instances:** `{ id, letter, mods }`; the bag holds `Tile[]`. Tile ids are stable and round-trippable through save/load (preserved, never regenerated).
- **Determinism:** every random draw uses the seeded RNG in `src/rng.js`. No `Math.random()` in logic (only for picking a run seed in `main.js`).
- **Dependency injection:** `dictionary` and `tileValues` are passed into functions, never imported as globals in logic modules.
- **Save/resume must be faithful:** persisting and reloading restores the exact run, including the current rack and the RNG position, so subsequent draws continue the same sequence.

## File Structure (Tier 0 subset)

| File | Responsibility |
|---|---|
| `package.json` | `"type": "module"`, `test` + `serve` scripts. |
| `index.html` | Single page; loads `src/main.js`. |
| `src/config.js` | All tunable numbers. No logic. |
| `src/rng.js` | Seeded PRNG (mulberry32) + `shuffle`; `getState`/`setState` for save/resume. |
| `src/dictionary.js` | `makeDictionary(words, blocklist)` → `{ isValid }`; `loadFromFile`. |
| `src/tiles.js` | `makeTile`/`nextId`/`setMinTileId`/`resetTileIds`/`rehydrateTile`/`getMod`/`WILD`/`isWild`/`tileIdNum`. |
| `src/bag.js` | Bag state (`Tile[]`); `draw`, `add`, `remove`. |
| `src/word.js` | `wordOf(selection)`; `validate(selection, dict, minLen)`. |
| `src/scoring.js` | Phase engine: `scoreWord(selection, ctx)`. |
| `src/run.js` | `RunState` machine: `newRun`/`drawRack`/`playWord`/`discard`/`nextRound`. |
| `src/storage.js` | `serializeRun`/`deserializeRun`/`saveRun`/`loadRun`. |
| `src/ui.js`, `src/main.js`, `src/style.css` | DOM render + tap-to-build + wiring (manual-verify). |
| `test/*.test.js` | One test file per logic module. |
| `assets/enable1.txt` | ENABLE word list (downloaded in Task 0). |

---

### Task 0: Project scaffold

**Files:**
- Create: `package.json`, `index.html`, `src/config.js`, `assets/enable1.txt`, `.gitignore`

- [ ] **Step 1: Init repo + package.** Run:

```bash
git init
```

Create `package.json`:

```json
{
  "name": "letter-ride",
  "version": "0.0.1",
  "type": "module",
  "scripts": { "test": "node --test", "serve": "npx --yes serve ." }
}
```

- [ ] **Step 2: Download the dictionary** (ENABLE, public domain, ~170k words):

```bash
curl -L -o assets/enable1.txt https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt
```

Verify: `wc -l assets/enable1.txt` → ≈ 172820.

- [ ] **Step 3: Create `src/config.js`:**

```javascript
export const CONFIG = {
  STARTING_BAG: [
    'A','A','A','E','E','E','I','I','O','O','U',          // 11 vowels
    'R','S','T','L','N','D','C','M','B','P','G','H','F','Y','K' // 15 consonants
  ],
  TILE_VALUES: {                                           // base Wit per letter; WILD '*' = 0
    A:1,E:1,I:1,O:1,U:1,L:1,N:1,S:1,T:1,R:1,
    D:2,G:2, B:3,C:3,M:3,P:3, F:4,H:4,V:4,W:4,Y:4, K:5, J:8,X:8, Q:10,Z:10, '*':0
  },
  RACK_SIZE: 9,
  PLAYS_PER_ROUND: 4,
  DISCARDS_PER_ROUND: 2,
  MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 5,                              // +5 × (len - 3), min 0
  TIER0_TARGETS: [20, 35, 55, 80, 110, 145, 185, 230],     // beatable from base bag, no shop
  ROUND_TARGETS:  [40, 70, 110, 160, 230, 320, 440, 600],  // real run (Tier 1+; assumes shop scaling)
  COINS_ON_CLEAR: { base: 4, perUnusedPlay: 1, perUnusedDiscard: 1 }, // Tier 1
  META_EARN: { perRoundCleared: 2, winBonus: 10 },         // Tier 2
  PROFANITY_FILTER: true,
  PROFANITY_BLOCKLIST: [ /* add slurs to reject; author may empty this */ ],
};
```

- [ ] **Step 4: Create `index.html`:**

```html
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Letter Ride</title><link rel="stylesheet" href="src/style.css"></head>
<body><div id="app">Loading…</div><script type="module" src="src/main.js"></script></body></html>
```

- [ ] **Step 5: Create `.gitignore`:**

```
node_modules/
.DS_Store
android/
.gradle/
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold Letter Ride project"
```

---

### Task 1: Seeded RNG with save/restore state

**Files:** Create `src/rng.js`, `test/rng.test.js`.
**Interfaces — Produces:**
- `makeRng(seed: number) -> rng` where `rng()` returns a float in [0,1); `rng.getState() -> number` and `rng.setState(n: number)` snapshot/restore the generator position.
- `shuffle(array, rng) -> array` (new array, Fisher–Yates).

- [ ] **Step 1: Write the failing test**

```javascript
// test/rng.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { makeRng, shuffle } from '../src/rng.js';

test('same seed yields same sequence', () => {
  const a = makeRng(42), b = makeRng(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('rng outputs are in [0,1)', () => {
  const r = makeRng(1);
  for (let i = 0; i < 100; i++) { const x = r(); assert.ok(x >= 0 && x < 1); }
});

test('getState/setState resumes the exact sequence', () => {
  const r = makeRng(7);
  r(); r(); r();
  const snap = r.getState();
  const expected = [r(), r(), r()];
  const r2 = makeRng(999);          // different seed
  r2.setState(snap);                // restore position
  assert.deepEqual([r2(), r2(), r2()], expected);
});

test('shuffle is deterministic per seed and preserves elements', () => {
  const arr = [1, 2, 3, 4, 5];
  const s1 = shuffle(arr, makeRng(7));
  const s2 = shuffle(arr, makeRng(7));
  assert.deepEqual(s1, s2);
  assert.deepEqual([...s1].sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual(arr, [1, 2, 3, 4, 5]);   // input not mutated
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/rng.test.js` — Expected: FAIL (`makeRng is not a function`).

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/rng.js — mulberry32 with restorable state
export function makeRng(seed) {
  let a = seed >>> 0;
  const rng = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.getState = () => a;
  rng.setState = (s) => { a = s | 0; };
  return rng;
}

export function shuffle(array, rng) {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes** — Run: `node --test test/rng.test.js` — Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/rng.js test/rng.test.js && git commit -m "feat: seeded RNG with restorable state and shuffle"
```

---

### Task 2: Dictionary with profanity blocklist

**Files:** Create `src/dictionary.js`, `test/dictionary.test.js`.
**Interfaces — Produces:**
- `makeDictionary(words: Iterable<string>, blocklist: Iterable<string> = []) -> { isValid(word): boolean }` — case-insensitive membership; a blocklisted word returns `false` even if present.
- `loadFromFile(path, blocklist) -> Promise<Dictionary>` (browser `fetch`; used by `main.js`, not tests). **Throws** on a non-ok HTTP status so a missing/404 dictionary fails loudly instead of silently producing an all-invalid dictionary.

> **Note on scope:** the blocklist *mechanism* is built + tested here, but `CONFIG.PROFANITY_BLOCKLIST` ships **empty** — so the filter is wired but inert until the author populates it. Don't read this as "profanity handled"; read it as "filter wired, list unpopulated (author's call)."

- [ ] **Step 1: Write the failing test**

```javascript
// test/dictionary.test.js
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
```

- [ ] **Step 2: Run test to verify it fails** — Run: `node --test test/dictionary.test.js` — Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/dictionary.js
export function makeDictionary(words, blocklist = []) {
  const set = new Set();
  for (const w of words) set.add(w.toLowerCase());
  const blocked = new Set();
  for (const w of blocklist) blocked.add(w.toLowerCase());
  return {
    isValid(word) {
      const w = String(word).toLowerCase();
      return set.has(w) && !blocked.has(w);
    },
  };
}

export async function loadFromFile(path, blocklist = []) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Dictionary load failed: ${res.status} ${path}`);
  const text = await res.text();
  return makeDictionary(text.split(/\r?\n/).filter(Boolean), blocklist);
}
```

- [ ] **Step 4: Run test to verify it passes** — Run: `node --test test/dictionary.test.js` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dictionary.js test/dictionary.test.js && git commit -m "feat: dictionary with injectable word set and profanity blocklist"
```

---

### Task 3: Tiles (instances with round-trippable ids)

**Files:** Create `src/tiles.js`, `test/tiles.test.js`.
**Interfaces — Produces:**
- `makeTile(letter, mods = [], id = nextId()) -> { id, letter, mods }`
- `nextId() -> string` (module counter, `t0`, `t1`, …); `setMinTileId(n: number)` advances the counter past `n`; `resetTileIds()` (test helper); `tileIdNum(id) -> number` (parses `'t7'`→`7`).
- `rehydrateTile({ id, letter, modIds }) -> Tile` — rebuilds a saved tile preserving its id (mods via `getMod`; empty in Tier 0).
- `getMod(id) -> TileMod | undefined` (registry stub; populated in Tier 1).
- `WILD = '*'`; `isWild(tile) -> boolean`.

> **Test convention (carry into all tiers):** the id counter is module-global mutable state — any test that asserts on a concrete id (e.g. `'t0'`) MUST call `resetTileIds()` first. This is safe because `node --test` isolates each file in its own process; keep the convention as Tier-1 test files get busier (purchases, enchants).

- [ ] **Step 1: Write the failing test**

```javascript
// test/tiles.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { makeTile, nextId, setMinTileId, resetTileIds, rehydrateTile, tileIdNum, WILD, isWild } from '../src/tiles.js';

test('makeTile builds a plain tile with a fresh id', () => {
  resetTileIds();
  const t = makeTile('A');
  assert.deepEqual(t, { id: 't0', letter: 'A', mods: [] });
  assert.notEqual(makeTile('B').id, t.id);
});

test('explicit id is preserved (for rehydration)', () => {
  const t = makeTile('A', [], 't42');
  assert.equal(t.id, 't42');
});

test('rehydrateTile preserves id and rebuilds shape', () => {
  const t = rehydrateTile({ id: 't7', letter: 'E', modIds: [] });
  assert.deepEqual(t, { id: 't7', letter: 'E', mods: [] });
});

test('setMinTileId prevents id collisions after load', () => {
  resetTileIds();
  setMinTileId(7);
  assert.ok(tileIdNum(makeTile('A').id) > 7);
});

test('WILD detection', () => {
  assert.equal(isWild(makeTile(WILD)), true);
  assert.equal(isWild(makeTile('A')), false);
});
```

- [ ] **Step 2: Run test to verify it fails** — Run: `node --test test/tiles.test.js` — Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/tiles.js
let counter = 0;
const MOD_REGISTRY = {};            // empty in Tier 0; Tier 1 registers tile-mods here

export const WILD = '*';

export function nextId() { return 't' + (counter++); }
export function setMinTileId(n) { if (n + 1 > counter) counter = n + 1; }
export function resetTileIds() { counter = 0; }
export function tileIdNum(id) { return parseInt(String(id).slice(1), 10); }

export function makeTile(letter, mods = [], id = nextId()) {
  return { id, letter, mods };
}

export function isWild(tile) { return tile.letter === WILD; }

export function getMod(id) { return MOD_REGISTRY[id]; }

export function rehydrateTile({ id, letter, modIds = [] }) {
  return { id, letter, mods: modIds.map(getMod).filter(Boolean) };
}
```

- [ ] **Step 4: Run test to verify it passes** — Run: `node --test test/tiles.test.js` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tiles.js test/tiles.test.js && git commit -m "feat: tile factory with round-trippable stable ids"
```

---

### Task 4: Bag

**Files:** Create `src/bag.js`, `test/bag.test.js`.
**Interfaces:**
- Consumes: `shuffle` from `rng.js`.
- Produces: `makeBag(tiles: Tile[]) -> { tiles, draw(n, rng), add(tile), remove(tileId) }`. `draw` returns `n` tiles from a shuffled copy (bag not consumed); `remove` deletes the instance whose `id` matches.

- [ ] **Step 1: Write the failing test**

```javascript
// test/bag.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { makeBag } from '../src/bag.js';
import { makeRng } from '../src/rng.js';
import { makeTile, resetTileIds } from '../src/tiles.js';

test('draw returns n tiles deterministically by seed; bag not consumed', () => {
  resetTileIds();
  const bag = makeBag(['A','B','C','D','E'].map(l => makeTile(l)));
  const r1 = bag.draw(3, makeRng(5));
  const r2 = bag.draw(3, makeRng(5));
  assert.equal(r1.length, 3);
  assert.deepEqual(r1.map(t => t.id), r2.map(t => t.id));
  assert.equal(bag.tiles.length, 5);     // not consumed
});

test('add and remove change bag composition by id', () => {
  resetTileIds();
  const a = makeTile('A'), a2 = makeTile('A'), z = makeTile('Z');
  const bag = makeBag([a, a2]);
  bag.add(z);
  assert.equal(bag.tiles.filter(t => t.letter === 'Z').length, 1);
  bag.remove(a.id);
  assert.equal(bag.tiles.filter(t => t.letter === 'A').length, 1);
  assert.equal(bag.tiles.find(t => t.letter === 'A').id, a2.id);
});
```

- [ ] **Step 2: Run test to verify it fails** — Run: `node --test test/bag.test.js` — Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/bag.js
import { shuffle } from './rng.js';

export function makeBag(tiles) {
  const state = { tiles: [...tiles] };
  return {
    get tiles() { return state.tiles; },
    draw(n, rng) { return shuffle(state.tiles, rng).slice(0, Math.min(n, state.tiles.length)); },
    add(tile) { state.tiles.push(tile); },
    remove(tileId) {
      const i = state.tiles.findIndex(t => t.id === tileId);
      if (i >= 0) state.tiles.splice(i, 1);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes** — Run: `node --test test/bag.test.js` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/bag.js test/bag.test.js && git commit -m "feat: tile bag with draw/add/remove"
```

---

### Task 5: Word formation & validation (tap-to-build)

**Files:** Create `src/word.js`, `test/word.test.js`.
**Model:** the UI produces a **selection** — an ordered `{ tile, letter }[]` (for a normal tile `letter === tile.letter`; for a WILD, `letter` is the player's chosen letter).
**Interfaces — Produces:**
- `wordOf(selection) -> string`
- `validate(selection, dict, minLen = 3) -> { ok, reason?: 'short' | 'notword' }`
- `isLegalSelection(selection, rack) -> boolean` — every selected tile is a *distinct* instance that is actually present in `rack` (matched by `id`). The rules layer calls this so legality is NOT a UI-only invariant — protecting the Tier-1 headless analysis harness, which calls the rules layer directly and could otherwise submit a reused tile (double-counting its mod) or a tile not in the rack.

- [ ] **Step 1: Write the failing test**

```javascript
// test/word.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { wordOf, validate, isLegalSelection } from '../src/word.js';
import { makeDictionary } from '../src/dictionary.js';
import { makeTile, WILD, resetTileIds } from '../src/tiles.js';

const dict = makeDictionary(['cat', 'ice']);
const sel = (...pairs) => pairs.map(([tile, letter]) => ({ tile, letter }));

test('wordOf joins resolved letters (incl. a wild)', () => {
  resetTileIds();
  const s = sel([makeTile('C'), 'C'], [makeTile(WILD), 'A'], [makeTile('T'), 'T']);
  assert.equal(wordOf(s), 'CAT');
});

test('validate flags reasons', () => {
  resetTileIds();
  const cat = sel([makeTile('C'), 'C'], [makeTile('A'), 'A'], [makeTile('T'), 'T']);
  assert.deepEqual(validate(cat, dict), { ok: true });
  const it = sel([makeTile('I'), 'I'], [makeTile('T'), 'T']);
  assert.deepEqual(validate(it, dict), { ok: false, reason: 'short' });
  const zzz = sel([makeTile('Z'), 'Z'], [makeTile('Z'), 'Z'], [makeTile('Z'), 'Z']);
  assert.deepEqual(validate(zzz, dict), { ok: false, reason: 'notword' });
});

test('isLegalSelection requires distinct tiles drawn from the rack', () => {
  resetTileIds();
  const a = makeTile('C'), b = makeTile('A'), outsider = makeTile('Z');
  const rack = [a, b];
  assert.equal(isLegalSelection(sel([a, 'C'], [b, 'A']), rack), true);
  assert.equal(isLegalSelection(sel([a, 'C'], [a, 'C']), rack), false);   // same tile reused
  assert.equal(isLegalSelection(sel([outsider, 'Z']), rack), false);      // not in the rack
});
```

- [ ] **Step 2: Run test to verify it fails** — Run: `node --test test/word.test.js` — Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/word.js
export function wordOf(selection) {
  return selection.map(s => s.letter).join('');
}

export function validate(selection, dict, minLen = 3) {
  const word = wordOf(selection);
  if (word.length < minLen) return { ok: false, reason: 'short' };
  if (!dict.isValid(word)) return { ok: false, reason: 'notword' };
  return { ok: true };
}

export function isLegalSelection(selection, rack) {
  const rackIds = new Set(rack.map(t => t.id));
  const seen = new Set();
  for (const { tile } of selection) {
    if (!rackIds.has(tile.id) || seen.has(tile.id)) return false;
    seen.add(tile.id);
  }
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes** — Run: `node --test test/word.test.js` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/word.js test/word.test.js && git commit -m "feat: tap-to-build word formation and validation"
```

---

### Task 6: Scoring engine (phase-ordered)

**Files:** Create `src/scoring.js`, `test/scoring.test.js`.
**Interfaces — Produces:** `scoreWord(selection, { tileValues, lengthBonusPerLetter, relics = [], context = {} }) -> { wit, mult, points }`. Wild tiles (`tile.letter === '*'`) contribute 0 base Wit. Deltas are collected in one pass and combined as `mult = (1 + ΣaddMult) × ΠtimesMult`, so order never matters.

- [ ] **Step 1: Write the failing test**

```javascript
// test/scoring.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { scoreWord } from '../src/scoring.js';
import { makeTile, WILD, resetTileIds } from '../src/tiles.js';

const tileValues = { C:3, A:1, T:1, E:1, I:1 };
const sel = (...pairs) => pairs.map(([tile, letter]) => ({ tile, letter }));

test('Tier 0: wit = letter values + length bonus, mult 1', () => {
  resetTileIds();
  const cat = sel([makeTile('C'),'C'], [makeTile('A'),'A'], [makeTile('T'),'T']);
  assert.deepEqual(scoreWord(cat, { tileValues, lengthBonusPerLetter: 5 }), { wit: 5, mult: 1, points: 5 });
});

test('length bonus applies beyond 3 letters', () => {
  resetTileIds();
  const cate = sel([makeTile('C'),'C'], [makeTile('A'),'A'], [makeTile('T'),'T'], [makeTile('E'),'E']);
  const r = scoreWord(cate, { tileValues, lengthBonusPerLetter: 5 });   // 3+1+1+1=6 wit + (4-3)*5=5 → 11
  assert.equal(r.wit, 11);
  assert.equal(r.points, 11);
});

test('wild contributes 0 base wit but its resolved letter counts for length', () => {
  resetTileIds();
  const s = sel([makeTile('C'),'C'], [makeTile(WILD),'A'], [makeTile('T'),'T']);
  // 3 + 0 + 1 = 4 wit, len 3 → +0
  assert.equal(scoreWord(s, { tileValues, lengthBonusPerLetter: 5 }).wit, 4);
});

test('phase order is enforced regardless of relic array order', () => {
  resetTileIds();
  const cat = sel([makeTile('C'),'C'], [makeTile('A'),'A'], [makeTile('T'),'T']);   // 5 wit
  const addMult = { id: 'm', evaluate: () => ({ addMult: 2 }) };
  const timesMult = { id: 'x', evaluate: () => ({ timesMult: 3 }) };
  const a = scoreWord(cat, { tileValues, lengthBonusPerLetter: 0, relics: [addMult, timesMult] });
  const b = scoreWord(cat, { tileValues, lengthBonusPerLetter: 0, relics: [timesMult, addMult] });
  assert.equal(a.points, 45);   // 5 × ((1+2) × 3)
  assert.equal(b.points, 45);   // identical regardless of order
});
```

- [ ] **Step 2: Run test to verify it fails** — Run: `node --test test/scoring.test.js` — Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/scoring.js
export function scoreWord(selection, { tileValues, lengthBonusPerLetter, relics = [], context = {} }) {
  const letters = selection.map(s => s.letter.toUpperCase());
  const word = letters.join('');
  const ctx = { word, letters, selection, ...context };

  // Phase 1 — base Wit
  let wit = selection.reduce(
    (s, { tile, letter }) => s + (tile.letter === '*' ? 0 : (tileValues[letter.toUpperCase()] || 0)),
    0
  );
  wit += Math.max(0, letters.length - 3) * lengthBonusPerLetter;

  let addMult = 0, timesMult = 1;
  const apply = (d) => {
    if (!d) return;
    wit += d.addWit || 0;
    addMult += d.addMult || 0;
    timesMult *= (d.timesMult ?? 1);
  };

  for (const relic of relics) apply(relic.evaluate?.(ctx));          // global (none in Tier 0)
  for (const { tile } of selection)                                  // tile-mods (none in Tier 0)
    for (const mod of (tile.mods || [])) apply(mod.evaluate?.(tile, ctx));

  const mult = (1 + addMult) * timesMult;                            // +Mult then ×Mult
  return { wit, mult, points: wit * mult };
}
```

- [ ] **Step 4: Run test to verify it passes** — Run: `node --test test/scoring.test.js` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scoring.js test/scoring.test.js && git commit -m "feat: phase-ordered Wit×Mult scoring engine"
```

---

### Task 7: Run / round state machine

**Files:** Create `src/run.js`, `test/run.test.js`.
**Interfaces:**
- Consumes: `makeBag`, `makeTile`, `makeRng`, `validate`, `scoreWord`.
- Produces: `newRun({ config, dictionary, seed, targets?, deck?, stake?, loadout? }) -> RunState`; `drawRack(run)`; `playWord(run, selection) -> { ok, reason?, scored?, run }`; `discard(run)`; `nextRound(run)`. `RunState` fields: `roundIndex, target, targets, roundTotal, playsLeft, discardsLeft, bag, tileValues, relics, coins, rack, wordsPlayedThisRound, seed, rng, stake, deck, status` (`'playing'|'roundCleared'|'lost'|'won'`).

- [ ] **Step 1: Write the failing test**

```javascript
// test/run.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { newRun, playWord, nextRound } from '../src/run.js';
import { makeDictionary } from '../src/dictionary.js';
import { makeTile, resetTileIds } from '../src/tiles.js';

const dict = makeDictionary(['cat']);
const config = {
  STARTING_BAG: ['C','A','T'], TILE_VALUES: { C:3, A:1, T:1 },
  RACK_SIZE: 3, PLAYS_PER_ROUND: 2, DISCARDS_PER_ROUND: 1, MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 5, ROUND_TARGETS: [5, 100],
};
// Build a CAT selection and SEAT its tiles in run.rack so the legality guard passes.
const seatCat = (run) => {
  const s = [['C','C'],['A','A'],['T','T']].map(([letter, l]) => ({ tile: makeTile(letter), letter: l }));
  run.rack = s.map(x => x.tile);
  return s;
};

test('a word meeting target clears the round', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  const res = playWord(run, seatCat(run));    // CAT = 5 >= target 5
  assert.equal(res.ok, true);
  assert.equal(res.run.roundTotal, 5);
  assert.equal(res.run.status, 'roundCleared');
  assert.equal(res.run.wordsPlayedThisRound, 1);
});

test('running out of plays under target loses', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.target = 100; run.playsLeft = 1;
  const res = playWord(run, seatCat(run));     // 5 < 100, plays now 0
  assert.equal(res.run.status, 'lost');
});

test('an illegal selection (tile not in rack) is rejected without consuming a play', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  seatCat(run);
  const outsiders = [['C','C'],['A','A'],['T','T']].map(([letter, l]) => ({ tile: makeTile(letter), letter: l })); // fresh tiles, not in rack
  const before = run.playsLeft;
  const res = playWord(run, outsiders);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'illegal');
  assert.equal(run.playsLeft, before);         // no play consumed
});

test('clearing the last round wins', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.roundIndex = 1; run.status = 'roundCleared';
  assert.equal(nextRound(run).status, 'won');
});
```

- [ ] **Step 2: Run test to verify it fails** — Run: `node --test test/run.test.js` — Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/run.js
import { makeBag } from './bag.js';
import { makeTile } from './tiles.js';
import { makeRng } from './rng.js';
import { validate, isLegalSelection } from './word.js';
import { scoreWord } from './scoring.js';

export function newRun({ config, dictionary, seed, targets = config.ROUND_TARGETS, deck = null, stake = null, loadout = {} /* reserved for Tier 2 loadout boosts (Task 19) */ }) {
  const letters = (deck && deck.startingBag) || config.STARTING_BAG;
  return {
    config, dictionary,
    seed, rng: makeRng(seed),
    targets,
    roundIndex: 0,
    target: targets[0],
    roundTotal: 0,
    playsLeft: config.PLAYS_PER_ROUND,
    discardsLeft: config.DISCARDS_PER_ROUND,
    bag: makeBag(letters.map(l => makeTile(l))),
    tileValues: { ...config.TILE_VALUES },
    relics: [],
    coins: 0,
    rack: [],
    wordsPlayedThisRound: 0,
    stake, deck,
    status: 'playing',
  };
}

export function drawRack(run) {
  run.rack = run.bag.draw(run.config.RACK_SIZE, run.rng);
  return run.rack;
}

export function playWord(run, selection) {
  if (!isLegalSelection(selection, run.rack)) return { ok: false, reason: 'illegal', run };
  const v = validate(selection, run.dictionary, run.config.MIN_WORD_LEN);
  if (!v.ok) return { ok: false, reason: v.reason, run };
  const scored = scoreWord(selection, {
    tileValues: run.tileValues,
    lengthBonusPerLetter: run.config.LENGTH_BONUS_PER_LETTER,
    relics: run.relics,
    context: { wordsPlayedThisRound: run.wordsPlayedThisRound },
  });
  run.roundTotal += scored.points;
  run.wordsPlayedThisRound += 1;
  run.playsLeft -= 1;
  if (run.roundTotal >= run.target) run.status = 'roundCleared';
  else if (run.playsLeft <= 0) run.status = 'lost';
  return { ok: true, scored, run };
}

export function discard(run) {
  if (run.discardsLeft > 0) { run.discardsLeft -= 1; drawRack(run); }
  return run;
}

export function nextRound(run) {
  const next = run.roundIndex + 1;
  if (next >= run.targets.length) { run.status = 'won'; return run; }
  run.roundIndex = next;
  run.target = run.targets[next];
  run.roundTotal = 0;
  run.playsLeft = run.config.PLAYS_PER_ROUND;
  run.discardsLeft = run.config.DISCARDS_PER_ROUND;
  run.wordsPlayedThisRound = 0;
  run.status = 'playing';
  return run;
}
```

- [ ] **Step 4: Run test to verify it passes** — Run: `node --test test/run.test.js`, then `npm test` (all suites) — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/run.js test/run.test.js && git commit -m "feat: Tier 0 run/round state machine"
```

---

### Task 8: Save / resume (faithful)

**Files:** Create `src/storage.js`, `test/storage.test.js`.
**Interfaces — Produces:**
- `serializeRun(run) -> object` — bag tiles as `{id, letter, modIds}`, plus `rackIds`, `rngState`, `tileValues`, `relicIds` (empty Tier 0), and all scalar round fields.
- `deserializeRun(data, { config, dictionary }) -> RunState` — rehydrates tiles preserving ids, advances the id counter, restores the rack (by id), restores RNG state, restores `tileValues`.
- `saveRun(run, storage)` / `loadRun(storage, deps) -> RunState | null` — JSON under `'letterRide.run'`.

- [ ] **Step 1: Write the failing test**

```javascript
// test/storage.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { serializeRun, deserializeRun, saveRun, loadRun } from '../src/storage.js';
import { newRun, drawRack } from '../src/run.js';
import { makeDictionary } from '../src/dictionary.js';
import { resetTileIds } from '../src/tiles.js';

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
```

- [ ] **Step 2: Run test to verify it fails** — Run: `node --test test/storage.test.js` — Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/storage.js
import { makeBag } from './bag.js';
import { makeRng } from './rng.js';
import { rehydrateTile, setMinTileId, tileIdNum } from './tiles.js';

const KEY = 'letterRide.run';

export function serializeRun(run) {
  return {
    version: 1,                                          // bump when the schema changes
    seed: run.seed,
    rngState: run.rng.getState(),
    targets: run.targets,
    roundIndex: run.roundIndex,
    target: run.target,
    roundTotal: run.roundTotal,
    playsLeft: run.playsLeft,
    discardsLeft: run.discardsLeft,
    wordsPlayedThisRound: run.wordsPlayedThisRound,
    coins: run.coins,
    status: run.status,
    stake: run.stake,
    deck: run.deck,
    tileValues: { ...run.tileValues },
    relicIds: run.relics.map(r => r.id),                 // empty in Tier 0
    tiles: run.bag.tiles.map(t => ({ id: t.id, letter: t.letter, modIds: t.mods.map(m => m.id) })),
    rackIds: run.rack.map(t => t.id),
  };
}

export function deserializeRun(data, { config, dictionary }) {
  const tiles = data.tiles.map(rehydrateTile);
  const maxId = tiles.reduce((m, t) => Math.max(m, tileIdNum(t.id)), -1);
  setMinTileId(maxId);
  const byId = new Map(tiles.map(t => [t.id, t]));
  const rng = makeRng(data.seed);
  rng.setState(data.rngState);
  return {
    config, dictionary,
    seed: data.seed, rng,
    targets: data.targets,
    roundIndex: data.roundIndex,
    target: data.target,
    roundTotal: data.roundTotal,
    playsLeft: data.playsLeft,
    discardsLeft: data.discardsLeft,
    wordsPlayedThisRound: data.wordsPlayedThisRound,
    coins: data.coins,
    status: data.status,
    stake: data.stake,
    deck: data.deck,
    tileValues: { ...data.tileValues },
    relics: [],                                          // Tier 1 maps relicIds via RELICS
    bag: makeBag(tiles),
    rack: data.rackIds.map(id => byId.get(id)).filter(Boolean),
  };
}

export function saveRun(run, storage) {
  storage.setItem(KEY, JSON.stringify(serializeRun(run)));
}

export function loadRun(storage, deps) {
  const raw = storage.getItem(KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1) return null;     // schema changed → treat as no save
    return deserializeRun(data, deps);
  } catch {
    return null;                             // corrupt save → start fresh, never brick the page
  }
}
```

- [ ] **Step 4: Run test to verify it passes** — Run: `node --test test/storage.test.js`, then `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage.js test/storage.test.js && git commit -m "feat: faithful localStorage save/resume (tiles, rack, rng state)"
```

---

### Task 9: Minimal UI + wiring (Tier 0 playable — THE FUN GATE)

**Files:** Create `src/ui.js`, `src/main.js`, `src/style.css`.
**Note:** UI is verified manually (no DOM in Node). `ui.js` stays dumb — it renders `run` state and emits actions; all rules live in the tested modules. This task has no unit tests; its deliverable is a playable page.

- [ ] **Step 1: Implement `src/main.js`** (boot, resume-or-new, wire actions):

```javascript
// src/main.js
import { CONFIG } from './config.js';
import { loadFromFile } from './dictionary.js';
import { newRun, drawRack, playWord, discard, nextRound } from './run.js';
import { saveRun, loadRun } from './storage.js';
import { renderRun, bindControls, flashInvalid } from './ui.js';

try {
  const blocklist = CONFIG.PROFANITY_FILTER ? CONFIG.PROFANITY_BLOCKLIST : [];
  const dictionary = await loadFromFile('assets/enable1.txt', blocklist);

  let run = loadRun(window.localStorage, { config: CONFIG, dictionary });   // null on absent/corrupt → fresh
  if (!run) {
    run = newRun({ config: CONFIG, dictionary, seed: Date.now() >>> 0, targets: CONFIG.TIER0_TARGETS });
    drawRack(run);
  }
  const save = () => saveRun(run, window.localStorage);
  const render = () => renderRun(run);

  bindControls({
    onSubmit(selection) {
      const res = playWord(run, selection);
      if (!res.ok) return flashInvalid(res.reason);
      if (run.status === 'playing') drawRack(run);
      save(); render();
    },
    onDiscard() { discard(run); save(); render(); },
    onNext() { nextRound(run); if (run.status === 'playing') drawRack(run); save(); render(); },
    onNewRun() {
      run = newRun({ config: CONFIG, dictionary, seed: Date.now() >>> 0, targets: CONFIG.TIER0_TARGETS });
      drawRack(run); save(); render();
    },
  });
  render();
} catch (err) {
  // Most likely cause: the dictionary asset failed to load (wrong serve root / not committed).
  // Surface it ON THE PAGE — on a phone you won't have a console open.
  document.getElementById('app').textContent =
    'Failed to start Letter Ride: ' + err.message + ' — check that assets/enable1.txt is present and served.';
}
```

- [ ] **Step 2: Implement `src/ui.js`** (tap-to-build; render state; emit actions). Render: the rack as tappable tiles, a staging row (the current selection), Points-vs-target, plays/discards left, and Submit / Backspace / Clear / Discard / Next / New-Run controls. Tapping a `*` (WILD) prompts for a letter (`prompt()` is fine for the prototype). Show round-cleared / won / lost states and validation flashes (`short` / `notword`):

```javascript
// src/ui.js
const app = () => document.getElementById('app');
let handlers = {};
let selection = [];      // [{ tile, letter }]
let lastRun = null;

export function bindControls(h) { handlers = h; }

export function flashInvalid(reason) {
  const el = document.getElementById('msg');
  if (el) el.textContent = reason === 'short' ? 'Too short (min 3).' : 'Not a word.';
}

function tapTile(tile) {
  if (selection.some(s => s.tile.id === tile.id)) return;   // each rack tile once
  let letter = tile.letter;
  if (letter === '*') {
    const choice = (window.prompt('Wild — choose a letter:') || '').toUpperCase().slice(0, 1);
    if (!/[A-Z]/.test(choice)) return;
    letter = choice;
  }
  selection.push({ tile, letter });
  renderRun(lastRun);
}

export function renderRun(run) {
  lastRun = run;
  const inRack = id => selection.some(s => s.tile.id === id);
  const staged = selection.map(s => s.letter).join('');
  const done = run.status !== 'playing';
  app().innerHTML = `
    <div id="hud">
      <div>Round ${run.roundIndex + 1}/${run.targets.length}</div>
      <div><b>${run.roundTotal}</b> / ${run.target} Points</div>
      <div>Plays ${run.playsLeft} · Discards ${run.discardsLeft}</div>
    </div>
    <div id="staging">${staged || '&nbsp;'}</div>
    <div id="rack">
      ${run.rack.map(t => `<button class="tile ${inRack(t.id) ? 'used' : ''}" data-id="${t.id}">${t.letter}</button>`).join('')}
    </div>
    <div id="msg"></div>
    <div id="controls">
      <button id="submit" ${done ? 'disabled' : ''}>Submit</button>
      <button id="back" ${done ? 'disabled' : ''}>⌫</button>
      <button id="clear" ${done ? 'disabled' : ''}>Clear</button>
      <button id="discard" ${done || run.discardsLeft <= 0 ? 'disabled' : ''}>Discard</button>
      ${run.status === 'roundCleared' ? '<button id="next">Next round →</button>' : ''}
      ${run.status === 'won' ? '<div class="end">🎉 Run cleared!</div><button id="new">New run</button>' : ''}
      ${run.status === 'lost' ? '<div class="end">💀 Out of plays.</div><button id="new">New run</button>' : ''}
    </div>`;

  run.rack.forEach(t => {
    const btn = app().querySelector(`.tile[data-id="${t.id}"]`);
    if (btn && !inRack(t.id)) btn.onclick = () => tapTile(t);
  });
  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  on('submit', () => { const s = selection; selection = []; handlers.onSubmit?.(s); });
  on('back', () => { selection.pop(); renderRun(run); });
  on('clear', () => { selection = []; renderRun(run); });
  on('discard', () => { selection = []; handlers.onDiscard?.(); });
  on('next', () => { selection = []; handlers.onNext?.(); });
  on('new', () => { selection = []; handlers.onNewRun?.(); });
}
```

- [ ] **Step 3: Style `src/style.css`** (phone-readable: large tiles, big tap targets, prominent score):

```css
:root { color-scheme: light dark; }
body { font-family: system-ui, sans-serif; margin: 0; padding: 16px; }
#hud { display: flex; justify-content: space-between; font-size: 1.1rem; margin-bottom: 12px; }
#staging { min-height: 2.2rem; font-size: 2rem; letter-spacing: 4px; text-align: center; font-weight: 700; }
#rack { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin: 12px 0; }
.tile { width: 56px; height: 56px; font-size: 1.6rem; font-weight: 700; border-radius: 10px; border: 2px solid #888; background: #fafafa; }
.tile.used { opacity: 0.3; }
#controls { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 14px; }
#controls button { font-size: 1.1rem; padding: 12px 18px; border-radius: 10px; }
#msg { text-align: center; color: #c0392b; min-height: 1.2rem; }
.end { width: 100%; text-align: center; font-size: 1.3rem; margin: 8px 0; }
```

- [ ] **Step 4: Manual verification**

Run: `npm run serve`. On the **phone**, open the `Network:` URL that `serve` prints (your Mac's
LAN address, e.g. `http://192.168.x.x:3000`) — **not** `localhost`, which the phone can't reach;
ensure the Mac firewall allows incoming connections, and that the phone is on the same Wi-Fi. On
desktop, `localhost` is fine. Verify:
- A rack of 9 tiles draws; tapping builds the staging word; Backspace/Clear work; a wild prompts for a letter.
- Submit scores a valid word (Points climb toward the target); invalid words flash `short`/`notword` and don't consume a play.
- Clearing the target shows "Next round →"; running out of plays under target shows the loss state; clearing all `TIER0_TARGETS` shows the win.
- Reload mid-round → the **same rack and run** resume (save/restore works).

- [ ] **Step 5: Commit**

```bash
git add src/ui.js src/main.js src/style.css && git commit -m "feat: Tier 0 playable tap-to-build UI"
```

> **🛑 TIER 0 GATE — PLAYTEST BEFORE CONTINUING.** Narrowed to what Tier 0 can actually decide:
> *(1) is tap-to-build ergonomic on the phone — tap / backspace / wild-prompt / submit all fluid,
> big enough targets? and (2) can you almost always form a 3+ word from a 9-tile rack (no
> dead-rack frustration)?* **"Is it deeply fun" is NOT a Tier 0 question** — the design's fun is
> meant to come from the modifier engine, which Tier 0 doesn't have; so a flat-but-functional
> spine is **expected**, not a reason to abandon. Defer the deep-fun judgment to the Tier 1 gate.
> Tune `CONFIG` (rack size, length bonus) for ergonomics. **If you lose on raw target size rather
> than dissatisfaction, that's a tuning miss — lower `TIER0_TARGETS`, don't read it as "unfun."**
> Quick reachability sanity check before trusting the curve: score the best word from a few
> seeded base-bag racks against the top `TIER0_TARGETS` (185, 230) to confirm they're beatable in
> `PLAYS_PER_ROUND`. **Only if tap-to-build itself feels bad after honest tuning should you STOP
> and reconsider the core mechanic.**

---

## Self-Review (plan author)

- **Spec coverage (Tier 0 slice of the design):** tiles §5 → Task 3; bag/rack §5 → Tasks 4/7; tap-to-build word formation §5 → Task 5; phase scoring §4 → Task 6 (+ order-independence test); run loop §3 → Task 7; save/resume §9 + design §11 storage row → Task 8; profanity §12 → Task 2; tap-to-build UI §2 → Task 9; Tier-0 gate §10 → Task 9 gate. Shop/relics/mods/meta (§6–§9) are **out of Tier 0 scope** by design — they are the next tiers' plans.
- **Review-finding coverage (round 1, the spec/roadmap review):** blocker (tile-id preservation) → Task 3 `makeTile(…, id)` + `rehydrateTile` + Task 8 deserialize; tileValues persistence → Task 8 serialize + test; seed uint32 → Task 9 `Date.now() >>> 0`; profanity → Task 2; faithful resume (rack + rng state, found while detailing) → Tasks 1 & 8. (Recycler wiring, relic rehydration, short-word harness, Tier-1 gate criteria are Tier-1 plan items — recorded in the roadmap.)
- **Review-finding coverage (round 2, this plan's review):** doc-drift blocker → roadmap Tier 0 collapsed to a pointer at this plan (single source of truth) + CLAUDE.md "Start here" updated; rules-layer legality not enforced → `isLegalSelection` in Task 5 (tested) + guard in Task 7 `playWord` (returns `reason:'illegal'`, tested); dictionary fetch-failure → `loadFromFile` throws on non-ok status (Task 2) + `main.js` try/catch surfaces the error on-page (Task 9); corrupt/stale save bricks boot → `version` field + `loadRun` try/catch returns `null` (Task 8, tested); Tier 0 gate measured wrong thing → gate reframed to ergonomics + dead-rack, "deeply fun" deferred to Tier 1 (Task 9 gate + design §10); `TIER0_TARGETS` beatability unvalidated → reachability sanity-check note in the gate. Nits: unused `nextBefore` removed + `loadout` marked reserved; id-counter `resetTileIds()` convention noted (Task 3); serve-to-phone LAN-IP note (Task 9 Step 4); profanity blocklist documented as "wired but unpopulated" (Task 2).
- **Placeholder scan:** none — every code step shows complete, runnable code; the only manual step (Task 9 UI) is explicitly manual-verify with concrete acceptance checks.
- **Type consistency:** `scoreWord(selection, {tileValues, lengthBonusPerLetter, relics, context})` is identical in Tasks 6 and 7; the `selection` shape (`{tile, letter}[]`) is consistent across Tasks 5/6/7/9; `isLegalSelection(selection, rack)` (Task 5) is imported and called in Task 7 `playWord`; `makeTile`/`rehydrateTile`/`setMinTileId`/`tileIdNum` signatures match between Tasks 3 and 8; bag `remove(tileId)` (Task 4) is by id, as Task 8 relies on. RNG `getState`/`setState` (Task 1) are exactly what Task 8 calls; `serializeRun` writes `version:1` and `loadRun` checks it (Task 8).
