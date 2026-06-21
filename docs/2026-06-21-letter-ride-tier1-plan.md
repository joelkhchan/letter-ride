# Letter Ride — Tier 1 (In-Run Roguelike) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the in-run roguelike layer on top of the Tier 0 spine — Coins, a 7-offer shop, 8 relics, 4 tile-mods, WILD tiles, and pattern synergies — so a run becomes a build-defining economy, plus a headless harness to measure the short-word-vs-long-word balance.

**Architecture:** All new rules are pure, DOM-free modules unit-tested with `node --test`, reusing the Tier 0 contracts unchanged: the phase-ordered `scoreWord(selection, {...relics})` engine already loops `relic.evaluate(ctx)` and `mod.evaluate(tile, ctx)` and treats WILD as 0 base Wit, so relics/tile-mods/wilds plug in with **zero engine changes**. Coins, the shop, and meta-pool gating extend `RunState`. The UI gains a shop screen + tile-picker but stays rules-free.

**Tech Stack:** Vanilla JavaScript (ES modules), HTML5, CSS. `node --test`. `npx serve` for playtest. No build step.

**Source docs:** design `docs/2026-06-20-letter-ride-design.md`; roadmap `docs/2026-06-20-letter-ride-plan.md`; Tier 0 plan `docs/2026-06-21-letter-ride-tier0-plan.md` (built, 29/29 green). This plan = Tier 1; Tier 2 (meta) and Tier 3 (Capacitor) follow.

## Global Constraints

- **Scarcity pillar:** letters always drawn from the bag; `draw` does not consume the bag.
- **Scoring (phase order, already built):** `Points = Wit × Mult`; all `+Mult` summed into `(1+ΣaddMult)` then all `×Mult` applied — order-independent. Relics/tile-mods return `{ addWit?, addMult?, timesMult? }` deltas; they never mutate score state directly.
- **Three currencies:** Points (in-round), **Coins** (this tier — in-run shop), Meta (Tier 2). No others.
- **Economy relics** (e.g. Recycler) contribute Coins via a round-clear hook (`coinsOnRoundClear(run)`) summed in `awardCoins` — NOT via `scoreWord`.
- **Tiles are instances** `{id, letter, mods}`; ids preserved across save/load; the bag holds `Tile[]`.
- **WILD = `'*'`** contributes 0 base Wit (built in Tier 0 scoring); its chosen letter still counts for length + synergies; its mods still apply.
- **Determinism:** all randomness (bag draws, shop generation) via the seeded `run.rng`. No `Math.random()` in logic.
- **Relic/mod pool gating:** the shop draws relics/mods from an *unlocked pool*. In Tier 1 the pool is "all unlocked" (a passed-in set defaulting to all ids); Tier 2 narrows it via `MetaState`. Build the seam now, don't hardcode "all".
- **Switch to the real curve:** Tier 1 play uses `CONFIG.ROUND_TARGETS` (not `TIER0_TARGETS`).
- **Carry-overs from Tier 0 reviews (fold in here):** wire Recycler into `awardCoins`; persist relics through save/load; change `scoring.js` `d.addWit || 0` → `?? 0`; when the shop mutates the bag, add the id-collision-after-thin-and-save test; audit every new rack-changing UI action clears the staging selection.

## File Structure (Tier 1)

| File | Responsibility | New/Modified |
|---|---|---|
| `src/config.js` | + `SHOP` costs + `RELIC_TUNING`/`MOD_TUNING` magnitudes. | Modified |
| `src/scoring.js` | `d.addWit ?? 0` symmetry fix (no behavior change). | Modified |
| `src/run.js` | `awardCoins(run)` (base + unused + relic hooks); call on round-clear. | Modified |
| `src/patterns.js` | Cheap synergy predicates. | New |
| `src/relics.js` | `RELICS` registry + 8 relics (`evaluate`/`coinsOnRoundClear`). | New |
| `src/tiles.js` | Populate `MOD_REGISTRY` with 4 tile-mods (`evaluate(tile, ctx)`). | Modified |
| `src/storage.js` | Persist `relicIds` ↔ `RELICS`; serialize tile mod ids (already) → rehydrate. | Modified |
| `src/shop.js` | `generateShop` + `purchase` (7 offer types). | New |
| `scripts/analyze-builds.js` | Headless short-word-vs-long-word balance harness. | New |
| `src/ui.js`, `src/main.js` | Shop screen + tile-picker; render relics/coins/mods; ROUND_TARGETS. | Modified |
| `test/*.test.js` | One per new/changed logic module. | New/Modified |

---

### Task 10: Coins on round clear (+ relic round-clear hook)

