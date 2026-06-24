# Eval Harness v3 (Skill-Gradient Instrument) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Revision note (post spec-review):** this plan was revised after a two-reviewer skeptical critique. Fixes folded in: a lightweight `cloneRun` that deep-copies `relicState` (the original storage round-trip shared the snowball-stack object by reference — a correctness blocker for snowball personas, and slow); a corrected Task 2 test (no `await` in a non-async callback, no phantom import); one shared exported `scoringOpts` so greedy and lookahead rank under the same basis; Task 8 (`runPersona` `agentFor`) moved ahead of the instrument that consumes it; the `clearMargins` insertion pinned into the verbatim loop; the arbitrary "no-brainer ≥ 0.6 / steep gradient" cutoffs reframed as reported distributions for the author to calibrate; and the human-vocabulary policy demoted from a build task to Deferred coverage.

**Goal:** Turn the harness from "four scripts that print suggestive tables under one fixed greedy policy" into a **decision-grade instrument** that can (a) separate skill from luck by running the same seeds through a *ladder of policies*, (b) report confidence intervals and paired significance so the tune-loop stops chasing noise, (c) emit continuous clear-margin and board-legibility diagnostics, and (d) quantify and remove a *suspected* enumeration bias against the wild/rare archetypes.

**Architecture:** Keep the existing pure, DI, DOM-free split. Extract the duplicated word-enumeration into one shared `src/enumerate.js`. Introduce a first-class **Agent** interface (`choosePlay` / `chooseDiscard` / `chooseShop`) so the *play policy* becomes swappable the way the shop policy already is. Add three play policies — **random** (floor), **greedy** (current), and **lookahead-k** (an exact bounded round-search, since within-round draws are deterministic). Add pure stats (`wilsonInterval`, `mcnemar`, `normalCI`). Extend `simulateRun` to record clear-margins, a per-rack decision-gap, and a purchase log. A new instrument `scripts/analyze-eval.js` runs the policy ladder × personas × seeds and prints the skill gradient with CIs and a paired greedy→lookahead test. **This harness only REPORTS — it changes no `config`/`relics`/`archetypes` numbers (tuning stays a deferred author playtest call).**

**Tech Stack:** Vanilla JS ESM, `node --test` (Node built-in runner), no build step, no framework.

## Global Constraints

