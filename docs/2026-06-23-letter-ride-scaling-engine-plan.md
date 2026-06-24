# Scaling Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the compounding scaling engine the harness proved is missing (snowball relics that permanently ratchet their own ×Mult within a run, plus Hone emitting ×Mult at high levels), so a committed build can ride a steep curve.

**Architecture:** Relics stay shared static refs (`RELICS[id]`). Per-relic snowball state lives on a new `run.relicState` map keyed by relic id (JSON-safe). `playWord` ratchets a snowball's stacks before scoring (a side effect, kept out of pure `scoring.js`); the snowball's `evaluate(ctx)` reads its stacks from `ctx.relicState`. Hone gains a ×Mult kicker at high levels via `archetypes.js`. `scoring.js` is NOT modified (the formula is locked).

**Tech Stack:** Vanilla JS ESM, `node --test`, no build step. Determinism via the seeded RNG in `rng.js`.

## Global Constraints

- **Formula is LOCKED — do not modify `src/scoring.js`.** `Score = Points × Mult`, `mult = (1 + ΣaddMult) × ΠtimesMult`, phase-ordered, acquisition-order-independent. Snowball ×Mult flows through the existing `timesMult` channel (a `timesMult` of exactly `1` is a no-op, already handled by `scoring.js`).
- **Snowball state model:** per-relic state on `run.relicState[relicId] = { stacks }`. Plain JSON object. No state on the shared `RELICS[id]` objects.
- **Snowball semantics:** the accumulated ×Mult applies to EVERY word (Balatro scaling-joker behavior); it only GROWS on a qualifying play. Ratchet happens in `playWord` BEFORE scoring, so a qualifying word benefits from the stack it just earned.
- **Determinism:** no `Math.random()` in logic. Snowball ratcheting is deterministic (driven by plays, not RNG).
- **DI + logic/UI split:** rules in pure modules, unit-tested headless with `node --test`. No DOM.
- **Magnitudes (`perStack`, the Hone kicker) are TUNABLE STARTING POINTS** — the author fine-tunes later. Keep them in obvious, single-source spots.
- **Reuse the archetype predicates** (`hasRare`, `isDoubled` exported from `archetypes.js`) — one home, no re-implementing the same condition.
- Tests inject tiny fixtures (a 3-word dictionary, a few tiles), never the full word list.

## File Structure

- `src/relics.js` — add a `snowball(...)` factory + 6 snowball relics. (Modify.)
- `src/run.js` — `newRun` inits `relicState: {}`; `playWord` ratchets snowballs + passes `relicState` into the scoring context. (Modify.)
- `src/archetypes.js` — `honeBonus` functions gain a ×Mult kicker at high levels. (Modify.)
- `src/storage.js` — serialize/deserialize `relicState`; bump schema `version` 2 → 3. (Modify.)
- `src/sim.js` — add the new snowball relic ids to each persona's `targetRelicIds`. (Modify.)
- `test/relics.test.js`, `test/run.test.js`, `test/storage.test.js`, `test/archetypes.test.js` — add tests (create any that do not exist).

---

### Task 1: Snowball infrastructure + first relic (Avalanche)

**Files:**
- Modify: `src/relics.js` (add `snowball` factory + `rareAvalanche`)
- Modify: `src/run.js` (`newRun` relicState init; `playWord` ratchet + context)
- Test: `test/relics.test.js`, `test/run.test.js`

**Interfaces:**
- Produces: `RELICS.rareAvalanche` (a relic with `{ id, name, desc, snowball: { condition(ctx) }, evaluate(ctx) }`).
- Produces: `run.relicState` (a `{ [relicId]: { stacks: number } }` map) on every run from `newRun`.
- Consumes: `hasRare(ctx)` from `archetypes.js` (already imported into `relics.js` as `hasRareCtx`).
- Snowball contract: `evaluate(ctx)` returns `{ timesMult: 1 + perStack * (ctx.relicState?.[id]?.stacks || 0) }`. `playWord` increments `run.relicState[id].stacks` once per qualifying play (condition true), BEFORE calling `scoreWord`.