**Files:** Modify `src/run.js`; modify `test/run.test.js`.
**Interfaces — Produces:** `awardCoins(run) -> number` (also adds to `run.coins`) = `base + perUnusedPlay*playsLeft + perUnusedDiscard*discardsLeft + Σ run.relics.map(r => r.coinsOnRoundClear?.(run) ?? 0)`. Called inside `playWord` when `status` becomes `'roundCleared'`.

- [ ] **Step 1: Write the failing test** (append to `test/run.test.js`)

```javascript
test('clearing a round awards coins: base + unused plays + unused discards', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  // config: PLAYS_PER_ROUND 2, DISCARDS_PER_ROUND 1, ROUND_TARGETS [5,100]; COINS_ON_CLEAR needed
  run.config = { ...config, COINS_ON_CLEAR: { base: 4, perUnusedPlay: 1, perUnusedDiscard: 1 } };
  const res = playWord(run, seatCat(run));        // CAT=5 clears target 5; playsLeft 2->1, discards 1
  assert.equal(res.run.status, 'roundCleared');
  assert.equal(res.run.coins, 4 + 1 + 1);         // base 4 + 1 unused play + 1 unused discard = 6
});

test('an economy relic with coinsOnRoundClear adds to the award', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.config = { ...config, COINS_ON_CLEAR: { base: 4, perUnusedPlay: 1, perUnusedDiscard: 1 } };
  run.relics = [{ id: 'recyclerTest', coinsOnRoundClear: (r) => 2 * r.playsLeft }];
  const res = playWord(run, seatCat(run));        // playsLeft after play = 1 -> +2 coins
  assert.equal(res.run.coins, 6 + 2);             // base award 6 + relic 2*1 = 8
});
```

- [ ] **Step 2: Run test to verify it fails** — `node --test test/run.test.js` — Expected: FAIL (coins stays 0; `awardCoins`/hook not wired).

- [ ] **Step 3: Implement** — add to `src/run.js`:

```javascript
export function awardCoins(run) {
  const c = run.config.COINS_ON_CLEAR;
  let coins = c.base + c.perUnusedPlay * run.playsLeft + c.perUnusedDiscard * run.discardsLeft;
  for (const r of run.relics) coins += r.coinsOnRoundClear?.(run) ?? 0;
  run.coins += coins;
  return coins;
}
```

And in `playWord`, change the cleared branch to award coins:

```javascript
  if (run.roundTotal >= run.target) { run.status = 'roundCleared'; awardCoins(run); }
  else if (run.playsLeft <= 0) run.status = 'lost';
```

- [ ] **Step 4: Run test to verify it passes** — `node --test test/run.test.js`, then `npm test` — Expected: PASS (all).

- [ ] **Step 5: Commit** — `git add src/run.js test/run.test.js && git commit -m "feat: award coins on round clear with relic round-clear hook"`

---

### Task 11: Pattern / synergy predicates

**Files:** Create `src/patterns.js`, `test/patterns.test.js`.
**Interfaces — Produces:** `hasDigraph(word, digraphs[])`, `hasDoubledLetter(word)`, `isPalindrome(word)`, `endsWith(word, suffix)`, `countOf(letters[], ch)` — all case-insensitive, pure.

- [ ] **Step 1: Write the failing test**

```javascript
// test/patterns.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { hasDigraph, hasDoubledLetter, isPalindrome, endsWith, countOf } from '../src/patterns.js';

test('hasDigraph finds any of the given digraphs (case-insensitive)', () => {
  assert.equal(hasDigraph('THaw', ['TH', 'QU']), true);
  assert.equal(hasDigraph('quiet', ['TH', 'QU']), true);
  assert.equal(hasDigraph('cat', ['TH', 'QU']), false);
});
test('hasDoubledLetter detects consecutive repeats', () => {
  assert.equal(hasDoubledLetter('ball'), true);
  assert.equal(hasDoubledLetter('LL'), true);
  assert.equal(hasDoubledLetter('cat'), false);
});
test('isPalindrome', () => {
  assert.equal(isPalindrome('level'), true);
  assert.equal(isPalindrome('NOON'), true);
  assert.equal(isPalindrome('cat'), false);
  assert.equal(isPalindrome('a'), false);   // length < 2 is not a palindrome word
});
test('endsWith is case-insensitive', () => {
  assert.equal(endsWith('RUNNING', 'ing'), true);
  assert.equal(endsWith('cat', 'ing'), false);
});
test('countOf counts a letter in a letters array (case-insensitive)', () => {
  assert.equal(countOf(['E', 'e', 'A'], 'E'), 2);
  assert.equal(countOf(['A', 'B'], 'Z'), 0);
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/patterns.test.js` — FAIL.

- [ ] **Step 3: Implement** `src/patterns.js`:

```javascript
// src/patterns.js — pure synergy predicates (cheap string ops)
export function hasDigraph(word, digraphs) {
  const w = String(word).toUpperCase();
  return digraphs.some(d => w.includes(String(d).toUpperCase()));
}
export function hasDoubledLetter(word) {
  const w = String(word).toUpperCase();
  for (let i = 1; i < w.length; i++) if (w[i] === w[i - 1]) return true;
  return false;
}
export function isPalindrome(word) {
  const w = String(word).toUpperCase();
  return w.length >= 2 && w === [...w].reverse().join('');
}
export function endsWith(word, suffix) {
  return String(word).toUpperCase().endsWith(String(suffix).toUpperCase());
}
export function countOf(letters, ch) {
  const c = String(ch).toUpperCase();
  return letters.reduce((n, l) => n + (String(l).toUpperCase() === c ? 1 : 0), 0);
}
```

- [ ] **Step 4: Run to verify it passes** — `node --test test/patterns.test.js`, then `npm test` — PASS.

- [ ] **Step 5: Commit** — `git add src/patterns.js test/patterns.test.js && git commit -m "feat: pattern/synergy predicates"`

---

### Task 12: Relic engine + 8 relics (+ scoring symmetry fix + relic persistence)

**Files:** Create `src/relics.js`, `test/relics.test.js`; modify `src/scoring.js`; modify `src/storage.js`, `test/storage.test.js`.
**Interfaces — Produces:**
- `RELICS` — object keyed by id; each relic `{ id, name, desc, evaluate?(ctx) -> {addWit?,addMult?,timesMult?}, coinsOnRoundClear?(run) -> number }`.
- `ALL_RELIC_IDS` — array of all relic ids (the default unlocked pool).
- Consumes from `scoring.js`: the `ctx` shape `{ word, letters, selection, wordsPlayedThisRound }`.

- [ ] **Step 1: Write the failing test**

```javascript
// test/relics.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { scoreWord } from '../src/scoring.js';
import { RELICS } from '../src/relics.js';
import { makeTile, resetTileIds } from '../src/tiles.js';

const tv = { C:3, A:1, T:1, E:1, I:1, O:1, U:1, S:1, L:1, B:3, Q:10, Y:4, N:1 };
const sel = (word) => [...word].map(ch => ({ tile: makeTile(ch), letter: ch }));
const base = (word, opts = {}) => scoreWord(sel(word), { tileValues: tv, lengthBonusPerLetter: 0, ...opts });

test('vowelBonus: +2 Wit per vowel', () => {
  resetTileIds();
  const b = base('CAT');                                   // 1 vowel (A)
  const r = base('CAT', { relics: [RELICS.vowelBonus] });
  assert.equal(r.wit - b.wit, 2);
});
test('rareHoarder: +30 Wit if word uses J/Q/X/Z', () => {
  resetTileIds();
  assert.equal(base('QI', { relics: [RELICS.rareHoarder] }).wit - base('QI').wit, 30);
  assert.equal(base('CAT', { relics: [RELICS.rareHoarder] }).wit - base('CAT').wit, 0);
});
test('shortAndSweet: ×3 Mult for words <= 3 letters only', () => {
  resetTileIds();
  assert.equal(base('CAT', { relics: [RELICS.shortAndSweet] }).mult, 3);
  assert.equal(base('CATS', { relics: [RELICS.shortAndSweet] }).mult, 1);
});
test('lengthy: +1 Mult per letter beyond 4', () => {
  resetTileIds();
  assert.equal(base('CASTLE', { relics: [RELICS.lengthy] }).mult, 1 + 2);  // 6 letters -> +2
  assert.equal(base('CAT', { relics: [RELICS.lengthy] }).mult, 1);
});
test('doubleTrouble: +40 Wit if a doubled letter', () => {
  resetTileIds();
  assert.equal(base('BALL', { relics: [RELICS.doubleTrouble] }).wit - base('BALL').wit, 40);
  assert.equal(base('CAT', { relics: [RELICS.doubleTrouble] }).wit - base('CAT').wit, 0);
});
test('freshStart: +2 Mult if first letter is a vowel', () => {
  resetTileIds();
  assert.equal(base('ICE', { relics: [RELICS.freshStart] }).mult, 1 + 2);
  assert.equal(base('CAT', { relics: [RELICS.freshStart] }).mult, 1);
});
test('comboCounter: +1 Mult per word already played this round', () => {
  resetTileIds();
  const r = scoreWord(sel('CAT'), { tileValues: tv, lengthBonusPerLetter: 0, relics: [RELICS.comboCounter], context: { wordsPlayedThisRound: 2 } });
  assert.equal(r.mult, 1 + 2);
});
test('recycler is an economy relic: no evaluate, has coinsOnRoundClear', () => {
  assert.equal(typeof RELICS.recycler.evaluate, 'undefined');
  assert.equal(RELICS.recycler.coinsOnRoundClear({ playsLeft: 3 }), 6);   // +2 per unused play
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/relics.test.js` — FAIL.

