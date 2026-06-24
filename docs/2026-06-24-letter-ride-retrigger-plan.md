# Retrigger (Phase 3, SP1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the per-tile **retrigger** effect (a selected tile's scoring contribution counted more than once) to the engine, plus the minimal content that exercises it (1 tile-mod + 2 relics).

**Architecture:** One bounded, phase-order-preserving change to the locked `scoreWord` in [src/scoring.js](src/scoring.js): each selected tile prints `times = 1 + retrigger`, where `retrigger` is summed from a new tile-mod delta field `{ retrigger: N }` and a new optional relic hook `retriggerTile(tile, ctx) -> N`. Base value is counted `times`; each of the tile's mod deltas is **applied** `times` (looped, so `timesMult` compounds). Word-level relics and the length bonus fire once. Content (a Reprint mod + Press Lead / Rare Reprint relics) registers in the existing registries and flows into the shop automatically.

**Tech Stack:** Vanilla JS ESM, no build step. `node --test` via `npm test`. Design: [docs/2026-06-24-letter-ride-retrigger-design.md](2026-06-24-letter-ride-retrigger-design.md).

## Global Constraints

- **Scoring pillar is LOCKED and must stay exact:** `Score = Points × Mult`, `mult = (1 + ΣaddMult) × ΠtimesMult`, phase-ordered (all `+Mult` sum first, then all `×Mult` multiply), acquisition-order-independent. Retrigger changes only *how many times a tile's contribution is counted*, never the order of operations.
- **Behavior must be identical when no retrigger is present** (retrigger = 0 everywhere): existing scoring tests must pass unchanged, including `breakdown` part contents and order.
- **Retrigger affects a tile's OWN contribution only:** its base letter value + the deltas from its own mods. It must NOT re-fire word-level relics (`relic.evaluate`) or the word-level length bonus; those fire once per word.
- **No `Math.random()` in logic;** all randomness via the seeded RNG. `retriggerTile` hooks are pure functions of `(tile, ctx)`.
- **Stateless: no save-schema bump.** Retrigger is computed fresh inside `scoreWord`; it adds no per-run state. Schema stays at version 5.
- **Copy is author-owned.** Names (Reprint / Press Lead / Rare Reprint) and magnitudes (retrigger counts) are tunable starting points; do not treat them as final. No em dashes in any player-facing `desc`.
- **Wild tile** is `tile.letter === '*'` (base value 0), matching existing `scoring.js`.
- Tests inject tiny fixtures (a few-tile selection, a 2-3 letter `tileValues` map) — never the full word list.

---

### Task 1: Engine — per-tile retrigger in `scoreWord`

**Files:**
- Modify: `src/scoring.js` (the whole `scoreWord` body is restructured; the public signature and return shape are unchanged)
- Test: `test/scoring.test.js` (extend)

**Interfaces:**
- Consumes: `selection` (array of `{ tile, letter }`), `tileValues`, `lengthBonusPerLetter`, `relics`, `context` — unchanged signature.
- Produces (NEW, consumed by Tasks 2-3): a tile-mod delta may include `retrigger: N` (read by `scoreWord`, ignored by `apply()`); a relic may expose `retriggerTile(tile, ctx) -> N`. Return shape `{ points, mult, score, breakdown }` is unchanged; `breakdown.base` now reflects retriggered base values.

- [ ] **Step 1: Write the failing tests**

Add to `test/scoring.test.js`:

```js
import { scoreWord } from '../src/scoring.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const V = { A: 1, B: 2, Q: 10 };          // tiny fixture tileValues
const sel = (...specs) => specs.map(([letter, mods = []]) => ({ tile: { letter, mods }, letter }));
const opts = (relics = []) => ({ tileValues: V, lengthBonusPerLetter: 1, relics, context: {} });

test('retrigger: a tile-mod {retrigger:1} counts the tile base value twice', () => {
  const r = scoreWord(sel(['A', [{ evaluate: () => ({ retrigger: 1 }) }]], ['B']), opts());
  // base = A*2 + B*1 = 2 + 2 = 4 ; no lengthBonus (len 2 <= 3) ; mult 1
  assert.equal(r.breakdown.base, 4);
  assert.equal(r.points, 4);
  assert.equal(r.score, 4);
});

test('retrigger: a tile prints ALL its mods `times`; a timesMult mod is squared (looped, not scaled)', () => {
  const tileMods = [{ evaluate: () => ({ retrigger: 1 }) }, { evaluate: () => ({ timesMult: 2 }) }];
  const r = scoreWord(sel(['A', tileMods]), opts());
  // base = A*2 = 2 ; timesMult applied twice => 2*2 = 4 ; mult = (1+0)*4 = 4 ; score = 2*4 = 8
  assert.equal(r.breakdown.base, 2);
  assert.equal(r.mult, 4);
  assert.equal(r.score, 8);
});

test('retrigger: relic.retriggerTile fires per matching tile; word-level relic.evaluate fires ONCE', () => {
  const firstTileRelic = {
    name: 'FT',
    retriggerTile: (tile, ctx) => (ctx.selection[0].tile === tile ? 1 : 0),
    evaluate: () => ({ addPoints: 100 }),   // word-level: must count once despite the retrigger
  };
  const r = scoreWord(sel(['A'], ['B']), opts([firstTileRelic]));
  // base = A*2 (first tile retriggered) + B*1 = 2 + 2 = 4 ; relic +100 ONCE ; points = 104
  assert.equal(r.breakdown.base, 4);
  assert.equal(r.points, 104);
});

test('retrigger: length bonus is word-level (counted once, not multiplied)', () => {
  const r = scoreWord(sel(['A', [{ evaluate: () => ({ retrigger: 1 }) }]], ['B'], ['A'], ['B']), opts());
  // len 4 word => lengthBonus = (4-3)*1 = 1 (once) ; base = A*2 + B + A + B = 2+2+1+2 = 7 ; points = 8
  assert.equal(r.breakdown.lengthBonus, 1);
  assert.equal(r.breakdown.base, 7);
  assert.equal(r.points, 8);
});

test('retrigger: phase order holds with mixed addMult + timesMult retriggered', () => {
  const mods = [{ evaluate: () => ({ retrigger: 1 }) }, { evaluate: () => ({ addMult: 1 }) }, { evaluate: () => ({ timesMult: 2 }) }];
  const r = scoreWord(sel(['A', mods]), opts());
  // addMult applied twice => +2 => (1+2)=3 ; timesMult applied twice => 4 ; mult = 3*4 = 12
  assert.equal(r.mult, 12);
});

test('retrigger: a Wild (base 0) retriggers to 0, no NaN', () => {
  const r = scoreWord(sel(['*', [{ evaluate: () => ({ retrigger: 2 }) }]]), opts());
  assert.equal(r.breakdown.base, 0);
  assert.equal(Number.isFinite(r.score), true);
});

test('no retrigger: behavior unchanged (relic +Points, mod +Mult, base, length)', () => {
  const relic = { name: 'R', evaluate: () => ({ addPoints: 5 }) };
  const mod = { name: 'M', evaluate: () => ({ addMult: 1 }) };
  const r = scoreWord(sel(['A', [mod]], ['B'], ['Q'], ['A']), opts([relic]));
  // base = 1+2+10+1 = 14 ; lengthBonus = (4-3)*1 = 1 ; +5 relic => points = 20 ; addMult 1 => mult 2 ; score 40
  assert.equal(r.breakdown.base, 14);
  assert.equal(r.points, 20);
  assert.equal(r.mult, 2);
  assert.equal(r.score, 40);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: the new retrigger tests FAIL (retrigger field/hook not yet honored — base not doubled, timesMult not squared). The pre-existing scoring tests still pass.

- [ ] **Step 3: Restructure `scoreWord` to honor retrigger**

Replace the body of `scoreWord` in `src/scoring.js` with (signature + return shape unchanged):

```js
export function scoreWord(selection, { tileValues, lengthBonusPerLetter, relics = [], context = {} }) {
  const letters = selection.map(s => s.letter.toUpperCase());
  const word = letters.join('');
  const ctx = { word, letters, selection, ...context };

  let points = 0, addMult = 0, timesMult = 1;
  const pointParts = [], addMultParts = [], timesMultParts = [];

  const apply = (d, label) => {
    if (!d) return;
    if (d.addPoints) { points += d.addPoints; pointParts.push({ label, amount: d.addPoints }); }
    if (d.addMult) { addMult += d.addMult; addMultParts.push({ label, amount: d.addMult }); }
    if (d.timesMult && d.timesMult !== 1) { timesMult *= d.timesMult; timesMultParts.push({ label, amount: d.timesMult }); }
  };

  // Word-level relics fire ONCE (kept first, preserving breakdown order).
  for (const relic of relics) apply(relic.evaluate?.(ctx), relic.name || relic.id);

  // Per-tile: base value + the tile's OWN mods, each counted `times = 1 + retrigger`.
  // Retrigger replays a tile's own contribution only; it never re-fires word-level relics or
  // the length bonus. Looping `apply()` (not scaling) makes a retriggered ×Mult mod compound.
  let base = 0;
  for (const { tile, letter } of selection) {
    const baseVal = tile.letter === '*' ? 0 : (tileValues[letter.toUpperCase()] || 0);
    let retrigger = 0;
    for (const mod of (tile.mods || [])) retrigger += (mod.evaluate?.(tile, ctx)?.retrigger || 0);
    for (const relic of relics) retrigger += (relic.retriggerTile?.(tile, ctx) || 0);
    const times = 1 + retrigger;
    base += baseVal * times;
    for (const mod of (tile.mods || []))
      for (let i = 0; i < times; i++) apply(mod.evaluate?.(tile, ctx), mod.name || mod.id);
  }

  const lengthBonus = Math.max(0, letters.length - 3) * lengthBonusPerLetter;  // word-level, once
  points += base + lengthBonus;

  const mult = (1 + addMult) * timesMult;                            // +Mult then ×Mult
  const breakdown = { base, lengthBonus, pointParts, addMultParts, timesMultParts };
  return { points, mult, score: points * mult, breakdown };
}
```

Note: when `retrigger` is 0 for every tile, this is behaviorally identical to the previous implementation (relics applied first, then each mod once; `base` = sum of tile values; same `breakdown`). The restructure only adds the `times` multiplier and moves base accumulation into the tile loop.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass, including the new retrigger tests AND every pre-existing test (scoring, relics, run, bosses, events, storage).

- [ ] **Step 5: Commit**

```bash
git add src/scoring.js test/scoring.test.js
git commit -m "feat: per-tile retrigger in scoreWord (phase-order-safe; mod {retrigger} + relic retriggerTile hook)"
```

---

### Task 2: Reprint tile-mod

**Files:**
- Modify: `src/tiles.js` (add `reprint` to `MOD_REGISTRY`)
- Test: `test/tiles.test.js` (extend)

**Interfaces:**
- Consumes: the `{ retrigger: N }` delta field honored by `scoreWord` (Task 1).
- Produces: `MOD_REGISTRY.reprint`, auto-included in `ALL_MOD_IDS` (which the shop reads).

- [ ] **Step 1: Write the failing test**

Add to `test/tiles.test.js`:

```js
test('reprint mod returns {retrigger:1} and is registered', () => {
  const mod = getMod('reprint');
  assert.ok(mod, 'reprint registered');
  assert.deepEqual(mod.evaluate(), { retrigger: 1 });
  assert.ok(ALL_MOD_IDS.includes('reprint'));
});

