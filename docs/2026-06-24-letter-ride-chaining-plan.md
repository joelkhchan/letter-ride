# Word-Combos / Chaining (Phase 3, SP3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a per-round **letter-chain** scoring dimension (a word continues the chain when its first letter equals the previous word's last letter) plus two chain relics that reward an escalating chain, a chain indicator, and persistence.

**Architecture:** `run.js` tracks `run.chainLength` + `run.lastWord` per round and passes `chainLength` into the existing `scoreWord` context (the **locked `scoring.js` is untouched** — chain relics read `ctx.chainLength` and emit ordinary deltas). Chain state is reset each round and **persisted** (schema bump v5 -> v6). A small chain indicator renders from run state (render-only).

**Tech Stack:** Vanilla JS ESM, no build step. `node --test` via `npm test`. UI verified manually. Design: [docs/2026-06-24-letter-ride-chaining-design.md](2026-06-24-letter-ride-chaining-design.md).

## Global Constraints

- **`scoring.js` is LOCKED and untouched.** Chaining adds `chainLength` to the scoring *context* (in `run.js`); chain relics read it and emit ordinary `+Points / +Mult / ×Mult`. Phase order `mult = (1 + ΣaddMult) × ΠtimesMult` is unaffected.
- **Chain relation (v1):** a word continues the chain when its **first spelled letter == the previous word's last spelled letter** (uppercased). First word of a round → `chainLength = 1`. A break → `chainLength = 1`. No wild special-casing (wilds aren't spellable yet).
- **Relic-gated reward, always-tracked state:** `chainLength` is computed every play, but only affects score via a chain relic. Existing balance is undisturbed when no chain relic is owned.
- **Escalation:** bonus scales with links = `chainLength - 1` (neutral at `chainLength` 1).
- **Persistence:** `run.chainLength` + `run.lastWord` are serialized; **schema bumps v5 -> v6**; `loadRun` guard becomes `!== 6` (old v5 saves drop gracefully). Reset both at round start.
- **No em dashes** in any player-facing copy. **Magnitudes are tunable, author-owned** (Chain Reaction ×0.5/link, Through-Line +8/link are starting points).
- Harness (`analyze:sim-v2`) must stay green (regression gate).

---

### Task 1: Chain tracking in `run.js`

**Files:**
- Modify: `src/run.js` (`newRun` init, `nextRound` reset, `playWord` compute + context + set)
- Test: `test/run.test.js` (extend)

**Interfaces:**
- Produces (consumed by Tasks 2-4): `run.chainLength` (number, per-round), `run.lastWord` (`{ lastLetter } | null`), and `context.chainLength` passed to `scoreWord`.

- [ ] **Step 1: Write the failing tests**

Add to `test/run.test.js` (after the existing imports/fixtures):

```js
const chainDict = makeDictionary(['cat', 'tan', 'nap', 'dog']);
const seatWord = (run, word) => {
  const s = word.toUpperCase().split('').map(ch => ({ tile: makeTile(ch), letter: ch }));
  run.rack = s.map(x => x.tile);
  return s;
};

test('chaining: chainLength is 1 first word, +1 on a letter-chain continue, resets to 1 on a break', () => {
  resetTileIds();
  const run = newRun({ config: { ...config, STARTING_BAG: ['C','A','T'] }, dictionary: chainDict, seed: 1 });
  run.target = 100000; run.playsLeft = 10;                 // never clear/lose mid-test
  playWord(run, seatWord(run, 'cat'));  assert.equal(run.chainLength, 1);  // first word
  playWord(run, seatWord(run, 'tan'));  assert.equal(run.chainLength, 2);  // CAT->T, TAN starts T
  playWord(run, seatWord(run, 'nap'));  assert.equal(run.chainLength, 3);  // TAN->N, NAP starts N
  playWord(run, seatWord(run, 'dog'));  assert.equal(run.chainLength, 1);  // NAP->P, DOG starts D (break)
  assert.deepEqual(run.lastWord, { lastLetter: 'G' });
});

test('chaining: chainLength + lastWord reset at nextRound', () => {
  resetTileIds();
  const run = newRun({ config: { ...config, STARTING_BAG: ['C','A','T'] }, dictionary: chainDict, seed: 1 });
  run.target = 100000; run.playsLeft = 10;
  playWord(run, seatWord(run, 'cat'));
  assert.equal(run.chainLength, 1);
  nextRound(run);
  assert.equal(run.chainLength, 0);
  assert.equal(run.lastWord, null);
});

test('chaining: chainLength reaches the scoring context (read by a fixture relic)', () => {
  resetTileIds();
  const run = newRun({ config: { ...config, STARTING_BAG: ['C','A','T'] }, dictionary: chainDict, seed: 1 });
  run.target = 100000; run.playsLeft = 10;
  run.relics = [{ id: 'cx', name: 'cx', evaluate: (ctx) => ({ addPoints: (ctx.chainLength || 0) >= 2 ? 100 : 0 }) }];
  const r1 = playWord(run, seatWord(run, 'cat'));   // chainLength 1 -> no bonus
  const r2 = playWord(run, seatWord(run, 'tan'));   // chainLength 2 -> +100
  assert.equal(r1.scored.points < 100, true);
  assert.equal(r2.scored.points >= 100, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `run.chainLength` is `undefined`; the fixture-relic bonus never fires.

- [ ] **Step 3: Implement chain tracking**

In `src/run.js`:

(a) In `newRun`, add to the `run` object literal, right after `wordsPlayedThisRound: 0,`:

```js
    chainLength: 0,
    lastWord: null,