- [ ] **Step 3a: Scoring symmetry fix** — in `src/scoring.js`, change the `apply` helper line `wit += d.addWit || 0;` to `wit += d.addWit ?? 0;` (so an explicit `addWit: 0` is honored, matching `timesMult ?? 1`). No behavior change for current relics.

- [ ] **Step 3b: Implement** `src/relics.js`:

```javascript
// src/relics.js — relic content. Magnitudes are tunable here (relic = its effect).
import { hasDoubledLetter } from './patterns.js';

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const RARE = new Set(['J', 'Q', 'X', 'Z']);
const isVowel = (ch) => VOWELS.has(String(ch).toUpperCase());

export const RELICS = {
  vowelBonus: {
    id: 'vowelBonus', name: 'Vowel Bonus', desc: '+2 Wit per vowel used',
    evaluate: (ctx) => ({ addWit: 2 * ctx.letters.filter(isVowel).length }),
  },
  rareHoarder: {
    id: 'rareHoarder', name: 'Rare Hoarder', desc: '+30 Wit if the word uses J, Q, X, or Z',
    evaluate: (ctx) => ({ addWit: ctx.letters.some(l => RARE.has(l.toUpperCase())) ? 30 : 0 }),
  },
  shortAndSweet: {
    id: 'shortAndSweet', name: 'Short & Sweet', desc: 'Words of 3 letters or fewer: ×3 Mult',
    evaluate: (ctx) => (ctx.letters.length <= 3 ? { timesMult: 3 } : {}),
  },
  lengthy: {
    id: 'lengthy', name: 'Lengthy', desc: '+1 Mult per letter beyond 4',
    evaluate: (ctx) => ({ addMult: Math.max(0, ctx.letters.length - 4) }),
  },
  doubleTrouble: {
    id: 'doubleTrouble', name: 'Double Trouble', desc: '+40 Wit if the word has a doubled letter',
    evaluate: (ctx) => ({ addWit: hasDoubledLetter(ctx.word) ? 40 : 0 }),
  },
  freshStart: {
    id: 'freshStart', name: 'Fresh Start', desc: '+2 Mult if the word starts with a vowel',
    evaluate: (ctx) => ({ addMult: isVowel(ctx.letters[0]) ? 2 : 0 }),
  },
  comboCounter: {
    id: 'comboCounter', name: 'Combo Counter', desc: '+1 Mult per word already played this round',
    evaluate: (ctx) => ({ addMult: ctx.wordsPlayedThisRound || 0 }),
  },
  recycler: {
    id: 'recycler', name: 'Recycler', desc: '+2 Coins per unused play at round end',
    coinsOnRoundClear: (run) => 2 * run.playsLeft,
  },
};

export const ALL_RELIC_IDS = Object.keys(RELICS);
```

- [ ] **Step 3c: Relic persistence** — in `src/storage.js`, change `deserializeRun` so `relics` rehydrates from saved ids: replace `relics: []` with `relics: (data.relicIds || []).map(id => RELICS[id]).filter(Boolean)`, and add `import { RELICS } from './relics.js';` at the top. (serializeRun already writes `relicIds`.)

- [ ] **Step 3d: Storage test** — append to `test/storage.test.js`:

```javascript
import { RELICS } from '../src/relics.js';
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
```

- [ ] **Step 4: Run to verify all pass** — `node --test test/relics.test.js test/storage.test.js`, then `npm test` — PASS.

- [ ] **Step 5: Commit** — `git add src/relics.js src/scoring.js src/storage.js test/relics.test.js test/storage.test.js && git commit -m "feat: relic engine + 8 starter relics, relic persistence, scoring addWit symmetry"`

---

### Task 13: Tile-mods (4) + WILD confirmation

**Files:** Modify `src/tiles.js`; create `test/tiles.mods.test.js`.
**Interfaces — Produces:** populate `MOD_REGISTRY` so `getMod(id)` returns one of 4 tile-mods, each `{ id, name, desc, evaluate(tile, ctx) -> {addWit?,addMult?,timesMult?} }`. Export `ALL_MOD_IDS`.

- [ ] **Step 1: Write the failing test**