- [ ] **Step 1: Write the failing test** (snowball scores from stacks + ratchets)

In `test/relics.test.js` (create if absent; mirror the existing test style — `import { test } from 'node:test'; import assert from 'node:assert';`):

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { RELICS } from '../src/relics.js';
import { scoreWord } from '../src/scoring.js';

const tv = { R: 1, A: 1, E: 1, J: 8 };
// helper: build a selection from a word string
const sel = (w) => [...w].map((l, i) => ({ tile: { id: 't' + i, letter: l, mods: [] }, letter: l }));

test('rareAvalanche: ×Mult grows with its stacks, applies to every word', () => {
  const av = RELICS.rareAvalanche;
  // 0 stacks → timesMult 1 (no-op)
  assert.deepEqual(av.evaluate({ relicState: {} }), { timesMult: 1 });
  // 3 stacks → timesMult 1 + 0.2*3 = 1.6, regardless of the current word
  assert.deepEqual(av.evaluate({ relicState: { rareAvalanche: { stacks: 3 } } }), { timesMult: 1 + 0.2 * 3 });
});

test('rareAvalanche: condition is "word uses a rare letter"', () => {
  const av = RELICS.rareAvalanche;
  assert.equal(av.snowball.condition({ letters: ['J', 'A', 'R'] }), true);
  assert.equal(av.snowball.condition({ letters: ['R', 'A', 'T'] }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/relics.test.js`
Expected: FAIL (`RELICS.rareAvalanche` is undefined).

- [ ] **Step 3: Implement the snowball factory + Avalanche** in `src/relics.js`

After the existing imports/`isVowel` helpers (top of file, after line 7), add the factory:

```js
// ── Scaling / snowball relics ─────────────────────────────────────────────
// A snowball ratchets its OWN ×Mult as you play qualifying words. Per-relic state lives on
// run.relicState[id] = { stacks }. playWord increments stacks on each qualifying play (before
// scoring); evaluate reads the current stacks. timesMult = 1 + perStack*stacks, so the accumulated
// multiplier applies to EVERY word and only GROWS on a qualifying play (Balatro scaling-joker model).
// perStack values are tunable starting points.
function snowball({ id, name, desc, perStack, condition }) {
  return {
    id, name, desc,
    snowball: { condition },
    evaluate: (ctx) => ({ timesMult: 1 + perStack * (ctx.relicState?.[id]?.stacks || 0) }),
  };
}
```

Then add `rareAvalanche` inside the `RELICS` object (e.g. after `overtime`):

```js
  rareAvalanche: snowball({
    id: 'rareAvalanche', name: 'Avalanche',
    desc: 'Grows +0.2 Mult every time you play a rare letter (this run)',
    perStack: 0.2, condition: (ctx) => hasRareCtx(ctx),
  }),
```

(`hasRareCtx` is the existing import of `hasRare` from `archetypes.js`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/relics.test.js`
Expected: PASS.

- [ ] **Step 5: Write the failing run-integration test** (ratchet happens on play)

In `test/run.test.js` (create if absent), add a test that a snowball ratchets through `playWord`. Use the existing test helpers if present; otherwise build a minimal run via `newRun` with a tiny dictionary and a bag that can spell a rare word.

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { newRun, playWord } from '../src/run.js';
import { RELICS } from '../src/relics.js';

const config = {
  STARTING_BAG: ['J', 'A', 'R', 'A', 'R', 'E', 'E', 'T', 'O'],
  TILE_VALUES: { J: 8, A: 1, R: 1, E: 1, T: 1, O: 1 },
  RACK_SIZE: 9, PLAYS_PER_ROUND: 4, DISCARDS_PER_ROUND: 2, MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 5, ROUND_TARGETS: [999], COINS_ON_CLEAR: null,
};
const dictionary = { findWord: () => null, has: (w) => w === 'JAR' || w === 'RAT' };

test('newRun initializes relicState; snowball ratchets on a qualifying play', () => {
  const run = newRun({ config, dictionary, seed: 1 });
  assert.deepEqual(run.relicState, {});
  run.relics.push(RELICS.rareAvalanche);
  // force a known rack so we can play JAR
  run.rack = ['J', 'A', 'R'].map((l, i) => ({ id: 'x' + i, letter: l, mods: [] }));
  const selection = run.rack.map(t => ({ tile: t, letter: t.letter }));
  playWord(run, selection);
  assert.equal(run.relicState.rareAvalanche.stacks, 1); // ratcheted once (JAR has a rare letter)
});
```

(Adjust `dictionary` to match how `validate`/`word.js` checks membership — read `src/word.js` to confirm whether it calls `dictionary.has(word)`; mirror the existing run tests' fixture exactly.)

- [ ] **Step 6: Run test to verify it fails**

Run: `node --test test/run.test.js`
Expected: FAIL (`run.relicState` undefined, or stacks not incremented).

- [ ] **Step 7: Implement in `src/run.js`**

In `newRun`, add to the run object (after `honeLevels: {},` on line 81):

```js
    relicState: {},
```

In `playWord`, replace the body between the `validate` guard and the `scoreWord` call (current lines 94–101) with:

```js
  const enablers = run.relics.filter(r => r.enabler).map(r => r.enabler);
  // Snowball relics ratchet BEFORE scoring so a qualifying word benefits from the stack it just earned.
  run.relicState = run.relicState || {};
  const ratchetLetters = selection.map(s => s.letter.toUpperCase());
  const ratchetCtx = { word: ratchetLetters.join(''), letters: ratchetLetters, selection, wordsPlayedThisRound: run.wordsPlayedThisRound, enablers };
  for (const r of run.relics) {
    if (r.snowball && r.snowball.condition(ratchetCtx)) {
      const st = run.relicState[r.id] || (run.relicState[r.id] = { stacks: 0 });
      st.stacks += 1;
    }
  }
  const allMods = [...run.relics, ...honeModifiers(run.honeLevels)];
  const scored = scoreWord(selection, {
    tileValues: run.tileValues,
    lengthBonusPerLetter: run.config.LENGTH_BONUS_PER_LETTER,
    relics: allMods,
    context: { wordsPlayedThisRound: run.wordsPlayedThisRound, enablers, relicState: run.relicState },
  });
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `node --test test/run.test.js test/relics.test.js`
Expected: PASS.

- [ ] **Step 9: Run the full suite (no regressions)**

Run: `npm test`
Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add src/relics.js src/run.js test/relics.test.js test/run.test.js
git commit -m "feat: snowball relic infrastructure + Avalanche (per-run ratcheting ×Mult)"
```

---

### Task 2: The other five snowball relics

**Files:**
- Modify: `src/relics.js`
- Test: `test/relics.test.js`

**Interfaces:**
- Consumes: the `snowball(...)` factory + `hasRareCtx`, `isDoubledCtx`, `isVowel` from Task 1 / existing imports.
- Produces: `RELICS.flywheel`, `RELICS.juggernaut`, `RELICS.resonanceEngine`, `RELICS.risingTide`, `RELICS.perpetualEngine`.

- [ ] **Step 1: Write the failing tests** (one assertion per new relic's condition + a stacks read)

Append to `test/relics.test.js`:

```js
test('all six snowball relics: condition + ×Mult-from-stacks', () => {
  const cases = [
    ['flywheel',        { letters: ['C','A','T'] },             { letters: ['C','A','T','S'] }],          // short ≤3 vs not
    ['juggernaut',      { letters: ['A','B','C','D','E','F'] },  { letters: ['C','A','T'] }],              // long ≥6 vs not
    ['resonanceEngine', { word: 'BOOK', letters: ['B','O','O','K'] }, { word: 'CAT', letters: ['C','A','T'] }], // doubled vs not
    ['risingTide',      { letters: ['A','E','I','T'] },          { letters: ['C','A','T'] }],              // ≥3 vowels vs not
  ];
  for (const [id, yes, no] of cases) {
    assert.equal(RELICS[id].snowball.condition({ enablers: [], selection: [], ...yes }), true, `${id} yes`);
    assert.equal(RELICS[id].snowball.condition({ enablers: [], selection: [], ...no }), false, `${id} no`);
  }
  // perpetualEngine fires on every word
  assert.equal(RELICS.perpetualEngine.snowball.condition({ letters: ['C','A','T'] }), true);
  // stacks read (flywheel perStack 0.3)
  assert.deepEqual(RELICS.flywheel.evaluate({ relicState: { flywheel: { stacks: 2 } } }), { timesMult: 1 + 0.3 * 2 });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/relics.test.js`
Expected: FAIL (relics undefined).

- [ ] **Step 3: Implement the five relics** in `src/relics.js` (next to `rareAvalanche`)

```js
  flywheel: snowball({
    id: 'flywheel', name: 'Flywheel',
    desc: 'Grows +0.3 Mult every time you play a word of 3 letters or fewer (this run)',
    perStack: 0.3, condition: (ctx) => ctx.letters.length <= 3,
  }),
  juggernaut: snowball({
    id: 'juggernaut', name: 'Juggernaut',
    desc: 'Grows +0.15 Mult every time you play a word of 6+ letters (this run)',
    perStack: 0.15, condition: (ctx) => ctx.letters.length >= 6,
  }),
  resonanceEngine: snowball({
    id: 'resonanceEngine', name: 'Resonance',
    desc: 'Grows +0.2 Mult every time you play a word with a doubled letter (this run)',
    perStack: 0.2, condition: (ctx) => isDoubledCtx(ctx),
  }),
  risingTide: snowball({
    id: 'risingTide', name: 'Rising Tide',
    desc: 'Grows +0.12 Mult every time you play a word with 3+ vowels (this run)',
    perStack: 0.12, condition: (ctx) => ctx.letters.filter(isVowel).length >= 3,
  }),
  perpetualEngine: snowball({
    id: 'perpetualEngine', name: 'Perpetual Engine',
    desc: 'Grows +0.1 Mult every word you play (this run)',
    perStack: 0.1, condition: () => true,
  }),
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/relics.test.js`
Expected: PASS.

- [ ] **Step 5: Full suite + commit**

Run: `npm test` (expect green), then:

```bash
git add src/relics.js test/relics.test.js
git commit -m "feat: five more snowball relics (flywheel/juggernaut/resonance/rising-tide/perpetual)"
```

---

### Task 3: Persist `relicState` (schema v3)

**Files:**
- Modify: `src/storage.js`
- Test: `test/storage.test.js`

**Interfaces:**
- Consumes: `run.relicState` (Task 1).
- Produces: serialized `relicState` in the save; `deserializeRun` restores it; `version` is `3`.

- [ ] **Step 1: Write the failing test** (round-trip + old-save drop)

Append to `test/storage.test.js` (mirror its existing fixture for `config`/`dictionary`):

```js
test('relicState round-trips through serialize/deserialize', () => {
  const run = newRun({ config, dictionary, seed: 7 });
  run.relicState = { rareAvalanche: { stacks: 4 } };
  const data = serializeRun(run);
  assert.equal(data.version, 3);
  const restored = deserializeRun(data, { config, dictionary });
  assert.deepEqual(restored.relicState, { rareAvalanche: { stacks: 4 } });
});

test('a missing relicState deserializes to {}', () => {
  const run = newRun({ config, dictionary, seed: 7 });
  const data = serializeRun(run);
  delete data.relicState;
  const restored = deserializeRun(data, { config, dictionary });
  assert.deepEqual(restored.relicState, {});
});
```

(Confirm `serializeRun`, `deserializeRun`, `newRun` are imported in `test/storage.test.js`; add imports if missing.)

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/storage.test.js`
Expected: FAIL (`version` is 2; `restored.relicState` undefined).

- [ ] **Step 3: Implement in `src/storage.js`**

In `serializeRun`, change `version: 2,` to `version: 3,` and add after `honeLevels: run.honeLevels || {},`:

```js
    relicState: run.relicState || {},
```

In `deserializeRun`, add after `honeLevels: data.honeLevels || {},`:

```js
    relicState: data.relicState || {},
```

In `loadRun`, change the guard `if (data.version !== 2) return null;` to:

```js
    if (data.version !== 3) return null;     // schema changed → treat as no save (graceful drop)
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/storage.test.js`
Expected: PASS.

- [ ] **Step 5: Full suite + commit**

Run: `npm test` (green), then:

```bash
git add src/storage.js test/storage.test.js
git commit -m "feat: persist relicState (snowball stacks); bump save schema v2->v3"
```

---

### Task 4: Hone emits ×Mult at high levels (D2)

**Files:**
- Modify: `src/archetypes.js`
- Test: `test/archetypes.test.js`

**Interfaces:**
- Produces: each `ARCHETYPES[id].honeBonus(ctx, lvl)` includes a `timesMult` of `1 + 0.25*(lvl-2)` at `lvl >= 3` (and `1` below), when its condition matches. `honeModifiers` is unchanged (it already wraps `honeBonus`).

- [ ] **Step 1: Write the failing test**

Append to `test/archetypes.test.js` (create if absent):

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { ARCHETYPES } from '../src/archetypes.js';

test('Hone emits ×Mult at level 3+ (shortWord example)', () => {
  const ctx = { letters: ['C', 'A', 'T'], word: 'CAT' };       // matches shortWord (≤3)
  assert.equal(ARCHETYPES.shortWord.honeBonus(ctx, 2).timesMult ?? 1, 1);          // no kicker below L3
  assert.equal(ARCHETYPES.shortWord.honeBonus(ctx, 3).timesMult, 1 + 0.25 * 1);    // L3 kicker
  assert.equal(ARCHETYPES.shortWord.honeBonus(ctx, 4).timesMult, 1 + 0.25 * 2);    // L4 kicker
});

test('Hone ×Mult only applies when the archetype condition matches', () => {
  const ctx = { letters: ['C', 'A', 'T', 'S'], word: 'CATS' };  // does NOT match shortWord (>3)
  assert.deepEqual(ARCHETYPES.shortWord.honeBonus(ctx, 4), {});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/archetypes.test.js`
Expected: FAIL (no `timesMult` in the returned object).

- [ ] **Step 3: Implement in `src/archetypes.js`**

Add a helper near the top (after the `longThreshold` helper, ~line 23):

```js
// Hone ×Mult kicker: high Hone levels add a multiplicative bonus (the scaling-investment wincon).
// Starting value is tunable. Applies only when the archetype's condition matches (caller gates it).
const honeXMult = (lvl) => (lvl >= 3 ? 1 + 0.25 * (lvl - 2) : 1);
```

Then add `timesMult: honeXMult(lvl)` to each archetype's matched-branch return. The six edits:

```js
  // shortWord
  honeBonus: (ctx, lvl) => ctx.letters.length <= 3 ? { addMult: lvl, timesMult: honeXMult(lvl) } : {},
  // longWord
  honeBonus: (ctx, lvl) => ctx.letters.length >= longThreshold(ctx) ? { addPoints: 5 * lvl, timesMult: honeXMult(lvl) } : {},
  // rareLetter
  honeBonus: (ctx, lvl) => hasRare(ctx) ? { addPoints: 15 * lvl, timesMult: honeXMult(lvl) } : {},
  // doubled
  honeBonus: (ctx, lvl) => isDoubled(ctx) ? { addPoints: 12 * lvl, timesMult: honeXMult(lvl) } : {},
  // vowelHeavy
  honeBonus: (ctx, lvl) => { const v = ctx.letters.filter(isVowel).length; return v >= 3 ? { addPoints: 2 * lvl * v, timesMult: honeXMult(lvl) } : {}; },
  // escalation
  honeBonus: (ctx, lvl) => { const m = 0.5 * lvl * (ctx.wordsPlayedThisRound || 0); return (m || lvl >= 3) ? { addMult: m, timesMult: honeXMult(lvl) } : {}; },
```

(Note the escalation branch now also returns when `lvl >= 3` even if `m` is 0, so its ×Mult kicker can apply; `addMult: m` is then 0, a no-op.)

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/archetypes.test.js`
Expected: PASS.

- [ ] **Step 5: Full suite + commit**

Run: `npm test` (green), then:

```bash
git add src/archetypes.js test/archetypes.test.js
git commit -m "feat: Hone emits ×Mult at high levels (scaling-investment wincon)"
```

---

### Task 5: Personas buy the new relics + harness validation

**Files:**
- Modify: `src/sim.js` (persona `targetRelicIds`)
- Test: `test/sim.test.js` (a guard that each persona targets a scaling source)

**Interfaces:**
- Consumes: the 6 snowball relic ids (Tasks 1–2).
- Produces: each `PERSONAS[i].targetRelicIds` includes its archetype's snowball relic, so the harness exercises the engine.

- [ ] **Step 1: Read the current personas**

Read `src/sim.js` and locate `PERSONAS` (and each persona's `targetRelicIds`). Map snowball relics to archetypes: shortWord→`flywheel`, longWord→`juggernaut`, rareLetter→`rareAvalanche`, doubled→`resonanceEngine`, vowelHeavy→`risingTide`, escalation→`perpetualEngine`.

- [ ] **Step 2: Write the failing test**

Append to `test/sim.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { PERSONAS } from '../src/sim.js';

const SNOWBALL_BY_ARCH = {
  shortWord: 'flywheel', longWord: 'juggernaut', rareLetter: 'rareAvalanche',
  doubled: 'resonanceEngine', vowelHeavy: 'risingTide', escalation: 'perpetualEngine',
};

test('each persona targets its archetype snowball relic', () => {
  for (const p of PERSONAS) {
    const want = SNOWBALL_BY_ARCH[p.archetype];
    assert.ok(p.targetRelicIds.includes(want), `${p.name} should target ${want}`);
  }
});
```

(Confirm the persona field names by reading `sim.js` — adjust `p.archetype` / `p.targetRelicIds` to the real property names.)

- [ ] **Step 3: Run to verify it fails**

Run: `node --test test/sim.test.js`
Expected: FAIL.

- [ ] **Step 4: Add each snowball id to the matching persona's `targetRelicIds`** in `src/sim.js` (append the id to the existing array for each of the 6 personas, per the mapping above).

- [ ] **Step 5: Run to verify it passes**

Run: `node --test test/sim.test.js`
Expected: PASS.

- [ ] **Step 6: Full suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 7: Validate the engine in the harness (capture output)**

Run `npm run analyze:sim-v2` (current provisional curve). Then, to confirm the engine lets builds ride a STEEPER curve, temporarily run the curve sweep used in 0c (or a one-off) with the engine in place. Capture the win-rate table verbatim into the commit message / report. Expected direction: win-rates should rise vs the pre-engine baseline (snowballs + Hone-×Mult now compound). This is a REPORT, not a gate to pass automatically — the author judges the result.

- [ ] **Step 8: Commit**

```bash
git add src/sim.js test/sim.test.js
git commit -m "feat: personas buy archetype snowball relics (harness exercises the scaling engine)"
```

---

## Self-Review notes

- **Spec coverage:** D1 (snowball mechanic) = Tasks 1–2; D2 (Hone ×Mult) = Task 4; per-archetype ×Mult wincon = snowball-per-archetype (Tasks 1–2) + Hone-×Mult (Task 4); persistence of the new state = Task 3; harness validation = Task 5. The blowup dial (D3) needs no code (no cap added; precision/`naneinf` guard is a display concern handled when scores get large — out of scope for this engine plan, tracked for the UI/feel work). Effect-vocabulary items D4–D9 are a SEPARATE later plan.
- **Type consistency:** snowball relics expose `{ id, name, desc, snowball: { condition }, evaluate }`; state is `run.relicState[id] = { stacks }`; `evaluate` reads `ctx.relicState?.[id]?.stacks`. `playWord` passes `relicState` in `context`. `scoring.js` unchanged.
- **`scoring.js` untouched** — the locked formula is respected; ×Mult of `1` is a no-op there already.