```

(b) In `playWord`, immediately BEFORE the `const scored0 = scoreWord(selection, {` line, insert the chain computation:

```js
  // Chaining: a word continues the letter-chain when its first spelled letter equals the previous
  // word's last spelled letter (this round). Computed before scoring so chain relics read it.
  const chainFirst = selection[0].letter.toUpperCase();
  const chainLast = selection[selection.length - 1].letter.toUpperCase();
  const chainLength = (run.lastWord && run.lastWord.lastLetter === chainFirst) ? run.chainLength + 1 : 1;
```

(c) In that same `scoreWord` call, add `chainLength` to the `context` object:

```js
    context: { wordsPlayedThisRound: run.wordsPlayedThisRound, enablers, relicState: run.relicState, chainLength },
```

(d) In `playWord`, right after `run.wordsPlayedThisRound += 1;`, persist the chain state for the next word:

```js
  run.chainLength = chainLength;
  run.lastWord = { lastLetter: chainLast };
```

(e) In `nextRound`, right after `run.wordsPlayedThisRound = 0;`, add:

```js
  run.chainLength = 0;
  run.lastWord = null;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (new chaining tests + all pre-existing).

- [ ] **Step 5: Commit**

```bash
git add src/run.js test/run.test.js
git commit -m "feat: per-round letter-chain tracking (run.chainLength + lastWord, in scoring context)"
```

---

### Task 2: Chain relics

**Files:**
- Modify: `src/relics.js`
- Test: `test/relics.test.js` (extend)

**Interfaces:**
- Consumes: `ctx.chainLength` (Task 1).
- Produces: `RELICS.chainReaction`, `RELICS.throughLine` in `ALL_RELIC_IDS` (shop reads it).

- [ ] **Step 1: Write the failing test**

Add to `test/relics.test.js` (ensure `ALL_RELIC_IDS` is imported from `../src/relics.js`):

```js
test('chainReaction xMult scales with chainLength (neutral at 1)', () => {
  const r = RELICS.chainReaction;
  assert.deepEqual(r.evaluate({ chainLength: 1 }), { timesMult: 1 });
  assert.deepEqual(r.evaluate({ chainLength: 3 }), { timesMult: 2 });   // 1 + 0.5*2
  assert.ok(ALL_RELIC_IDS.includes('chainReaction'));
});

test('throughLine +Points scales with chainLength (neutral at 1)', () => {
  const r = RELICS.throughLine;
  assert.deepEqual(r.evaluate({ chainLength: 1 }), { addPoints: 0 });
  assert.deepEqual(r.evaluate({ chainLength: 4 }), { addPoints: 24 });  // 8*3
  assert.ok(ALL_RELIC_IDS.includes('throughLine'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `RELICS.chainReaction` / `RELICS.throughLine` undefined.

- [ ] **Step 3: Add the two relics**

In `src/relics.js`, inside the `RELICS` object (after the retrigger relics from SP1):

```js
  // ── Phase 3 SP3: Chaining relics (read ctx.chainLength, the letter-chain length this round) ──
  chainReaction: {
    id: 'chainReaction', name: 'Chain Reaction',
    desc: 'Mult grows with your word-chain: x(1 + 0.5 per chained word after the first)',
    evaluate: (ctx) => ({ timesMult: 1 + 0.5 * Math.max(0, (ctx.chainLength || 1) - 1) }),
  },
  throughLine: {
    id: 'throughLine', name: 'Through-Line',
    desc: '+8 Points per chained word after the first',
    evaluate: (ctx) => ({ addPoints: 8 * Math.max(0, (ctx.chainLength || 1) - 1) }),
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/relics.js test/relics.test.js
git commit -m "feat: chain relics Chain Reaction (xMult) + Through-Line (+Points)"
```

---

### Task 3: Persist chain state (schema v5 -> v6)

**Files:**
- Modify: `src/storage.js`
- Test: `test/storage.test.js` (extend + bump version-pin asserts)

**Interfaces:**
- Consumes: `run.chainLength`, `run.lastWord` (Task 1).

- [ ] **Step 1: Write the failing test + bump version pins**

In `test/storage.test.js`:

(a) Update the four current-version assertions. They are all the identical line `assert.equal(data.version, 5);` (4 occurrences) — change each to `assert.equal(data.version, 6);` (a replace-all of that exact line is safe). Also update the test title on the line `test('nodeEventId round-trips through serialize/deserialize; version is 5', () => {` to `... version is 6`.

(b) Add a round-trip test:

```js
test('SP3: chainLength + lastWord round-trip through serialize/deserialize', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.chainLength = 3;
  run.lastWord = { lastLetter: 'T' };
  const restored = deserializeRun(serializeRun(run), { config, dictionary: dict });
  assert.equal(restored.chainLength, 3);
  assert.deepEqual(restored.lastWord, { lastLetter: 'T' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `serializeRun` still emits `version: 5` (the bumped pins now expect 6) and does not carry `chainLength`/`lastWord`.

- [ ] **Step 3: Implement the schema bump + fields**

In `src/storage.js`:

(a) In `serializeRun`, change `version: 5,` to `version: 6,` and add (after `wordsPlayedThisRound: run.wordsPlayedThisRound,`):

```js
    chainLength: run.chainLength ?? 0,
    lastWord: run.lastWord ?? null,
```

(b) In `deserializeRun`, add (after `wordsPlayedThisRound: data.wordsPlayedThisRound,`):

```js
    chainLength: data.chainLength ?? 0,
    lastWord: data.lastWord ?? null,
```

(c) In `loadRun`, change the guard `if (data.version !== 5) return null;` to `if (data.version !== 6) return null;`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (round-trip + all version-pin asserts at 6 + the existing stale/v1 drop tests still pass, since 999 and 1 are both `!== 6`).

- [ ] **Step 5: Commit**

```bash
git add src/storage.js test/storage.test.js
git commit -m "feat: persist chain state (chainLength + lastWord); schema v5 -> v6"
```

---

### Task 4: Chain indicator (UI) + boot smoke

**Files:**
- Modify: `src/ui.js` (`renderRun`)
- Optional: `src/style.css` (a style for the indicator, mirroring `#boss-banner`)

**Interfaces:**
- Consumes: `run.chainLength`, `run.lastWord`.

UI is verified manually. Render-only — no rules in the UI.

- [ ] **Step 1: Add the chain indicator to `renderRun`**

In `src/ui.js` `renderRun`, the template has the boss-banner line:

```js
    ${run.boss && BOSSES[run.boss] ? `<div id="boss-banner"><b>${BOSSES[run.boss].name}</b> &middot; ${BOSSES[run.boss].desc}</div>` : ''}
```

Immediately AFTER that line (still before `<div id="rack">`), add a chain indicator that shows once a chain of 2+ is active:

```js
    ${run.chainLength > 1 ? `<div id="chain-banner">Chain &times;${run.chainLength}${run.lastWord ? ` &middot; continue with ${run.lastWord.lastLetter}` : ''}</div>` : ''}
```

- [ ] **Step 2: (Optional) style it**

If `src/style.css` styles `#boss-banner`, add a sibling rule for `#chain-banner` (a distinct accent, e.g. a teal/green tint to read as "good/combo" vs the boss amber). Keep it legible in dark mode. This is cosmetic; skip if time-boxed.

- [ ] **Step 3: Run the suite (no DOM unit test) + browser smoke**

Run: `npm test` (confirm still green — the UI addition must not break any test).
Then the controller runs a browser boot smoke (`npm run serve`, load the page, confirm no console errors and the run screen renders). The chain indicator only appears mid-round with an active chain, so the live chain visual is part of the author playtest; the boot smoke confirms `ui.js` still loads + renders.

- [ ] **Step 4: Commit**

```bash
git add src/ui.js src/style.css
git commit -m "feat: chain indicator (length + continue-letter) above the rack"
```

(If `style.css` was not changed, commit only `src/ui.js`.)

---

### Task 5: Harness regression gate

- [ ] **Step 1: Run the harness (no code)**

Run: `npm run analyze:sim-v2`
Expected: runs clean across all 6 personas (chain tracking is harmless to the greedy bot, which holds no chain relic by default). Win-rates stay in the same band — confirms **no regression**, not balance. Record the output in the SDD ledger.

---

## Self-Review

- **Spec coverage:** C1 letter-chain relation (Task 1) · C2 relic-gated/always-tracked (Task 1 computes always; Tasks 2 relics reward) · C3 escalation links = chainLength-1 (Task 2) · C4 no wild special-case (Task 1 uses spelled letters) · C5 scoring.js untouched, context carries chainLength (Task 1) · C6 two relics (Task 2) · C7 chain indicator (Task 4) · C8 persist + v5->v6 (Task 3).
- **Placeholder scan:** none — concrete code/commands throughout. Task 3 names the exact assert line to replace-all and the title to edit.
- **Type consistency:** `run.chainLength` (number), `run.lastWord` (`{lastLetter}|null`), `ctx.chainLength`; relic ids `chainReaction`/`throughLine`. Reset values (`0`/`null`) consistent across `newRun`, `nextRound`, and the deserialize defaults.
- **Edit fidelity:** Task 1 anchors on `wordsPlayedThisRound` lines (init + reset + increment) and the `scoreWord(` call; Task 3 anchors on `version: 5,`, the `wordsPlayedThisRound` serialize/deserialize lines, and the `!== 5` guard; Task 4 anchors on the boss-banner template line. All verified against current source.