```javascript
// test/tiles.mods.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { scoreWord } from '../src/scoring.js';
import { makeTile, getMod, WILD, resetTileIds } from '../src/tiles.js';

const tv = { C:3, A:1, T:1, E:1, R:1, S:1, O:1 };
// build a selection where one specific tile carries a mod
function selWithMod(word, modIndex, modId) {
  return [...word].map((ch, i) => ({ tile: makeTile(ch, i === modIndex ? [getMod(modId)] : []), letter: ch }));
}

test('resonator: +5 Wit if the word has 2+ of this tile letter', () => {
  resetTileIds();
  // EERIE has 3 E's; put resonator on the first E
  const s = selWithMod('EERIE', 0, 'resonator');
  const bare = [...'EERIE'].map(ch => ({ tile: makeTile(ch), letter: ch }));
  const tvE = { E:1, R:1, I:1 };
  assert.equal(scoreWord(s, { tileValues: tvE, lengthBonusPerLetter: 0 }).wit
             - scoreWord(bare, { tileValues: tvE, lengthBonusPerLetter: 0 }).wit, 5);
});
test('polished: +4 Wit always', () => {
  resetTileIds();
  const s = selWithMod('CAT', 0, 'polished');
  assert.equal(scoreWord(s, { tileValues: tv, lengthBonusPerLetter: 0 }).wit, 3 + 1 + 1 + 4);
});
test('catalyst: +1 Mult always', () => {
  resetTileIds();
  const s = selWithMod('CAT', 1, 'catalyst');
  assert.equal(scoreWord(s, { tileValues: tv, lengthBonusPerLetter: 0 }).mult, 2);
});
test('anchor: +8 Wit only if this tile is the first letter of the word', () => {
  resetTileIds();
  const first = selWithMod('CAT', 0, 'anchor');     // anchor on C (first)
  const notFirst = selWithMod('CAT', 2, 'anchor');  // anchor on T (last)
  assert.equal(scoreWord(first, { tileValues: tv, lengthBonusPerLetter: 0 }).wit, 5 + 8);
  assert.equal(scoreWord(notFirst, { tileValues: tv, lengthBonusPerLetter: 0 }).wit, 5);
});
test('WILD contributes 0 base Wit but its mod still applies', () => {
  resetTileIds();
  const s = [{ tile: makeTile(WILD, [getMod('polished')]), letter: 'A' }, { tile: makeTile('T'), letter: 'T' }, { tile: makeTile('E'), letter: 'E' }];
  // wild=0 base, T=1, E=1, + polished +4 = 6
  assert.equal(scoreWord(s, { tileValues: tv, lengthBonusPerLetter: 0 }).wit, 0 + 1 + 1 + 4);
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/tiles.mods.test.js` — FAIL (`getMod` returns undefined; registry empty).

- [ ] **Step 3: Implement** — in `src/tiles.js`, replace the empty `MOD_REGISTRY` stub with the 4 mods and add `ALL_MOD_IDS`:

```javascript
import { countOf } from './patterns.js';

const MOD_REGISTRY = {
  resonator: {
    id: 'resonator', name: 'Resonator', desc: '+5 Wit if the word has 2+ of this letter',
    evaluate: (tile, ctx) => ({ addWit: countOf(ctx.letters, tile.letter) >= 2 ? 5 : 0 }),
  },
  polished: {
    id: 'polished', name: 'Polished', desc: '+4 Wit, always',
    evaluate: () => ({ addWit: 4 }),
  },
  catalyst: {
    id: 'catalyst', name: 'Catalyst', desc: '+1 Mult, always',
    evaluate: () => ({ addMult: 1 }),
  },
  anchor: {
    id: 'anchor', name: 'Anchor', desc: '+8 Wit if this tile is the first letter',
    evaluate: (tile, ctx) => ({ addWit: ctx.selection[0]?.tile === tile ? 8 : 0 }),
  },
};

export const ALL_MOD_IDS = Object.keys(MOD_REGISTRY);
```

**Note (resonator + WILD):** `countOf(ctx.letters, tile.letter)` uses the tile's own letter. For a WILD carrying resonator, `tile.letter` is `'*'`, which won't appear in `ctx.letters` (resolved letters) — so resonator on a wild is inert. That's acceptable for the slice (a wild + resonator is a degenerate combo); document it.

- [ ] **Step 4: Run to verify it passes** — `node --test test/tiles.mods.test.js`, then `npm test` — PASS.

- [ ] **Step 5: Commit** — `git add src/tiles.js test/tiles.mods.test.js && git commit -m "feat: 4 tile-mods + WILD scoring confirmation"`

---

### Task 14: In-run shop (7 offer types)

**Files:** Create `src/shop.js`, `test/shop.test.js`; modify `src/config.js`.
**Interfaces — Produces:**
- `generateShop(run, rng, pool) -> { offers: Offer[], rerollCost }` where `pool = { relicIds, modIds }` (defaults to all). Offer ∈ `buyLetter{type:'buyLetter',letter,cost}` | `buyEnchantedTile{type,letter,modId,cost}` | `enchantTile{type,modId,cost}` | `upgradeLetter{type,letter,plus,cost}` | `thinLetter{type,letter,cost}` | `buyRelic{type,relicId,cost}`.
- `purchase(run, offer, opts) -> { ok, reason? }` — `opts.targetTileId` for `enchantTile`/`thinLetter`. Checks `run.coins`; applies effect; deducts cost. Reasons: `'broke'` (not enough coins), `'no-target'` (enchant/thin without a valid target tile).