test('a tile with the reprint mod prints its base value twice', () => {
  const r = scoreWord(
    [{ tile: makeTile('A', [getMod('reprint')]), letter: 'A' }],
    { tileValues: { A: 5 }, lengthBonusPerLetter: 1, relics: [], context: {} }
  );
  assert.equal(r.breakdown.base, 10);   // A=5 printed twice
});
```

Ensure the test file imports what it needs: `getMod, ALL_MOD_IDS, makeTile` from `../src/tiles.js` and `scoreWord` from `../src/scoring.js` (add to existing imports if missing).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `getMod('reprint')` is `undefined`.

- [ ] **Step 3: Add the reprint mod**

In `src/tiles.js`, add to `MOD_REGISTRY` (after `anchor`):

```js
  reprint: {
    id: 'reprint', name: 'Reprint', desc: 'The sort it sits on prints one extra time',
    evaluate: () => ({ retrigger: 1 }),
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (new mod tests + all existing).

- [ ] **Step 5: Commit**

```bash
git add src/tiles.js test/tiles.test.js
git commit -m "feat: Reprint tile-mod (+1 retrigger on its tile)"
```

---

### Task 3: Press Lead + Rare Reprint relics

**Files:**
- Modify: `src/relics.js` (add two relics with a `retriggerTile` hook)
- Test: `test/relics.test.js` (extend)

**Interfaces:**
- Consumes: the `retriggerTile(tile, ctx)` hook honored by `scoreWord` (Task 1).
- Produces: `RELICS.pressLead`, `RELICS.rareReprint`, auto-included in `ALL_RELIC_IDS` (which the shop reads, owned-filtered).

- [ ] **Step 1: Write the failing test**

Add to `test/relics.test.js`:

```js
test('pressLead retriggers only the first tile', () => {
  const rel = RELICS.pressLead;
  const selection = [{ tile: { letter: 'A' }, letter: 'A' }, { tile: { letter: 'B' }, letter: 'B' }];
  const ctx = { selection };
  assert.equal(rel.retriggerTile(selection[0].tile, ctx), 1);
  assert.equal(rel.retriggerTile(selection[1].tile, ctx), 0);
  assert.ok(ALL_RELIC_IDS.includes('pressLead'));
});

test('rareReprint retriggers only rare-letter tiles (J/Q/X/Z)', () => {
  const rel = RELICS.rareReprint;
  const ctx = { selection: [] };
  assert.equal(rel.retriggerTile({ letter: 'Q' }, ctx), 1);
  assert.equal(rel.retriggerTile({ letter: 'q' }, ctx), 1);   // case-insensitive
  assert.equal(rel.retriggerTile({ letter: 'A' }, ctx), 0);
  assert.ok(ALL_RELIC_IDS.includes('rareReprint'));
});

test('rareReprint doubles a rare tile base value through scoreWord', () => {
  const r = scoreWord(
    [{ tile: { letter: 'Q', mods: [] }, letter: 'Q' }, { tile: { letter: 'A', mods: [] }, letter: 'A' }],
    { tileValues: { Q: 10, A: 1 }, lengthBonusPerLetter: 1, relics: [RELICS.rareReprint], context: {} }
  );
  assert.equal(r.breakdown.base, 21);   // Q=10 printed twice (20) + A=1 once
});
```

Ensure imports at the top of `test/relics.test.js` include `scoreWord` from `../src/scoring.js` and `ALL_RELIC_IDS` from `../src/relics.js` (add if missing).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `RELICS.pressLead` / `RELICS.rareReprint` undefined.

- [ ] **Step 3: Add the two relics**

In `src/relics.js`, add a small `RARE`-aware section. `RARE` is already defined at the top of the file (`new Set(['J','Q','X','Z'])`). Add inside the `RELICS` object (after the snowball block):

```js
  // ── Phase 3 SP1: Retrigger relics ──────────────────────────────────────────
  pressLead: {
    id: 'pressLead', name: 'Press Lead', desc: 'The first letter of the word prints one extra time',
    evaluate: () => ({}),
    retriggerTile: (tile, ctx) => (ctx.selection[0]?.tile === tile ? 1 : 0),
  },
  rareReprint: {
    id: 'rareReprint', name: 'Rare Reprint', desc: 'Each J, Q, X, or Z prints one extra time',
    evaluate: () => ({}),
    retriggerTile: (tile) => (RARE.has(String(tile.letter).toUpperCase()) ? 1 : 0),
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (new relic tests + all existing).

- [ ] **Step 5: Commit**

```bash
git add src/relics.js test/relics.test.js
git commit -m "feat: Press Lead + Rare Reprint retrigger relics"
```

---

### Task 4: Shop-pool + legibility verification, harness regression, smoke

**Files:**
- Test: `test/shop.test.js` (extend — one assertion that the new content is offerable)
- No `src/` change expected (descs surface via the existing tap-to-reveal; shop pulls from the registries). If the score breakdown for a retriggered tile is visibly confusing in the browser smoke, add a minimal retrigger marker to the scorebug in `src/ui.js` — but only if needed.

**Interfaces:**
- Consumes: `generateShop` ([src/shop.js](src/shop.js)), `ALL_RELIC_IDS`, `ALL_MOD_IDS`.

- [ ] **Step 1: Write a shop-pool test**

Add to `test/shop.test.js` (a focused assertion that the new content can appear as offers — generate a shop over the full pool with a fixed seed and assert the candidate set includes the new relics/mod; if the existing tests sample a small pool, assert against `ALL_RELIC_IDS`/`ALL_MOD_IDS` membership instead, mirroring the existing test style in the file):

```js
test('new retrigger content is in the shop candidate pools', () => {
  assert.ok(ALL_RELIC_IDS.includes('pressLead') && ALL_RELIC_IDS.includes('rareReprint'));
  assert.ok(ALL_MOD_IDS.includes('reprint'));
});
```

(Match the file's existing import style; import `ALL_RELIC_IDS` from `../src/relics.js` and `ALL_MOD_IDS` from `../src/tiles.js` if not already imported.)

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS, all tests.

- [ ] **Step 3: Harness regression gate (no code)**

Run: `npm run analyze:sim-v2`
Expected: it runs clean (no crash) across all 6 personas. The greedy bot ignores retrigger content, so win-rates should sit in the same band as before (this confirms **no regression**, not balance). Record the output in the SDD ledger.

- [ ] **Step 4: Browser smoke (no code)**

Run: `npm run serve`, open on desktop. Buy/enchant a Reprint sort onto a high-value tile (or start with Press Lead via shop), play a word, and confirm: (a) the score is visibly higher for the retriggered tile, (b) the Reprint/relic desc shows on tap-to-reveal, (c) no console errors. If the breakdown reads confusingly, add the minimal scorebug marker noted above, then re-run `npm test`.

- [ ] **Step 5: Commit (if any UI change was needed; otherwise the test commit only)**

```bash
git add test/shop.test.js
git commit -m "test: assert retrigger content is shop-offerable; harness + smoke verified"
```

---

## Self-Review

- **Spec coverage:** R1 per-tile primitive (Task 1) · R2 bounded `scoreWord` change, phase-order preserved (Task 1, behavior-identical at retrigger 0) · R3 mod `{retrigger}` + relic `retriggerTile` (Tasks 1-3) · R4 tile-own-contribution only, relics/length once (Task 1 tests) · R5 1 mod + 2 relics (Tasks 2-3) · R6 no schema bump (no storage change anywhere) · R7 bosses untouched (no boss code; disable=0×times=0 covered by the Wild/0-base test). Legibility + harness gate (Task 4).
- **Placeholder scan:** none — every step has concrete code or an exact command.
- **Type consistency:** `retrigger` is a number field on a mod delta; `retriggerTile(tile, ctx) -> number`; `breakdown` shape unchanged. Names `reprint` / `pressLead` / `rareReprint` are used consistently across tasks.
- **No new persistent state:** confirmed — `storage.js` is not touched; retrigger is computed per scoreWord call.