- **Determinism:** no `Math.random()` anywhere in `src/`. All randomness flows through `run.rng` (seeded). Stats are analytic (no rng) so output is reproducible for a fixed config. Same seed ⇒ same run. (Verbatim from CLAUDE.md.)
- **Logic vs UI split is strict.** All new modules (`enumerate`, `agents`, `lookahead`, `stats`, `report`) are pure + DOM-free and unit-tested headless. `config`/`dictionary`/`words`/`pool`/`agent` are injected, never imported as globals inside logic. (Verbatim from CLAUDE.md.)
- **`config.js` holds every tunable number and no logic.** This plan touches no balance numbers.
- **Engine-edit boundary (supersedes the v2 plan's "do NOT modify `run.js`/`scoring.js`/`shop.js"):** v3 keeps `scoring.js` untouched and `run.js` driven-not-modified, but **does** make two small, declared edits: (1) an additive `purchaseLog` push in `shop.js` `purchase` (a no-op when `run.purchaseLog` is absent, which the UI never sets), and (2) adding `relicState` to the existing `scoringOpts` in `sim.js` and exporting it (Task 4 Step 0). Edit (2) is a **measurement-accuracy fix**, not a balance change — it aligns the harness's `bestPlay` ranking with what `run.js` `playWord` actually scores (the engine passes `relicState`; `bestPlay` currently does not). It can shift existing v2 `analyze:sim-v2` numbers slightly for snowball personas; capture the delta when it lands, do not treat it as tuning.
- **Keep v1 + v2 working:** `legalWords`/`bestPlay`/`simulateRun` (greedy), `buildPurchasePolicy`/`noShop`/`PERSONAS`/`runPersona`, `percentile`/`summarizePersona` must still pass (modulo the declared `scoringOpts` accuracy delta). v3 *extends*: `simulateRun` gains an optional `agent`; with no `agent` it builds the v1/v2 greedy agent from the legacy `policy`/`discardPolicy` params.
- **Tests inject tiny fixtures** (a small dictionary, a small bag) — never the full 170k list. The instrument uses the real ENABLE list; unit tests never do.
- **Author-decision boundary:** v3 produces numbers and significance tests; it does not pick tuning values, add a vowel floor, touch the scarcity pillar, or decide the position-lever question. Those are deferred author calls (CLAUDE.md working agreement).
- **Tier discipline:** this plan covers eval of *built* systems (Tier 0/1 + the 1.5 scaling engine). Boss, meta, position-lever, human-vocabulary, and LLM-judge evals are **deferred** to their own just-in-time plans (see §"Deferred coverage") because they either depend on unbuilt engine features or are out of the §6 harness scope; specifying TDD code against APIs that do not exist yet would be a placeholder.

- **Boss-awareness (added after a repo-state divergence; supersedes Task 4 Step 0's "export scoringOpts" wording):** the repo has moved past the pre-Passages world — `bosses.js` is committed on `main` (8c89b78), `ROUND_TARGETS` is now a 12-encounter tiered Passage structure (Word/Phrase/Sentence x 4; Sentence rounds are bosses), and a `run.js` boss integration (sets `run.boss` per encounter, scores via `bossTileValues`/`applyBossToScore`) is a separate in-flight workstream. This harness builds in a worktree off green `HEAD` (without that uncommitted integration). To stay correct on boss rounds, **Task 4 Step 0 introduces one exported `scoreFor(run, selection)` helper** (not a bare `scoringOpts` export) that faithfully mirrors `playWord`: it scores with `relicState` in context AND with `bossTileValues(run.tileValues, boss)` + `applyBossToScore(...)`, where `boss = run.boss ? BOSSES[run.boss] : null`. `bestPlay`, `topTwoGap`, and lookahead's `candidatePlays` all score via `scoreFor`. Because `run.boss` is undefined on the current base, `scoreFor` is a **no-op for bosses until the `run.js` integration merges** into the harness base, then becomes correct automatically. `cloneRun` preserves `run.boss`/`run.bossOrder` (the `...run` spread copies both; `bossOrder` is read-only mid-round). Runtime/round-count language that says "8 rounds" means the **12 tiered encounters**. Deferred item **D1 (boss survivability matrix) is promoted into Wave 3** (Task 11): a sim-layer `bossFor(roundIndex)` injection lets the eval drive a specific boss per encounter so the matrix runs without waiting on the `run.js` integration.

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/enumerate.js` | Shared, single-source word enumeration: `countsOf`, `canForm`, `legalWords`, `selectionFor`. Wild-unaware in Wave 0 (verbatim relocation), wild-aware in Wave 2. | Create |
| `src/sim.js` | Import enumeration from `enumerate.js`. Export `scoringOpts` (+ `relicState`). `simulateRun` accepts an optional `agent` + records diagnostics. `randomPlay`. `runPersona` gains `agentFor`. | Modify |
| `src/agents.js` | The `Agent` interface: `makeAgent`, `greedyAgent`, `randomAgent`, `lookaheadAgent`. | Create |
| `src/lookahead.js` | `cloneRun` (lightweight mid-round clone) + `lookaheadPlay` (exact bounded round-search). | Create |
| `src/stats.js` | Pure stats: `wilsonInterval`, `mcnemar`, `normalCI`. | Create |
| `src/report.js` | Pure reporting helpers: `diffSummaries`, `formatPct`, `toJSON`. | Create |
| `src/shop.js` | Additive `purchaseLog` push in `purchase` (no behavior change when absent). | Modify |
| `scripts/analyze-eval.js` | v3 instrument: policy ladder × personas × seeds → skill-gradient table + CIs + paired test + margin/decision-gap percentiles. `--json`, `--n=`. | Create |
| `package.json` | add `analyze:eval`. | Modify |
| `test/enumerate.test.js`, `test/agents.test.js`, `test/lookahead.test.js`, `test/stats.test.js`, `test/report.test.js` | Unit tests for the new pure modules. | Create |
| `test/sim.test.js` | Tests for `randomPlay`, the `agent` path, the diagnostics, and `runPersona({agentFor})`. | Modify |

---

# Wave 0 — Foundation (no measurement change; pure refactors that unlock everything)

### Task 1: Extract the shared word enumerator

**Files:**
- Create: `src/enumerate.js`
- Modify: `src/sim.js` (delete local `countsOf`/`canForm`/`legalWords`/`selectionFor`, import them)
- Test: `test/enumerate.test.js`

**Interfaces — Produces:**
- `countsOf(letters) -> { [letter]: count }`
- `canForm(word, counts) -> boolean` — every letter in `word` is available in `counts` (wild-unaware in Wave 0).
- `legalWords(letters, wordList, minLen) -> string[]` — filter `wordList` to words of length `[minLen, letters.length]` that `canForm`.
- `selectionFor(word, rack) -> [{tile, letter}] | null` — build a selection of real rack tiles, one per letter, or `null`.

This is a **verbatim relocation** of the four functions currently in `src/sim.js:29-53`. No behavior change.

- [ ] **Step 1: Write the failing tests** — create `test/enumerate.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { countsOf, canForm, legalWords, selectionFor } from '../src/enumerate.js';

test('countsOf tallies letters', () => {
  assert.deepEqual(countsOf(['A', 'B', 'A']), { A: 2, B: 1 });
});

test('canForm respects multiplicity', () => {
  assert.equal(canForm('AA', { A: 2 }), true);
  assert.equal(canForm('AA', { A: 1 }), false);
  assert.equal(canForm('CAT', { C: 1, A: 1, T: 1 }), true);
});

test('legalWords filters by length window and formability', () => {
  const words = ['CAT', 'AT', 'CATS', 'DOG'];
  assert.deepEqual(legalWords(['C', 'A', 'T', 'S'], words, 3).sort(), ['CAT', 'CATS']);
});

test('selectionFor maps each letter to a distinct real tile, or null', () => {
  const rack = [{ id: 't1', letter: 'C' }, { id: 't2', letter: 'A' }, { id: 't3', letter: 'T' }];
  const sel = selectionFor('CAT', rack);
  assert.equal(sel.length, 3);
  assert.deepEqual(sel.map(s => s.letter), ['C', 'A', 'T']);
  assert.equal(selectionFor('CATS', rack), null);
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/enumerate.test.js` → FAIL ("Cannot find module '../src/enumerate.js'").

- [ ] **Step 3: Create `src/enumerate.js`** — move the functions out of `sim.js` verbatim:

```javascript
// src/enumerate.js — single source of word-enumeration. Pure + DI. No Math.random.
// Wild-unaware in Wave 0 (identical to the original sim.js logic); Wave 2 adds wild support.

export function countsOf(letters) {
  const c = {};
  for (const l of letters) c[l] = (c[l] || 0) + 1;
  return c;
}

export function canForm(word, counts) {
  const need = {};
  for (const ch of word) {
    need[ch] = (need[ch] || 0) + 1;
    if (need[ch] > (counts[ch] || 0)) return false;
  }
  return true;
}

export function legalWords(letters, wordList, minLen) {
  const c = countsOf(letters);
  const max = letters.length;
  return wordList.filter(w => w.length >= minLen && w.length <= max && canForm(w, c));
}

// Build a selection of REAL rack tiles for `word` (one tile per letter); null if rack can't supply it.
export function selectionFor(word, rack) {
  const pool = [...rack];
  const sel = [];
  for (const ch of word) {
    const i = pool.findIndex(t => t.letter === ch);
    if (i < 0) return null;
    sel.push({ tile: pool[i], letter: ch });
    pool.splice(i, 1);
  }
  return sel;
}
```

- [ ] **Step 4: Update `src/sim.js`** — delete the local `countsOf`/`canForm`/`legalWords`/`selectionFor` definitions (lines 29-53) and re-export `legalWords` from the new module so existing importers keep working (`test/sim.test.js` imports `legalWords` from `sim.js`):

```javascript
import { legalWords, selectionFor } from './enumerate.js';
export { legalWords };   // sim.js historically re-exported legalWords; keep that surface
```
(Leave `bestPlay`, `scoringOpts`, etc. untouched for now — they call the imported `legalWords`/`selectionFor`. `scoringOpts` is changed in Task 4 Step 0.)

- [ ] **Step 5: Run to verify it passes** — `node --test test/enumerate.test.js` → PASS, then `npm test` (whole suite still green; existing `sim.test.js` proves `bestPlay` is unchanged).

- [ ] **Step 6: Commit** — `git add src/enumerate.js src/sim.js test/enumerate.test.js && git commit -m "refactor: extract shared word enumerator (src/enumerate.js)"`

---

### Task 2: First-class Agent interface (swappable play policy)

**Files:**
- Create: `src/agents.js`
- Modify: `src/sim.js` (`simulateRun` accepts an optional `agent`; add `randomPlay`)
- Test: `test/agents.test.js`, `test/sim.test.js`

**Interfaces — Consumes:** `bestPlay`/`smartDiscard`/`noShop` (existing `sim.js`). **Produces:**
- `makeAgent({ choosePlay, chooseDiscard, chooseShop }) -> Agent` where `Agent = { choosePlay(run, words) -> play|null, chooseDiscard(run) -> selection, chooseShop(run) -> void }`. `play` has the `bestPlay` shape `{ word, selection, score }`.
- `greedyAgent(shopPolicy = noShop) -> Agent` — `choosePlay = bestPlay`, `chooseDiscard = smartDiscard`, `chooseShop = shopPolicy`.
- `randomAgent(shopPolicy = noShop) -> Agent` — `choosePlay = randomPlay`, else greedy's discard/shop.
- `randomPlay(run, words) -> play|null` (added to `sim.js`) — pick a uniformly random legal word using `run.rng` (deterministic at the run level); the floor policy.
- `simulateRun` gains optional `agent`. When omitted it constructs the greedy agent from the legacy `policy`/`discardPolicy` params, so v1/v2 behavior is preserved.

> **No circular import:** `agents.js` imports from `sim.js`; `sim.js` must NOT import `agents.js`. `simulateRun`'s default agent is an inline object, not `greedyAgent`. (Verified acyclic: `agents → lookahead → sim → ∅`.)

- [ ] **Step 1: Write the failing tests** — create `test/agents.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeAgent, greedyAgent, randomAgent } from '../src/agents.js';
import { noShop } from '../src/sim.js';

test('makeAgent returns the three hooks', () => {
  const a = makeAgent({ choosePlay: () => 'p', chooseDiscard: () => [], chooseShop: () => {} });
  assert.equal(a.choosePlay(), 'p');
  assert.deepEqual(a.chooseDiscard(), []);
  assert.equal(typeof a.chooseShop, 'function');
});

test('greedyAgent wires bestPlay + smartDiscard + the given shop policy', () => {
  const a = greedyAgent(noShop);
  assert.equal(typeof a.choosePlay, 'function');
  assert.equal(typeof a.chooseDiscard, 'function');
  assert.equal(a.chooseShop, noShop);
});

test('randomAgent uses randomPlay but greedy discard/shop', () => {
  const a = randomAgent(noShop);
  assert.equal(typeof a.choosePlay, 'function');
  assert.equal(a.chooseShop, noShop);
});
```

And append to `test/sim.test.js`. **Add the agents import at the TOP of the file with the other static imports** (no dynamic `await import` — that would be a SyntaxError in a non-async callback):

```javascript
// top-of-file imports (add alongside the existing ones):
import { greedyAgent } from '../src/agents.js';
import { randomPlay } from '../src/sim.js';
// (note: importing from agents.js in sim.test.js is fine — the cycle ban is sim.js↔agents.js, not the test file)
```

```javascript
test('randomPlay returns a legal play the rack can form (or null), with the bestPlay shape', () => {
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  const p = randomPlay(run, wordsB); // consumes one run.rng draw to index the legal-word list
  assert.ok(p === null || (p.selection && p.word));
});

test('simulateRun with an explicit greedy agent matches the default (no agent) run', () => {
  const a = simulateRun({ config: configB, dictionary: dictB, words: wordsB, seed: 5 });
  const b = simulateRun({ config: configB, dictionary: dictB, words: wordsB, seed: 5, agent: greedyAgent() });
  assert.equal(a.roundReached, b.roundReached);
  assert.equal(a.won, b.won);
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement `randomPlay` in `src/sim.js`** (next to `bestPlay`; `selectionFor` is already imported from `enumerate.js` via Task 1):

```javascript
// Floor policy: pick a uniformly random legal word using run.rng (deterministic at the run level).
export function randomPlay(run, wordList) {
  const words = legalWords(run.rack.map(t => t.letter), wordList, run.config.MIN_WORD_LEN);
  const formable = words.map(w => ({ w, sel: selectionFor(w, run.rack) })).filter(x => x.sel);
  if (formable.length === 0) return null;
  const idx = Math.floor(run.rng() * formable.length);
  const { w, sel } = formable[idx];
  return { word: w, selection: sel, score: 0 };
}
```

- [ ] **Step 4: Make `simulateRun` agent-aware in `src/sim.js`.** Change the signature and the loop body:

```javascript
export function simulateRun({
  config, dictionary, words, seed, deck = null, cap = 1000,
  policy = noShop, discardPolicy = smartDiscard, agent = null,
}) {
  // Backward-compatible default agent: greedy play + the legacy discard/shop params.
  const A = agent || {
    choosePlay: (run, w) => bestPlay(run, w),
    chooseDiscard: (run) => discardPolicy(run),
    chooseShop: (run) => policy(run),
  };
  const run = newRun({ config, dictionary, seed, deck });
  let iter = 0, deadRacks = 0, racksSeen = 0;
  while (run.status === 'playing' && iter < cap) {
    iter++;
    const play = A.choosePlay(run, words);
    if (play) {
      playWord(run, play.selection);
    } else if (run.discardsLeft > 0 && run.rack.length > 0) {
      discard(run, A.chooseDiscard(run));
    } else {
      break;
    }
    if (run.status !== 'roundCleared' && run.status !== 'won') {
      racksSeen += 1;
      if (!bestPlay(run, words)) deadRacks += 1;
    }
    if (run.status === 'roundCleared') { A.chooseShop(run); nextRound(run); }
  }
  if (run.status === 'playing') run.status = 'lost';
  return { won: run.status === 'won', status: run.status, roundReached: run.roundIndex + 1, hitCap: iter >= cap, deadRacks, racksSeen };
}
```
(Task 7 extends this loop with diagnostics — pinned there.)

- [ ] **Step 5: Create `src/agents.js`:**

```javascript
// src/agents.js — the Agent interface: a bundle of play/discard/shop policies.
// Imports from sim.js (one direction only — sim.js must not import this file).
import { bestPlay, smartDiscard, noShop, randomPlay } from './sim.js';

export function makeAgent({ choosePlay, chooseDiscard, chooseShop }) {
  return { choosePlay, chooseDiscard, chooseShop };
}

export function greedyAgent(shopPolicy = noShop) {
  return makeAgent({ choosePlay: (run, w) => bestPlay(run, w), chooseDiscard: smartDiscard, chooseShop: shopPolicy });
}

export function randomAgent(shopPolicy = noShop) {
  return makeAgent({ choosePlay: (run, w) => randomPlay(run, w), chooseDiscard: smartDiscard, chooseShop: shopPolicy });
}
```

- [ ] **Step 6: Run, pass; `npm test`.**
- [ ] **Step 7: Commit** — `git add src/sim.js src/agents.js test/agents.test.js test/sim.test.js && git commit -m "feat: harness v3 — Agent interface + random floor policy"`

---

### Task 3: Pure reporting + baseline-diff helpers

**Files:**
- Create: `src/report.js`
- Test: `test/report.test.js`

**Interfaces — Produces:**
- `formatPct(x, dp = 1) -> string` — `0.625 -> "62.5%"`.
- `diffSummaries(after, before) -> { winRateDelta, p10Delta, p50Delta, p90Delta }` — deltas between two `summarizePersona` outputs, for diffing a tuning run against a saved baseline. Missing keys → `0`.
- `toJSON(obj) -> string` — stable, sorted-key JSON (so committed baselines diff cleanly in git).

- [ ] **Step 1: Write the failing tests** — create `test/report.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPct, diffSummaries, toJSON } from '../src/report.js';

test('formatPct', () => {
  assert.equal(formatPct(0.625), '62.5%');
  assert.equal(formatPct(0.1, 0), '10%');
});

test('diffSummaries reports win-rate and p50 deltas', () => {
  const before = { winRate: 0.4, roundReached: { p50: 5 } };
  const after  = { winRate: 0.6, roundReached: { p50: 7 } };
  const d = diffSummaries(after, before);
  assert.equal(Number(d.winRateDelta.toFixed(3)), 0.2);
  assert.equal(d.p50Delta, 2);
});

test('toJSON sorts keys for stable diffs', () => {
  assert.equal(toJSON({ b: 1, a: 2 }), '{\n  "a": 2,\n  "b": 1\n}');
});
```

- [ ] **Step 2: Run, fail.**
- [ ] **Step 3: Implement `src/report.js`:**

```javascript
// src/report.js — pure formatting + baseline-diff helpers. No I/O, no rng.
export function formatPct(x, dp = 1) { return `${(x * 100).toFixed(dp)}%`; }

export function diffSummaries(after, before) {
  return {
    winRateDelta: (after.winRate ?? 0) - (before.winRate ?? 0),
    p10Delta: (after.roundReached?.p10 ?? 0) - (before.roundReached?.p10 ?? 0),
    p50Delta: (after.roundReached?.p50 ?? 0) - (before.roundReached?.p50 ?? 0),
    p90Delta: (after.roundReached?.p90 ?? 0) - (before.roundReached?.p90 ?? 0),
  };
}

function sortKeys(o) {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === 'object') {
    return Object.keys(o).sort().reduce((acc, k) => { acc[k] = sortKeys(o[k]); return acc; }, {});
  }
  return o;
}
export function toJSON(obj) { return JSON.stringify(sortKeys(obj), null, 2); }
```

- [ ] **Step 4: Run, pass; `npm test`.**
- [ ] **Step 5: Commit** — `git add src/report.js test/report.test.js && git commit -m "feat: harness v3 — pure reporting + baseline-diff helpers"`

---

# Wave 1 — Skill gradient, significance, and diagnostics (the headline)

### Task 4: `cloneRun` + lookahead-k play policy

**Files:**
- Modify: `src/sim.js` (Step 0: export `scoringOpts`, add `relicState`)
- Create: `src/lookahead.js`
- Test: `test/lookahead.test.js`, `test/sim.test.js` (scoringOpts)

**Interfaces — Consumes:** `makeRng` (`rng.js`), `legalWords`/`selectionFor` (`enumerate.js`), `scoringOpts` (`sim.js`, now exported), `scoreWord` (`scoring.js`), `playWord` (`run.js`). **Produces:**
- `scoringOpts(run)` becomes an **export** of `sim.js`, with `relicState: run.relicState` added to `context` so it matches what `run.js` `playWord` scores. `bestPlay` and lookahead both use it → identical ranking basis.
- `cloneRun(run) -> run` — **lightweight mid-round clone.** Shallow-copies the arrays/refs that `playWord`/`discard` reassign or mutate (`rack`, `drawPile`, `relics`, `honeLevels`, `tileValues`), **deep-copies `relicState`** (snowball stacks are mutated in place), and clones the rng with its state preserved. Shares the immutable-within-a-round refs (`config`, `dictionary`, `targets`, `bag`, and the tile objects themselves — their `id`s must survive so `selectionFor` works). **Mid-round use only:** `bag` is shared because `startRound` (the only thing that reads it) is never called during a lookahead.
- `lookaheadPlay(run, words, { k = 4, branch = 6 } = {}) -> play|null` — returns the first move of the best line found by an exact search to depth `min(k, playsLeft)`, branching on the top `branch` immediate-score plays. Drop-in for `choosePlay`; selection built on the live `run.rack`.

> **Why this is exact, not expectimax:** within a round nothing consumes `run.rng` (`refillHand` and `discard` are plain `splice`s; the draw-pile order is fixed at `startRound`). So the future of the round is deterministic given the current state. A bounded search over plays is an exact optimization of the round outcome, capped only by `branch` (which may prune a setup play that scores low now but enables a big word later — documented limitation). `searchValue` returns the best **terminal leaf** reachable; `total` is compared only among non-clearing leaves at the depth horizon, and a cleared leaf always beats a non-cleared one.

> **On proving lookahead's *value*:** the unit tests below prove correctness (legal play, clone isolation, no regression vs greedy). They do **not** try to hand-build a guaranteed "greedy trap" fixture (fiddly and brittle under the seeded shuffle). The empirical proof that lookahead adds skill is the **paired greedy→lookahead McNemar** on the real ENABLE list in Task 9 — that is where "skill has headroom" is demonstrated.

- [ ] **Step 0: Export `scoringOpts` and add `relicState` (in `src/sim.js`).** Change the existing `scoringOpts` (currently `function scoringOpts(run)` at ~line 56) to:

```javascript
export function scoringOpts(run) {
  return {
    tileValues: run.tileValues,
    lengthBonusPerLetter: run.config.LENGTH_BONUS_PER_LETTER,
    relics: [...run.relics, ...honeModifiers(run.honeLevels)],
    context: {
      wordsPlayedThisRound: run.wordsPlayedThisRound,
      enablers: run.relics.filter(r => r.enabler).map(r => r.enabler),
      relicState: run.relicState,   // NEW: align bestPlay ranking with what playWord actually scores
    },
  };
}
```
Add a test in `test/sim.test.js` proving `bestPlay` now ranks a snowball word using its stacks (inject a `run.relicState` with stacks and assert the chosen word's score reflects the multiplier). Expect a small change in some existing v2 numbers — this is the declared accuracy fix, not tuning.

- [ ] **Step 1: Write the failing tests** — create `test/lookahead.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneRun, lookaheadPlay } from '../src/lookahead.js';
import { bestPlay, simulateRun } from '../src/sim.js';
import { greedyAgent, makeAgent } from '../src/agents.js';
import { newRun, playWord } from '../src/run.js';
import { makeDictionary } from '../src/dictionary.js';
import { RELICS } from '../src/relics.js';
import { resetTileIds } from '../src/tiles.js';

// Small, self-contained beatable world (no external asset). Used for clone/legality/no-regression.
function makeLookaheadFixture() {
  const words = ['CAT', 'COAT', 'TACO', 'ACT', 'COT', 'CAB', 'TAB', 'AT', 'TO', 'OAT'];
  const config = {
    STARTING_BAG: ['C', 'O', 'A', 'T', 'C', 'A', 'B', 'T', 'O', 'A'],
    TILE_VALUES: { A: 1, B: 3, C: 3, O: 1, T: 1 },
    RACK_SIZE: 4, PLAYS_PER_ROUND: 3, DISCARDS_PER_ROUND: 1,
    MIN_WORD_LEN: 2, LENGTH_BONUS_PER_LETTER: 5,
    ROUND_TARGETS: [40],
    COINS_ON_CLEAR: { base: 4, perUnusedPlay: 1, perUnusedDiscard: 1 },
    INTEREST: { enabled: false, per: 5, rate: 1, cap: 5 },
    DECKS: {},
  };
  return { config, dictionary: makeDictionary(words), words: words.map(w => w.toUpperCase()) };
}

test('cloneRun produces an independent run with preserved rng state and tile ids', () => {
  resetTileIds();
  const { config, dictionary } = makeLookaheadFixture();
  const run = newRun({ config, dictionary, seed: 1 });
  const clone = cloneRun(run);
  assert.notEqual(clone, run);
  assert.deepEqual(clone.rack.map(t => t.id), run.rack.map(t => t.id)); // same tile identities
  assert.equal(clone.rng.getState(), run.rng.getState());              // same rng position
  clone.roundTotal = 999;
  assert.notEqual(run.roundTotal, 999);
});

test('cloneRun isolates relicState — playing on the clone does not ratchet the original snowball', () => {
  resetTileIds();
  const { config, dictionary, words } = makeLookaheadFixture();
  const run = newRun({ config, dictionary, seed: 1 });
  run.relics = [RELICS.perpetualEngine];   // snowball: ratchets on every play
  run.relicState = {};
  const clone = cloneRun(run);
  const sel = bestPlay(clone, words).selection;
  playWord(clone, sel);
  assert.equal((run.relicState.perpetualEngine?.stacks) || 0, 0, 'original stacks untouched');
  assert.ok((clone.relicState.perpetualEngine?.stacks) >= 1, 'clone ratcheted independently');
});

test('lookaheadPlay returns a legal first move', () => {
  resetTileIds();
  const { config, dictionary, words } = makeLookaheadFixture();
  const run = newRun({ config, dictionary, seed: 1 });
  const p = lookaheadPlay(run, words, { k: 3, branch: 5 });
  assert.ok(p && p.selection && p.word);
});

test('lookahead never regresses vs greedy on the same seed', () => {
  const { config, dictionary, words } = makeLookaheadFixture();
  for (const seed of [1, 2, 3, 4, 5]) {
    const greedy = simulateRun({ config, dictionary, words, seed, agent: greedyAgent() });
    const lookA = simulateRun({ config, dictionary, words, seed,
      agent: makeAgent({ choosePlay: (r, w) => lookaheadPlay(r, w, { k: 3, branch: 5 }),
                         chooseDiscard: greedyAgent().chooseDiscard, chooseShop: greedyAgent().chooseShop }) });
    assert.ok(lookA.roundReached >= greedy.roundReached, `lookahead regressed on seed ${seed}`);
  }
});
```
(`resetTileIds` and `RELICS` are existing exports — `resetTileIds` is used by other tests; `RELICS.perpetualEngine` is the always-on snowball from `relics.js`.)

- [ ] **Step 2: Run, fail.**

- [ ] **Step 3: Implement `src/lookahead.js`:**

```javascript
// src/lookahead.js — exact bounded round-search play policy. Pure + DI. No Math.random.
import { makeRng } from './rng.js';
import { legalWords, selectionFor } from './enumerate.js';
import { scoringOpts } from './sim.js';
import { playWord } from './run.js';
import { scoreWord } from './scoring.js';

// Lightweight mid-round clone. Shallow-copies what playWord/discard reassign or mutate; DEEP-copies
// relicState (snowball stacks mutate in place); clones rng with state preserved. Shares immutable
// mid-round refs (config, dictionary, targets, bag, the tile objects). Mid-round use ONLY.
export function cloneRun(run) {
  const rng = makeRng(run.seed);
  rng.setState(run.rng.getState());
  const relicState = {};
  for (const [k, v] of Object.entries(run.relicState || {})) relicState[k] = { ...v };
  return {
    ...run,
    rng,
    rack: [...run.rack],
    drawPile: [...run.drawPile],
    relics: [...run.relics],
    honeLevels: { ...run.honeLevels },
    tileValues: { ...run.tileValues },
    relicState,
  };
}

// Top-`branch` candidate plays for the live rack, ranked by immediate score.
// memo caches legalWords by rack-letter multiset across search nodes (scores are not memoized —
// they depend on relicState/wordsPlayedThisRound which vary even for the same rack).
function candidatePlays(run, wordList, branch, memo) {
  const letters = run.rack.map(t => t.letter);
  const key = [...letters].sort().join('');
  let words = memo.get(key);
  if (!words) { words = legalWords(letters, wordList, run.config.MIN_WORD_LEN); memo.set(key, words); }
  const opts = scoringOpts(run);
  const scored = [];
  for (const w of words) {
    const sel = selectionFor(w, run.rack);
    if (!sel) continue;
    scored.push({ word: w, selection: sel, score: scoreWord(sel, opts).score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, branch);
}

// Value of a terminal leaf: prefer clearing; then a higher round total; among cleared, prefer
// more leftover plays (cheaper clear → more coins/flex).
function lineValue(run) {
  const cleared = run.status === 'roundCleared' || run.status === 'won';
  return { cleared, total: run.roundTotal, playsLeft: run.playsLeft };
}
function better(a, b) {
  if (a.cleared !== b.cleared) return a.cleared ? a : b;
  if (a.cleared) return a.playsLeft >= b.playsLeft ? a : b;
  return a.total >= b.total ? a : b;
}

function searchValue(run, wordList, depth, branch, memo) {
  if (run.status === 'roundCleared' || run.status === 'won') return lineValue(run);
  if (run.status === 'lost' || depth <= 0 || run.playsLeft <= 0) return lineValue(run);
  const cands = candidatePlays(run, wordList, branch, memo);
  if (cands.length === 0) return lineValue(run);
  let best = null;
  for (const c of cands) {
    const child = cloneRun(run);
    const sel = selectionFor(c.word, child.rack); // re-derive on the clone's tiles (same ids)
    if (!sel) continue;
    playWord(child, sel);
    const v = searchValue(child, wordList, depth - 1, branch, memo);
    best = best ? better(best, v) : v;
  }
  return best || lineValue(run);
}

// Return the first move of the best line. Drop-in for choosePlay.
export function lookaheadPlay(run, wordList, { k = 4, branch = 6 } = {}) {
  const memo = new Map();
  const depth = Math.min(k, run.playsLeft);
  const cands = candidatePlays(run, wordList, branch, memo);
  if (cands.length === 0) return null;
  if (depth <= 1) return cands[0]; // no lookahead budget → greedy
  let bestMove = null, bestVal = null;
  for (const c of cands) {
    const child = cloneRun(run);
    const sel = selectionFor(c.word, child.rack);
    if (!sel) continue;
    playWord(child, sel);
    const v = searchValue(child, wordList, depth - 1, branch, memo);
    if (!bestVal || better(v, bestVal) === v) { bestVal = v; bestMove = c; }
  }
  return bestMove || cands[0];
}
```

- [ ] **Step 4: Run, pass; `npm test`** (expect the declared small `scoringOpts` delta in any snowball-sensitive v2 assertions — fix those assertions to the new correct values, noting the cause).
- [ ] **Step 5: Commit** — `git add src/sim.js src/lookahead.js test/lookahead.test.js test/sim.test.js && git commit -m "feat: harness v3 — cloneRun (relicState-safe) + exact lookahead-k; align scoringOpts with engine"`

---

### Task 5: `lookaheadAgent` factory

**Files:** Modify `src/agents.js`, `test/agents.test.js`.
**Interfaces — Produces:** `lookaheadAgent(shopPolicy = noShop, { k = 4, branch = 6 } = {}) -> Agent` — `choosePlay = lookaheadPlay(…, {k, branch})`, greedy discard/shop.

- [ ] **Step 1: Failing test** (append to `test/agents.test.js`):

```javascript
import { lookaheadAgent } from '../src/agents.js';
test('lookaheadAgent exposes the three hooks', () => {
  const a = lookaheadAgent(undefined, { k: 3, branch: 4 });
  assert.equal(typeof a.choosePlay, 'function');
  assert.equal(typeof a.chooseDiscard, 'function');
});
```

- [ ] **Step 2–4:** add to `src/agents.js` (add `smartDiscard` to the existing `sim.js` import line):

```javascript
import { lookaheadPlay } from './lookahead.js';
export function lookaheadAgent(shopPolicy = noShop, { k = 4, branch = 6 } = {}) {
  return makeAgent({ choosePlay: (run, w) => lookaheadPlay(run, w, { k, branch }), chooseDiscard: smartDiscard, chooseShop: shopPolicy });
}
```
Run, `npm test`.

- [ ] **Step 5: Commit** — `feat: harness v3 — lookaheadAgent factory`.

---

### Task 6: Pure statistics (`wilsonInterval`, `mcnemar`, `normalCI`)

**Files:**
- Create: `src/stats.js`
- Test: `test/stats.test.js`

**Interfaces — Produces:**
- `wilsonInterval(k, n, z = 1.96) -> { p, low, high }` — Wilson score interval for a binomial proportion. `n === 0 -> { p: 0, low: 0, high: 0 }`.
- `mcnemar(wonA, wonB) -> { b, c, z, p }` — paired test across the **same seeds**. `b` = count(A won & B lost), `c` = count(A lost & B won). Continuity-corrected normal approx: `z = (|b - c| - 1) / sqrt(b + c)` (0 when `b + c === 0`), two-sided `p`.
- `normalCI(values, z = 1.96) -> { mean, low, high }` — normal-approx CI for a mean (used for clear-margin).

- [ ] **Step 1: Write the failing tests** — create `test/stats.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { wilsonInterval, mcnemar, normalCI } from '../src/stats.js';

test('wilsonInterval brackets the point estimate and handles edges', () => {
  const w = wilsonInterval(60, 100);
  assert.equal(w.p, 0.6);
  assert.ok(w.low > 0.49 && w.high < 0.70);
  assert.deepEqual(wilsonInterval(0, 0), { p: 0, low: 0, high: 0 });
  const allWin = wilsonInterval(20, 20);
  assert.ok(allWin.high <= 1 && allWin.low < 1);
});

test('mcnemar measures paired disagreement', () => {
  const wonA = [true, true, true, true, false];
  const wonB = [false, false, false, true, false];
  const m = mcnemar(wonA, wonB);
  assert.equal(m.b, 3);
  assert.equal(m.c, 0);
  assert.ok(m.p < 0.5);
  const tie = mcnemar([true, false], [true, false]);
  assert.equal(tie.b + tie.c, 0);
  assert.equal(tie.p, 1);
});

test('normalCI brackets the mean', () => {
  const c = normalCI([10, 20, 30, 40, 50]);
  assert.equal(c.mean, 30);
  assert.ok(c.low < 30 && c.high > 30);
});
```

- [ ] **Step 2: Run, fail.**
- [ ] **Step 3: Implement `src/stats.js`:**

```javascript
// src/stats.js — pure, analytic statistics for the eval harness. No rng, deterministic.

// Standard normal CDF via the Abramowitz-Stegun erf approximation (max error ~1.5e-7).
function erf(x) {
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
function phi(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
function twoSidedP(z) { return 2 * (1 - phi(Math.abs(z))); }

export function wilsonInterval(k, n, z = 1.96) {
  if (n === 0) return { p: 0, low: 0, high: 0 };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return { p, low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

export function mcnemar(wonA, wonB) {
  let b = 0, c = 0;
  for (let i = 0; i < wonA.length; i++) {
    if (wonA[i] && !wonB[i]) b++;
    else if (!wonA[i] && wonB[i]) c++;
  }
  if (b + c === 0) return { b, c, z: 0, p: 1 };
  const z = (Math.abs(b - c) - 1) / Math.sqrt(b + c);
  return { b, c, z, p: twoSidedP(z) };
}

export function normalCI(values, z = 1.96) {
  const n = values.length;
  if (n === 0) return { mean: 0, low: 0, high: 0 };
  const mean = values.reduce((a, x) => a + x, 0) / n;
  const variance = values.reduce((a, x) => a + (x - mean) ** 2, 0) / Math.max(1, n - 1);
  const se = Math.sqrt(variance / n);
  return { mean, low: mean - z * se, high: mean + z * se };
}
```

- [ ] **Step 4: Run, pass; `npm test`.**
- [ ] **Step 5: Commit** — `git add src/stats.js test/stats.test.js && git commit -m "feat: harness v3 — pure stats (Wilson CI, McNemar, normal CI)"`

---

### Task 7: Clear-margin, decision-gap, and purchase-log diagnostics

**Files:** Modify `src/sim.js`, `src/shop.js` (additive log only), `test/sim.test.js`.
**Interfaces — Produces:**
- `simulateRun` result gains: `clearMargins: number[]` (per round played: `roundTotal - target` recorded at the moment the round ends — positive on a clear, negative on the failing round), `decisionGaps: number[]` (per play, **per-rack** policy-independent: `(top1 - top2) / max(top1, 1)` over the rack's legal plays), `purchaseLog: string[]`, `finalStacks: number`.
- `summarizePersona` gains: `clearMargin: { p10, p50, p90 }`, `decisionGap: { p50, p90, mean }`, `wonFlags: boolean[]` (per-seed, in seed order, for paired `mcnemar`).

> **Threshold discipline (revised):** earlier drafts labeled "no-brainer = gap ≥ 0.6". With `Score = Points × Mult`, a single ×Mult relic swings top1/top2 ratios wildly, so there is no validated anchor. We therefore **report the decision-gap distribution** (`p50`/`p90`) and let the author judge legibility, rather than emitting a calibrated-looking pass/fail. No hard cutoff is baked in.

- [ ] **Step 1: Failing tests** (append to `test/sim.test.js`):

```javascript
test('simulateRun records clear margins, decision gaps, a purchase log, and final stacks', () => {
  const r = simulateRun({ config: configB, dictionary: dictB, words: wordsB, seed: 1 });
  assert.ok(Array.isArray(r.clearMargins));
  assert.ok(Array.isArray(r.decisionGaps));
  assert.ok(Array.isArray(r.purchaseLog));
  assert.equal(typeof r.finalStacks, 'number');
});

test('summarizePersona aggregates margin + gap percentiles and exposes per-seed win flags', () => {
  const results = [
    { won: true,  roundReached: 8, deadRacks: 0, racksSeen: 10, clearMargins: [5, 3], decisionGaps: [0.7, 0.2], purchaseLog: [], finalStacks: 4 },
    { won: false, roundReached: 4, deadRacks: 1, racksSeen: 9,  clearMargins: [-12], decisionGaps: [0.9], purchaseLog: [], finalStacks: 0 },
  ];
  const s = summarizePersona(results);
  assert.deepEqual(s.wonFlags, [true, false]);
  assert.ok('clearMargin' in s && 'p50' in s.clearMargin);
  assert.ok('decisionGap' in s && 'p50' in s.decisionGap);
});
```

- [ ] **Step 2: Run, fail.**

- [ ] **Step 3a: Additive purchase log in `src/shop.js`.** At the top of `purchase(run, offer, opts = {})`, before any state change:

```javascript
if (run.purchaseLog) {
  run.purchaseLog.push(
    offer.type === 'buyRelic' ? `relic:${offer.relicId}`
    : offer.type === 'hone' ? `hone:${offer.archetypeId}`
    : offer.type
  );
}
```
(No behavior change when `run.purchaseLog` is undefined — the UI never sets it.)

- [ ] **Step 3b: Diagnostics in `src/sim.js` `simulateRun`.** Add a `topTwoGap` helper and extend the loop. The full revised loop body (pin the `clearMargins` push **inside** the `roundCleared` branch, before `nextRound`):

```javascript
// helper near bestPlay:
function topTwoGap(run, wordList) {
  const words = legalWords(run.rack.map(t => t.letter), wordList, run.config.MIN_WORD_LEN);
  const opts = scoringOpts(run);
  let top1 = -Infinity, top2 = -Infinity;
  for (const w of words) {
    const sel = selectionFor(w, run.rack);
    if (!sel) continue;
    const s = scoreWord(sel, opts).score;
    if (s > top1) { top2 = top1; top1 = s; } else if (s > top2) { top2 = s; }
  }
  if (top1 <= -Infinity) return null;       // no legal play
  if (top2 <= -Infinity) top2 = 0;          // only one option
  return (top1 - top2) / Math.max(top1, 1);
}
```

```javascript
// inside simulateRun, replacing the loop body from Task 2:
  const run = newRun({ config, dictionary, seed, deck });
  run.purchaseLog = [];
  const clearMargins = [], decisionGaps = [];
  let iter = 0, deadRacks = 0, racksSeen = 0;
  while (run.status === 'playing' && iter < cap) {
    iter++;
    const gap = topTwoGap(run, words);
    if (gap !== null) decisionGaps.push(gap);
    const play = A.choosePlay(run, words);
    if (play) {
      playWord(run, play.selection);
    } else if (run.discardsLeft > 0 && run.rack.length > 0) {
      discard(run, A.chooseDiscard(run));
    } else {
      break;
    }
    if (run.status !== 'roundCleared' && run.status !== 'won') {
      racksSeen += 1;
      if (!bestPlay(run, words)) deadRacks += 1;
    }
    if (run.status === 'roundCleared') {
      clearMargins.push(run.roundTotal - run.target);   // BEFORE nextRound resets target/roundTotal
      A.chooseShop(run);
      nextRound(run);
    }
  }
  if (run.status === 'playing') run.status = 'lost';
  if (run.status === 'lost') clearMargins.push(run.roundTotal - run.target); // failing-round margin (negative)
  const finalStacks = Object.values(run.relicState || {}).reduce((a, s) => a + (s.stacks || 0), 0);
  return {
    won: run.status === 'won', status: run.status, roundReached: run.roundIndex + 1, hitCap: iter >= cap,
    deadRacks, racksSeen, clearMargins, decisionGaps, purchaseLog: run.purchaseLog, finalStacks,
  };
```

- [ ] **Step 3c: Extend `summarizePersona` in `src/sim.js`** — add to the returned object:

```javascript
  const allMargins = results.flatMap(r => r.clearMargins || []);
  const allGaps = results.flatMap(r => r.decisionGaps || []);
  // ...inside the return, alongside the existing fields:
  wonFlags: results.map(r => r.won),
  clearMargin: { p10: percentile(allMargins, 10), p50: percentile(allMargins, 50), p90: percentile(allMargins, 90) },
  decisionGap: { p50: percentile(allGaps, 50), p90: percentile(allGaps, 90), mean: allGaps.length ? allGaps.reduce((a, b) => a + b, 0) / allGaps.length : 0 },
```
(Keep all existing `summarizePersona` fields. `percentile` already exists.)

- [ ] **Step 4: Run, pass; `npm test`.**
- [ ] **Step 5: Commit** — `git add src/sim.js src/shop.js test/sim.test.js && git commit -m "feat: harness v3 — clear-margin / decision-gap / purchase-log diagnostics"`

---

### Task 8: `runPersona` accepts a play-policy factory (`agentFor`)

> **Sequencing:** this is the prerequisite for the Task 9 instrument (it lets the same persona run under every rung of the ladder on the same seeds). It ships **before** the instrument.

**Files:** Modify `src/sim.js`, `test/sim.test.js`.
**Interfaces — Produces:** `runPersona({ config, dictionary, words, persona, seeds, pool, reserve, maxRerolls, discardPolicy, agentFor })` — when `agentFor(shopPolicy)` is given, the persona's deck + target relics are driven by `agentFor(buildPurchasePolicy(...))`. Back-compatible: with no `agentFor`, behavior is exactly today's greedy persona run.

- [ ] **Step 1: Failing test** (append to `test/sim.test.js`) — `runPersona` with an `agentFor` returning `randomAgent(shop)` returns `wonFlags` of length `seeds.length`, and (on a beatable fixture) a win-rate no higher than the default greedy persona on the same seeds:

```javascript
import { randomAgent } from '../src/agents.js'; // top-of-file
test('runPersona accepts an agentFor and reports per-seed win flags', () => {
  const persona = { id: 'shortWord', name: 'Short', bagId: 'standard', targetRelicIds: [], targetHoneId: 'shortWord' };
  const seeds = [1, 2, 3];
  const s = runPersona({ config: configB, dictionary: dictB, words: wordsB, persona, seeds, agentFor: (shop) => randomAgent(shop) });
  assert.equal(s.wonFlags.length, 3);
  assert.equal(typeof s.winRate, 'number');
});
```
(If `configB`'s `DECKS` lacks `standard`, the persona's `bagId: 'standard'` resolves to `config.STARTING_BAG` via the existing `runPersona` deck logic.)

- [ ] **Step 2–4:** in `runPersona`, build `const shop = buildPurchasePolicy({ targetRelicIds, targetHoneId, reserve, maxRerolls, pool });`, then `const agent = agentFor ? agentFor(shop) : null;`, and call `simulateRun({ config, dictionary, words, seed, deck, policy: shop, discardPolicy, agent })` (when `agent` is null the legacy greedy path runs). Run, `npm test`.
- [ ] **Step 5: Commit** — `feat: harness v3 — runPersona play-policy factory (ladder support)`.

---

### Task 9: `analyze-eval.js` — the skill-gradient instrument

**Files:** Create `scripts/analyze-eval.js`; Modify `package.json`. (Instrument — no unit tests; verified by running.)

Per persona, over `N` shared seeds, for each rung of the ladder {random, greedy, lookahead-k}, it prints: win-rate with **Wilson 95% CI**, round-reached p10/p50/p90, clear-margin p10/p50/p90, the **greedy→lookahead paired McNemar** (`b`/`c`/`p`), and the decision-gap p50/p90 (legibility, reported not thresholded).

> **Interpretation is author-judged, not auto-labeled.** The instrument reports the **win-rate deltas** `greedy − random` and `lookahead − greedy` with their CIs; it does not print "steep" / "flat" / "no-brainer" verdicts. A positive, CI-separated `lookahead − greedy` delta (and McNemar `p < 0.05`) is the evidence that skill has headroom; a near-zero gradient across the ladder is evidence the run is luck-dominated or decisions are trivial. The author reads the numbers.

> **Runtime budget (must be checked before scaling):** the lookahead rung does up to `branch^k` (default `6^4 ≈ 1296`) clones+enumerations per play decision, across 6 personas × N seeds × ~8 rounds × several plays. The lightweight `cloneRun` (Task 4) and the per-search `legalWords` memo keep each node cheap, but this is still the dominant cost. Run `--n=20` first and record wall-clock; if a full `--n=200` projects beyond a few minutes, lower the default to `k=3, branch=5` (exposed as `--k=`/`--branch=` flags) and/or reduce N, and `log` the reduction. Do not silently scale.

- [ ] **Step 1: add npm script** — `"analyze:eval": "node scripts/analyze-eval.js"`.
- [ ] **Step 2: Implement** `scripts/analyze-eval.js`:

```javascript
// scripts/analyze-eval.js — harness v3: skill-gradient instrument.
// Runs the policy ladder × personas × shared seeds on the real ENABLE list + CONFIG.
// Reports win-rate (Wilson CI), round + clear-margin percentiles, the paired greedy→lookahead
// McNemar p-value, and a decision-gap legibility distribution. REPORTS ONLY — no tuning applied.
// Run: npm run analyze:eval -- --n=200           (human tables)
//      npm run analyze:eval -- --n=200 --json     (machine-readable, for baseline diffing)
//      npm run analyze:eval -- --n=200 --k=3 --branch=5
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { makeDictionary } from '../src/dictionary.js';
import { PERSONAS, runPersona } from '../src/sim.js';
import { greedyAgent, randomAgent, lookaheadAgent } from '../src/agents.js';
import { wilsonInterval, mcnemar } from '../src/stats.js';
import { formatPct, toJSON } from '../src/report.js';

const raw = readFileSync(new URL('../assets/enable1.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const dictionary = makeDictionary(raw);
const words = raw.filter(w => w.length >= CONFIG.MIN_WORD_LEN && w.length <= CONFIG.RACK_SIZE).map(w => w.toUpperCase());

const arg = (name, def) => { const a = process.argv.find(x => x.startsWith(`--${name}=`)); return a ? Number(a.slice(name.length + 3)) : def; };
const json = process.argv.includes('--json');
const N = arg('n', 200), K = arg('k', 4), BRANCH = arg('branch', 6);
const seeds = Array.from({ length: N }, (_, i) => i + 1);

const LADDER = [
  { id: 'random',          agentFor: (shop) => randomAgent(shop) },
  { id: 'greedy',          agentFor: (shop) => greedyAgent(shop) },
  { id: `lookahead${K}`,   agentFor: (shop) => lookaheadAgent(shop, { k: K, branch: BRANCH }) },
];

const out = [];
for (const persona of PERSONAS) {
  const byRung = {};
  for (const rung of LADDER) byRung[rung.id] = runPersona({ config: CONFIG, dictionary, words, persona, seeds, agentFor: rung.agentFor });
  const g = byRung.greedy, l = byRung[`lookahead${K}`], r = byRung.random;
  out.push({
    persona: persona.name, byRung,
    skillGap: mcnemar(l.wonFlags, g.wonFlags),
    greedyOverRandom: g.winRate - r.winRate,
    lookaheadOverGreedy: l.winRate - g.winRate,
  });
}

if (json) {
  console.log(toJSON({ N, K, BRANCH, personas: out }));
} else {
  console.log(`\nLetter Ride — Harness v3: skill-gradient (${N} shared seeds; ladder random→greedy→lookahead${K}, branch ${BRANCH})\n`);
  for (const row of out) {
    console.log(`### ${row.persona}`);
    console.log('| Policy | Win rate (95% CI) | round p10/p50/p90 | clear-margin p10/p50/p90 | dead-rack% |');
    console.log('|---|---|---|---|---|');
    for (const rung of LADDER) {
      const s = row.byRung[rung.id];
      const ci = wilsonInterval(Math.round(s.winRate * N), N);
      const rr = s.roundReached, cm = s.clearMargin;
      console.log(`| ${rung.id} | ${formatPct(s.winRate)} [${formatPct(ci.low)}, ${formatPct(ci.high)}] | ${rr.p10}/${rr.p50}/${rr.p90} | ${cm.p10}/${cm.p50}/${cm.p90} | ${formatPct(s.deadRackRate, 2)} |`);
    }
    const dg = row.byRung.greedy.decisionGap;
    console.log(`gradient: greedy−random ${formatPct(row.greedyOverRandom)}, lookahead−greedy ${formatPct(row.lookaheadOverGreedy)} (McNemar p=${row.skillGap.p.toFixed(3)}, b=${row.skillGap.b}, c=${row.skillGap.c}); decision-gap p50/p90 ${dg.p50.toFixed(2)}/${dg.p90.toFixed(2)}\n`);
  }
  console.log('Read (author-judged): a positive, CI-separated lookahead−greedy delta with McNemar p<0.05 = skill has headroom.');
  console.log('A near-zero gradient across the ladder = luck-dominated or trivial decisions. High decision-gap p50 = one play usually dominates (legibility concern).');
  console.log('Limits: lookahead branches on top-N immediate-score plays (may miss low-now/high-later setups); shop policy is the simple target-buy; wild-substitution lands in Wave 2. REPORTS only.\n');
}
```

- [ ] **Step 3: Run it** — `npm run analyze:eval -- --n=20` first; record wall-clock. Then scale to `--n=200` only if runtime is acceptable (else drop to `--k=3 --branch=5` and/or lower N, and note it). Capture the full output verbatim. Flag: a flat gradient for any persona, any McNemar `p ≥ 0.05`, a high decision-gap p50.
- [ ] **Step 4: `npm test`** still green + `node --check scripts/analyze-eval.js src/*.js`.
- [ ] **Step 5: Commit** — `feat: harness v3 — skill-gradient instrument (analyze:eval)`.

> **Interpretation (author, after running — NOT acted on here):** the skill-vs-luck pillar is now directly measured. All tuning is a deferred author playtest call.

---

# Wave 2 — De-bias the numbers

### Task 10: Wild-aware enumeration (flip on, measure the delta)

**Files:** Modify `src/enumerate.js`, `src/sim.js` (header comment), `test/enumerate.test.js`. Re-run `analyze:eval` and `analyze:corpus` to capture the delta.
**Interfaces — Produces:** `canForm`/`selectionFor` become wild-aware: a `*` in the rack is a blank that can satisfy any one missing letter.

This **changes numbers** for `rareRich`/`wildcard` bags (it can only raise their playability), so it is a deliberate, measured flip. The Goal's "suspected bias" is *quantified* here; do not assert a magnitude before running.

- [ ] **Step 1: Failing tests** (append to `test/enumerate.test.js`):

```javascript
test('canForm treats * as a blank', () => {
  assert.equal(canForm('CAT', { C: 1, A: 1, '*': 1 }), true);
  assert.equal(canForm('CAT', { C: 1, '*': 1 }), false);
  assert.equal(canForm('AA', { A: 1, '*': 1 }), true);
});

test('selectionFor assigns a wild tile the needed letter', () => {
  const rack = [{ id: 't1', letter: 'C' }, { id: 't2', letter: 'A' }, { id: 't3', letter: '*' }];
  const sel = selectionFor('CAT', rack);
  assert.deepEqual(sel.map(s => s.letter), ['C', 'A', 'T']);
  assert.equal(sel.find(s => s.tile.id === 't3').letter, 'T');
});
```

- [ ] **Step 2: Run, fail.**
- [ ] **Step 3: Implement** the wild-aware `canForm`/`selectionFor` in `enumerate.js`:

```javascript
export function canForm(word, counts) {
  const have = { ...counts };
  let wilds = have['*'] || 0;
  for (const ch of word) {
    if ((have[ch] || 0) > 0) have[ch] -= 1;
    else if (wilds > 0) wilds -= 1;
    else return false;
  }
  return true;
}

export function selectionFor(word, rack) {
  const pool = [...rack];
  const sel = [];
  for (const ch of word) {
    let i = pool.findIndex(t => t.letter === ch);
    if (i < 0) i = pool.findIndex(t => t.letter === '*');
    if (i < 0) return null;
    sel.push({ tile: pool[i], letter: ch });
    pool.splice(i, 1);
  }
  return sel;
}
```
(`legalWords` unchanged: `max = letters.length` already counts wild tiles as usable slots.)

- [ ] **Step 4: Update the `src/sim.js` header comment** — the top-of-file block says "wilds ('*') treated as non-letters in enumeration." Change it to note enumeration is now wild-aware (`*` substitutes for any one missing letter).
- [ ] **Step 5: Run, pass; `npm test`.**
- [ ] **Step 6: Re-run instruments + capture deltas** — `npm run analyze:eval -- --n=200 --json > /tmp/eval-wild.json`; compare win-rates for `rareLetter`/`doubled` personas vs the pre-flip baseline (via `diffSummaries` or eyeball). Record the delta as a notes line in `docs/2026-06-23-letter-ride-empirical-findings.md` — not a tuning change.
- [ ] **Step 7: Commit** — `feat: harness v3 — wild-aware enumeration (quantify + remove the rare/wild bias)`.

---

# Deferred coverage (own just-in-time plans, gated on feature builds or out of §6 scope)

Roadmap features the harness must eventually test, but whose *engine* does not exist yet or which are out of the current harness scope. Each gets its own plan when ready. Listed as **interfaces + what-they-measure** so the v3 foundation accommodates them.

### D1 — Boss (archetype × boss) survivability matrix  *(blocked on bosses landing in the engine; see `2026-06-23-letter-ride-bosses-design.md`)*
- **Needs:** the engine's boss hook (disable→modified `tileValues`; cap/tax→post-score clamp in `playWord`; lock→`nextRound` setup). The eval consumes a `boss` descriptor per round.
- **Measures:** per (persona × boss), the win-rate **drop vs no-boss** on the same seeds (the boss should antagonize its target) and the **survivable floor** (the antagonized archetype must stay winnable with a skilled line — the binding "no dead archetype" rule). Output: a 6×4 matrix of win-rate deltas with Wilson CIs; a cell at ~0% for the antagonized archetype is a design failure.
- **Reuses:** the policy ladder (does *skill* let the antagonized build survive its boss?) and `mcnemar` (boss-on vs boss-off, paired seeds).

### D2 — Meta-progression pacing  *(blocked on Tier 2 meta system; see design.md §9)*
- **Needs:** the `MetaState` accrual + meta-shop unlock pool.
- **Measures:** simulate a *sequence* of runs per archetype, tracking Meta earned per run and unlock cadence. Targets: unlocks fast enough to reward, slow enough to stay meaningful; stake ladder beatable by the lookahead rung; loadout boosts not pushing win-rate to a trivial >~95%.
- **New instrument shape:** `analyze-meta.js` — N players × M sequential runs → meta-curve + unlock-time percentiles.

### D3 — Position-as-skill-lever  *(blocked on the author's open exploration; see CLAUDE.md scoring note + systems-bible D9)*
- **Needs:** a `chooseOrder` hook on the Agent and an ordering-aware scoring path.
- **Measures:** the **skill-ceiling lift from ordering** — the lookahead rung with vs without order optimization on the same seeds. Negligible gap ⇒ ordering adds complexity without depth (cut); large gap ⇒ a real lever (keep).

### D4 — Human-vocabulary policy  *(out of §6 scope; small JIT plan after the ladder proves valuable)*
- **What:** `withVocab(agent, vocabSet)` wrapping any agent so `choosePlay` only sees words in a committed common-English list (a 4th ladder rung: `greedy+humanVocab`). Tests the "success comes from economy, not vocabulary" pillar by measuring how far win-rates fall under realistic word knowledge (a large drop = builds secretly depend on obscure words).
- **Why deferred:** it adds a maintained word-list asset and a 4th rung (more runtime) beyond the empirical-findings §6 harness scope, on a personal prototype optimized for "fast on my phone." Commit the word list (do not depend on a live URL) and default the rung off when it lands.

### D5 — LLM-as-judge legibility proxy  *(off the deterministic path; author opt-in)*
- **What:** a temperature-0 rubric judge that, given a board (rack + relics + top plays), answers "is there a meaningful decision, or is one play dominant?" — a higher-fidelity successor to the `decisionGap` distribution (Task 7) for spot-checks.
- **Hard constraints:** non-deterministic; **never mixed into the seeded balance numbers**; runs as a separate offline track on sampled boards, framed as "candidates for the author to review." The "AI cannot judge fun" rule (CLAUDE.md) applies.

---

## Self-Review (plan author)

- **Evaluation-gap coverage:** single-policy confound → policy ladder (Tasks 2, 4, 5, 8, 9) + McNemar skill-gap (Tasks 6, 9); scaling-engine ranking faithfulness → shared `scoringOpts` with `relicState` (Task 4 Step 0) + `finalStacks` diagnostic (Task 7); outcome-only metrics → clear-margin + decision-gap (Task 7); no CIs/significance → `stats.js` (Task 6) surfaced in the instrument (Task 9); suspected wild bias → wild-aware enumerator with delta capture (Task 10); duplication/inconsistency → shared `enumerate.js` (Task 1); machine-readable diffing → `report.js` + `--json` (Tasks 3, 9). Bosses/meta/position/human-vocab/LLM-judge → §Deferred coverage.
- **Blockers fixed:** (1) `cloneRun` now deep-copies `relicState` (lightweight clone, Task 4) with an explicit isolation test; (2) the Task 2 test uses top-of-file static imports — no `await` in a non-async callback, no phantom `greedyAgentRunEquivalence`.
- **Sequencing fixed:** `runPersona({agentFor})` is now Task 8, **before** the Task 9 instrument that consumes it. No commit ships a non-runnable headline.
- **Type/signature consistency:** `Agent = {choosePlay, chooseDiscard, chooseShop}` from `makeAgent`/`greedyAgent`/`randomAgent`/`lookaheadAgent`, consumed by `simulateRun({agent})` and `runPersona({agentFor})`, tabulated by `analyze-eval.js`. `play = {word, selection, score}`. `summarizePersona` gains `wonFlags`/`clearMargin`/`decisionGap` exactly as the instrument reads them. `scoringOpts` is a single exported function used by `bestPlay`, `topTwoGap`, and lookahead → one ranking basis.
- **v1/v2 preserved:** `legalWords` re-exported (Task 1); `simulateRun` with no `agent` builds the greedy agent from legacy params (Task 2); `runPersona` greedy path unchanged when `agentFor` absent (Task 8). The one intentional v2-number shift is the declared `scoringOpts` accuracy fix (Task 4 Step 0) — captured, not tuned.
- **Engine edits minimized + declared:** additive `purchaseLog` push in `shop.js` and the `scoringOpts` accuracy fix in `sim.js` (both in Global Constraints). `scoring.js`/`run.js` core logic untouched; `cloneRun` is mid-round-only (documented) so the tile-id counter is never corrupted (verified: mid-round play mints no tiles). Determinism preserved (seeded `run.rng`; analytic stats; no `Math.random`).
- **Threshold discipline:** no hard "no-brainer" cutoff is baked in; the instrument reports decision-gap p50/p90 and win-rate gradient deltas with CIs for the author to judge (revised per review).
- **Reports only:** no `config.js`/`relics.js`/`archetypes.js` numbers change. Task 10 changes enumeration *semantics* (wild-aware) — flagged as a deliberate, measured de-bias with a delta-capture step. Honors CLAUDE.md "don't silently pick numbers / author owns balance."
- **Placeholder scan:** core/novel tasks (1, 2, 3, 4, 6, 7, 9, 10) carry complete code; Tasks 5, 8 give complete signatures + exact edits (house style for wiring tasks). The `makeLookaheadFixture()` is now specified concretely in Task 4 (no deferral); the strict-improvement-over-greedy proof is the empirical McNemar in Task 9, not a brittle hand-built trap.