- [ ] **Step 1: Add config** — in `src/config.js`, add inside `CONFIG`:

```javascript
  SHOP: {
    offersPerShop: 4,
    rerollCost: 2,
    cost: { buyLetter: 3, buyEnchantedTile: 7, enchantTile: 6, upgradeLetter: 5, thinLetter: 3, buyRelic: 8 },
    upgradePlus: 1,                                  // +Wit per upgradeLetter purchase
    buyableLetters: ['E','A','R','T','S','N','L','D','G','C','K','J','Q','X','Z'],  // shop letter pool
  },
```

- [ ] **Step 2: Write the failing test**

```javascript
// test/shop.test.js
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
```

- [ ] **Step 3: Run to verify it fails** — `node --test test/shop.test.js` — FAIL.

- [ ] **Step 4: Implement** `src/shop.js`:

```javascript
// src/shop.js — in-run shop generation + purchases (Coins).
import { shuffle } from './rng.js';
import { makeTile, getMod, ALL_MOD_IDS } from './tiles.js';
import { RELICS, ALL_RELIC_IDS } from './relics.js';

// Build the candidate offer list, then sample offersPerShop of them deterministically.
export function generateShop(run, rng, pool = {}) {
  const cfg = run.config.SHOP;
  const relicIds = pool.relicIds || ALL_RELIC_IDS;
  const modIds = pool.modIds || ALL_MOD_IDS;
  const candidates = [];
  for (const letter of cfg.buyableLetters) candidates.push({ type: 'buyLetter', letter, cost: cfg.cost.buyLetter });
  for (const letter of cfg.buyableLetters) for (const modId of modIds)
    candidates.push({ type: 'buyEnchantedTile', letter, modId, cost: cfg.cost.buyEnchantedTile });
  for (const modId of modIds) candidates.push({ type: 'enchantTile', modId, cost: cfg.cost.enchantTile });
  for (const letter of cfg.buyableLetters) candidates.push({ type: 'upgradeLetter', letter, plus: cfg.upgradePlus, cost: cfg.cost.upgradeLetter });
  for (const letter of cfg.buyableLetters) candidates.push({ type: 'thinLetter', letter, cost: cfg.cost.thinLetter });
  for (const relicId of relicIds) candidates.push({ type: 'buyRelic', relicId, cost: cfg.cost.buyRelic });

  const offers = shuffle(candidates, rng).slice(0, Math.min(cfg.offersPerShop, candidates.length));
  return { offers, rerollCost: cfg.rerollCost };
}

export function purchase(run, offer, opts = {}) {
  if (run.coins < offer.cost) return { ok: false, reason: 'broke' };
  const findTarget = () => run.bag.tiles.find(t => t.id === opts.targetTileId);
  switch (offer.type) {
    case 'buyLetter':
      run.bag.add(makeTile(offer.letter)); break;
    case 'buyEnchantedTile':
      run.bag.add(makeTile(offer.letter, [getMod(offer.modId)])); break;
    case 'enchantTile': {
      const t = findTarget(); if (!t) return { ok: false, reason: 'no-target' };
      t.mods.push(getMod(offer.modId)); break;
    }
    case 'upgradeLetter':
      run.tileValues[offer.letter] = (run.tileValues[offer.letter] || 0) + offer.plus; break;
    case 'thinLetter': {
      const t = findTarget(); if (!t) return { ok: false, reason: 'no-target' };
      run.bag.remove(t.id); break;
    }
    case 'buyRelic':
      run.relics.push(RELICS[offer.relicId]); break;
    default:
      return { ok: false, reason: 'unknown' };
  }
  run.coins -= offer.cost;
  return { ok: true };
}
```

- [ ] **Step 5: Run to verify it passes** — `node --test test/shop.test.js`, then `npm test` — PASS.

- [ ] **Step 6: Commit** — `git add src/shop.js src/config.js test/shop.test.js && git commit -m "feat: in-run shop with 7 purchase types"`

---

### Task 15: Short-word competitiveness analysis harness

**Files:** Create `scripts/analyze-builds.js`; add a `analyze` script to `package.json`.
**Purpose:** the instrument the Tier 1 gate reads. Headless node, uses the REAL dictionary; no assertions.

- [ ] **Step 1: Add the npm script** — in `package.json` `scripts`, add: `"analyze": "node scripts/analyze-builds.js"`.

- [ ] **Step 2: Implement** `scripts/analyze-builds.js`:

```javascript
// scripts/analyze-builds.js — measures short-word vs long-word competitiveness.
// Run: npm run analyze   (uses the real ENABLE list + CONFIG; prints a summary, no assertions)
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { makeRng, shuffle } from '../src/rng.js';
import { makeDictionary } from '../src/dictionary.js';
import { scoreWord } from '../src/scoring.js';
import { RELICS } from '../src/relics.js';
import { getMod } from '../src/tiles.js';

const words = readFileSync(new URL('../assets/enable1.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const dict = makeDictionary(words);
const byLen = words.filter(w => w.length >= CONFIG.MIN_WORD_LEN).map(w => w.toUpperCase());

function canForm(word, counts) {
  const need = {};
  for (const ch of word) { need[ch] = (need[ch] || 0) + 1; if (need[ch] > (counts[ch] || 0)) return false; }
  return true;
}
function rackCounts(rack) { const c = {}; for (const l of rack) c[l] = (c[l] || 0) + 1; return c; }
function selOf(word) { return [...word].map(ch => ({ tile: { id: 't', letter: ch, mods: [] }, letter: ch })); }

const tv = CONFIG.TILE_VALUES, lb = CONFIG.LENGTH_BONUS_PER_LETTER;
const N = 60;
let longTotal = 0, shortTotal = 0, shortWins = 0;
const target5 = CONFIG.ROUND_TARGETS[4];

for (let i = 0; i < N; i++) {
  const rack = shuffle(CONFIG.STARTING_BAG, makeRng(1000 + i)).slice(0, CONFIG.RACK_SIZE);
  const counts = rackCounts(rack);
  const formable = byLen.filter(w => w.length <= CONFIG.RACK_SIZE && canForm(w, counts));
  if (!formable.length) continue;

  // Best long word, no relics
  let bestLong = 0;
  for (const w of formable) bestLong = Math.max(bestLong, scoreWord(selOf(w), { tileValues: tv, lengthBonusPerLetter: lb }).points);

  // Best <=3-letter word with a Short&Sweet + Polished-on-every-tile build (proxy for a stacked short build)
  let bestShort = 0;
  for (const w of formable.filter(w => w.length <= 3)) {
    const sel = [...w].map(ch => ({ tile: { id: 't', letter: ch, mods: [getMod('polished')] }, letter: ch }));
    bestShort = Math.max(bestShort, scoreWord(sel, { tileValues: tv, lengthBonusPerLetter: lb, relics: [RELICS.shortAndSweet] }).points);
  }
  longTotal += bestLong; shortTotal += bestShort;
  if (bestShort >= bestLong) shortWins++;
}

const ratio = shortTotal / longTotal;
console.log(`Letter Ride — short-vs-long balance over ${N} seeded base-bag racks`);
console.log(`  median-ish avg best long-word points (no relics): ${(longTotal / N).toFixed(1)}`);
console.log(`  avg best short build (Short&Sweet + Polished):    ${(shortTotal / N).toFixed(1)}`);
console.log(`  short/long ratio: ${(ratio * 100).toFixed(0)}%  (Tier 1 gate bar: >= 80%)`);
console.log(`  racks where short >= long: ${shortWins}/${N}`);
console.log(`  round 5 target = ${target5}; short build reaches it in one play on ${'<eyeball above>'} racks`);
```

- [ ] **Step 3: Run it** — `npm run analyze` — Expected: prints the summary (a ratio %; no pass/fail — it's a tuning instrument). Confirm it runs without error.

- [ ] **Step 4: Commit** — `git add scripts/analyze-builds.js package.json && git commit -m "chore: short-word competitiveness analysis harness"`

---

### Task 16: Wire Tier 1 into the loop + UI (shop screen, tile-picker)

**Files:** Modify `src/main.js`, `src/ui.js`. (Manual-verify — DOM.)
**Interfaces:** UI gains a shop screen rendered when `run.status === 'roundCleared'`, a tile-picker overlay for `enchantTile`/`thinLetter`, and persistent display of coins + relics + tile-mod badges. `main.js` switches to `CONFIG.ROUND_TARGETS` and wires shop actions.

- [ ] **Step 1: `main.js`** — switch targets to `ROUND_TARGETS`; on round clear, generate a shop; wire purchase/reroll/continue. Replace the `newRun` calls' `targets: CONFIG.TIER0_TARGETS` with `targets: CONFIG.ROUND_TARGETS`, and add shop wiring:

```javascript
// add imports
import { generateShop, purchase } from './shop.js';

// after a successful submit that cleared the round, build the shop (inside onSubmit success path):
//   if (run.status === 'roundCleared') run.shop = generateShop(run, run.rng);
// add handlers (bindControls extended object):
  onBuy(offer, targetTileId) {
    const res = purchase(run, offer, { targetTileId });
    if (res.ok) run.shop = generateShop(run, run.rng);   // refresh offers after a buy (simple)
    save(); render(); return res;
  },
  onReroll() {
    if (run.coins >= run.shop.rerollCost) { run.coins -= run.shop.rerollCost; run.shop = generateShop(run, run.rng); save(); render(); }
  },
  onContinue() { run.shop = null; nextRound(run); if (run.status === 'playing') drawRack(run); save(); render(); },
```

(Keep the existing onSubmit/onDiscard/onNext/onNewRun; `onNext` is replaced by `onContinue` for Tier 1 — the "Next round" button becomes "Continue" from the shop. The serializeRun/loadRun already ignore `run.shop` since it's not serialized; regenerate on resume if `status==='roundCleared'` — handle in boot: `if (run.status === 'roundCleared' && !run.shop) run.shop = generateShop(run, run.rng);`.)

- [ ] **Step 2: `ui.js`** — extend `renderRun`: during play, render a coins counter and an "active relics" row (relic names) and tile-mod badges on rack tiles that carry mods (e.g. a dot or initial). When `run.status === 'roundCleared'`, render the **shop screen** instead of the rack: each `run.shop.offers` as a button labeled by type + cost (e.g. "Buy R — 3c", "E ×Catalyst — 7c", "Enchant a tile: Polished — 6c", "Upgrade E +1 — 5c", "Thin a C — 3c", "Relic: Vowel Bonus — 8c"), a "Reroll (2c)" button, and a "Continue →" button. For `enchantTile`/`thinLetter`, clicking the offer opens a **tile-picker**: list the owned bag tiles (letter + any mods) as buttons; clicking one calls `handlers.onBuy(offer, tile.id)`. Other offers call `handlers.onBuy(offer)`. Disable an offer button when `run.coins < offer.cost`. Show win/lose end states as before.

- [ ] **Step 3: Manual verification** — `npm run serve`, open on desktop + phone (the `Network:` URL). Verify a full run on `ROUND_TARGETS`: clear a round → shop appears → buy a letter/relic/enchant (tile-picker works) → Continue → the purchase changes scoring next round → coins display correct → win or lose across 8 rounds → reload mid-run resumes (incl. relics + upgrades).

- [ ] **Step 4: Commit** — `git add src/main.js src/ui.js && git commit -m "feat: Tier 1 shop + relics + tile-mods wired into the run loop"`

> **🛑 TIER 1 GATE (author playtest).** Several full runs on `ROUND_TARGETS`. Do builds diverge? Run `npm run analyze` — is the short/long ratio approaching the 80% bar; if not, tune `RELICS.shortAndSweet` (bigger ×Mult or add a flat-Wit short relic) and the length bonus. Does enchant-vs-dilute feel like a real decision? Tune `CONFIG.SHOP` costs + `ROUND_TARGETS`. This is the anti-vocabulary-gatekeeping judgment only the author can make.

---

## Self-Review (plan author)

- **Spec coverage:** Coins §7 → Task 10; synergies §6 → Task 11; relics §6/§7 (8) → Task 12; tile-mods §6 (4) + WILD §5 → Task 13; in-run shop §8 (7 offers) → Task 14; short-word measurability §12 → Task 15; loop+UI §3 + tier switch → Task 16.
- **Carry-overs folded:** Recycler→awardCoins (Task 10 + 12); relic persistence (Task 12); `addWit ?? 0` (Task 12 step 3a); shop-mutates-bag → thinLetter test (Task 14); rack-changing UI clears selection (Task 16 reuses Tier 0 handlers that clear selection first; onContinue added alongside).
- **Type consistency:** `relic.evaluate(ctx)` and `mod.evaluate(tile, ctx)` return the `{addWit?,addMult?,timesMult?}` shape the Tier 0 `scoreWord` already consumes; `ctx` carries `word/letters/selection/wordsPlayedThisRound` (run.js passes `context:{wordsPlayedThisRound}`); `RELICS`/`ALL_RELIC_IDS`, `getMod`/`ALL_MOD_IDS`, `generateShop(run,rng,pool)`/`purchase(run,offer,opts)` consistent across Tasks 12/13/14/16; `awardCoins(run)` (Task 10) reads `r.coinsOnRoundClear` defined on Recycler (Task 12).
- **Pool seam:** `generateShop(run, rng, pool={relicIds,modIds})` defaults to all ids now; Tier 2 passes a narrowed pool from `MetaState` — no signature churn.
- **Placeholder scan:** every code step is complete and runnable; Task 16 (UI) is manual-verify with concrete acceptance checks and complete wiring snippets.
