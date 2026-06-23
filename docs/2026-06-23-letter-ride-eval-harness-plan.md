# Eval Harness v1 (Simulated Player) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A headless full-run simulator (Phase 0b, lean v1) that drives the live Model B `run.js` loop with a simple "greedy best word" policy across many seeds, answering **"is Model B beatable, and how far does a competent-but-simple player get?"** — which de-risks the depletion-into-dead-hand / target-ladder feasibility watch-item.

**Architecture:** A new pure, dependency-injected logic module `src/sim.js` enumerates formable words from the current hand (`legalWords`), picks the highest-scoring legal play built from the **real** rack tiles (`bestPlay`), and drives a full run via the existing `run.js` (`simulateRun`). A dev instrument `scripts/analyze-sim.js` runs it over N seeds and prints win-rate + round-reached. `run.js`/`scoring.js` are NOT modified — the sim only drives and reads them.

**Tech Stack:** Vanilla JS ESM, `node --test`, no build step.

## Global Constraints

- **Determinism:** no `Math.random()` in `src/sim.js` — all randomness is the seeded RNG already inside `run` (created by `newRun` from `seed`). Same seed ⇒ same simulated run.
- **DI / logic-UI split:** `src/sim.js` is pure + DOM-free; `dictionary`, the word list, and `config` are passed in, never imported as globals. (It may import the pure functions `newRun`/`playWord`/`discard`/`nextRound` from `run.js`, `scoreWord` from `scoring.js`, and `honeModifiers` from `archetypes.js` — mirroring how `run.js` itself imports helpers.)
- **Do NOT modify `run.js` or `scoring.js`.** The sim drives the live Model B loop as-is.
- **Selections use REAL rack tiles:** a play's selection must be built from the actual `run.rack` tile instances (so `playWord`'s consume-by-id works) — NOT synthetic tiles.
- **v1 limitations (documented, not bugs):** (a) wild tiles (`'*'`) are treated as non-letters in enumeration — the greedy player can't spell *with* wilds yet (mirrors `analyze-builds.js`); (b) greedy "best single word" policy only; (c) no shop purchases (buys nothing); (d) standard deck only. **Per-archetype committer personas + shop-purchase policies + wild-substitution = v2.**
- **Timebox/fallback:** the must-have is the greedy "is it beatable + where do players die" answer. If v1 balloons, ship that; defer everything else to v2.

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/sim.js` | `legalWords`, `bestPlay`, `simulateRun` — pure full-run simulation. | Create |
| `scripts/analyze-sim.js` | dev instrument: run N seeds, print win-rate + round-reached. | Create |
| `package.json` | add `analyze:sim` script. | Modify |
| `test/sim.test.js` | unit tests for enumeration + the run driver. | Create |

---

### Task 1: `legalWords` + `bestPlay` (enumeration + scoring)

**Files:** Create `src/sim.js`, `test/sim.test.js`.
**Interfaces — Produces:**
- `legalWords(letters, wordList, minLen) -> string[]` — uppercase words from `wordList` formable from the `letters` multiset, with `minLen <= length <= letters.length`. (`wordList` is a pre-built array of UPPERCASE words; the caller filters it once for speed.)
- `bestPlay(run, wordList) -> { word, selection, score } | null` — the highest-scoring legal play from `run.rack`, with `selection` built from real rack tiles, scored exactly as `playWord` will (tileValues + lengthBonus + relics + honeModifiers + ctx).

- [ ] **Step 1: Write the failing tests**

```javascript
// test/sim.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { legalWords, bestPlay } from '../src/sim.js';
import { makeTile, resetTileIds } from '../src/tiles.js';

const WORDS = ['CAT', 'ACT', 'AT', 'CATS', 'DOG'];

test('legalWords returns words formable from the letters within [minLen, len]', () => {
  // letters C,A,T ; minLen 3 → CAT, ACT (AT too short; CATS needs S; DOG not formable)
  assert.deepEqual(legalWords(['C', 'A', 'T'], WORDS, 3).sort(), ['ACT', 'CAT']);
});

test('legalWords excludes words longer than the hand', () => {
  assert.deepEqual(legalWords(['C', 'A', 'T'], WORDS, 3).includes('CATS'), false);
});

test('bestPlay picks the highest-scoring legal play built from real rack tiles', () => {
  resetTileIds();
  const C = makeTile('C'), A = makeTile('A'), T = makeTile('T');
  // minimal run-like object: rack + the fields scoring reads
  const run = {
    rack: [C, A, T],
    tileValues: { C: 3, A: 1, T: 1 },
    relics: [], honeLevels: {}, wordsPlayedThisRound: 0,
    config: { MIN_WORD_LEN: 3, LENGTH_BONUS_PER_LETTER: 0 },
  };
  const play = bestPlay(run, WORDS);
  assert.ok(play, 'a play exists');
  assert.ok(['CAT', 'ACT'].includes(play.word));
  // selection tiles are the REAL rack instances (consume-by-id depends on this)
  const ids = play.selection.map(s => s.tile.id).sort();
  assert.deepEqual(ids, [C, A, T].map(t => t.id).sort());
  assert.equal(play.score, 5); // C3+A1+T1, mult 1, no length bonus
});

test('bestPlay returns null when nothing is formable', () => {
  resetTileIds();
  const run = {
    rack: [makeTile('X'), makeTile('Q'), makeTile('Z')],
    tileValues: { X: 8, Q: 10, Z: 10 }, relics: [], honeLevels: {}, wordsPlayedThisRound: 0,
    config: { MIN_WORD_LEN: 3, LENGTH_BONUS_PER_LETTER: 0 },
  };
  assert.equal(bestPlay(run, WORDS), null);
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/sim.test.js` — FAIL (module missing).

- [ ] **Step 3: Implement** `src/sim.js`:

```javascript
// src/sim.js — headless full-run simulator (Phase 0b eval harness v1). Pure + DI.
// Drives the live run.js Model B loop with a "greedy best word" policy.
// v1 limits (documented): wilds ('*') treated as non-letters in enumeration; greedy single-word
// policy; no shop purchases; standard deck. Personas/purchases/wild-substitution = v2.
// No Math.random — randomness is the seeded RNG inside `run`.
import { newRun, playWord, discard, nextRound } from './run.js';
import { scoreWord } from './scoring.js';
import { honeModifiers } from './archetypes.js';

function countsOf(letters) { const c = {}; for (const l of letters) c[l] = (c[l] || 0) + 1; return c; }
function canForm(word, counts) {
  const need = {};
  for (const ch of word) { need[ch] = (need[ch] || 0) + 1; if (need[ch] > (counts[ch] || 0)) return false; }
  return true;
}

export function legalWords(letters, wordList, minLen) {
  const c = countsOf(letters);
  const max = letters.length;
  return wordList.filter(w => w.length >= minLen && w.length <= max && canForm(w, c));
}

// Build a selection of REAL rack tiles for `word` (one tile per letter); null if rack can't supply it.
function selectionFor(word, rack) {
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

// Reconstruct the scoring options playWord will use, so we can rank candidate words faithfully.
function scoringOpts(run) {
  return {
    tileValues: run.tileValues,
    lengthBonusPerLetter: run.config.LENGTH_BONUS_PER_LETTER,
    relics: [...run.relics, ...honeModifiers(run.honeLevels)],
    context: {
      wordsPlayedThisRound: run.wordsPlayedThisRound,
      enablers: run.relics.filter(r => r.enabler).map(r => r.enabler),
    },
  };
}

export function bestPlay(run, wordList) {
  const words = legalWords(run.rack.map(t => t.letter), wordList, run.config.MIN_WORD_LEN);
  const opts = scoringOpts(run);
  let best = null, bestScore = -1;
  for (const w of words) {
    const selection = selectionFor(w, run.rack);
    if (!selection) continue;
    const score = scoreWord(selection, opts).score;
    if (score > bestScore) { bestScore = score; best = { word: w, selection, score }; }
  }
  return best;
}
```

- [ ] **Step 4: Run to verify it passes** — `node --test test/sim.test.js`, then `npm test` (137 prior + new) — PASS.
- [ ] **Step 5: Commit** — `git add src/sim.js test/sim.test.js && git commit -m "feat: eval harness v1 — legalWords + bestPlay"`

---

### Task 2: `simulateRun` (greedy run driver)

**Files:** Modify `src/sim.js`, `test/sim.test.js`.
**Interfaces — Consumes:** `bestPlay` (Task 1), `newRun`/`playWord`/`discard`/`nextRound` (run.js). **Produces:** `simulateRun({ config, dictionary, words, seed, deck=null, cap=1000 }) -> { won, status, roundReached, hitCap }` — drives one full run deterministically; greedy policy plays the best word, else discards the whole hand to redraw, else stops; `nextRound` on `roundCleared`; terminates on `won`/`lost`, an unactionable hand, or the iteration `cap`.

- [ ] **Step 1: Write the failing tests** (append to `test/sim.test.js`); import `simulateRun` and the dictionary:

```javascript
import { simulateRun } from '../src/sim.js';
import { makeDictionary } from '../src/dictionary.js';

const dictCat = makeDictionary(['cat']);
const wordsCat = ['CAT'];

test('simulateRun wins a winnable config', () => {
  // bag of 3×CAT so the pool refills each round; CAT (C3+A1+T1=5) clears target 3 twice → won
  const config = {
    STARTING_BAG: ['C','A','T','C','A','T','C','A','T'], TILE_VALUES: { C:3, A:1, T:1 },
    RACK_SIZE: 3, PLAYS_PER_ROUND: 2, DISCARDS_PER_ROUND: 1, MIN_WORD_LEN: 3,
    LENGTH_BONUS_PER_LETTER: 0, ROUND_TARGETS: [3, 3],
  };
  const r = simulateRun({ config, dictionary: dictCat, words: wordsCat, seed: 1 });
  assert.equal(r.won, true);
  assert.equal(r.status, 'won');
  assert.equal(r.roundReached, 2);     // both rounds cleared
  assert.equal(r.hitCap, false);
});

test('simulateRun loses an unwinnable config and terminates (no infinite loop)', () => {
  const config = {
    STARTING_BAG: ['C','A','T','C','A','T'], TILE_VALUES: { C:3, A:1, T:1 },
    RACK_SIZE: 3, PLAYS_PER_ROUND: 2, DISCARDS_PER_ROUND: 0, MIN_WORD_LEN: 3,
    LENGTH_BONUS_PER_LETTER: 0, ROUND_TARGETS: [99999],   // unreachable
  };
  const r = simulateRun({ config, dictionary: dictCat, words: wordsCat, seed: 1 });
  assert.equal(r.won, false);
  assert.equal(r.status, 'lost');
  assert.equal(r.roundReached, 1);
  assert.equal(r.hitCap, false);
});

test('simulateRun terminates when no word is ever formable', () => {
  // dict has a word the bag can never spell → greedy discards until dead-hand loses; must not hang
  const config = {
    STARTING_BAG: ['X','Q','Z','X','Q','Z'], TILE_VALUES: { X:8, Q:10, Z:10 },
    RACK_SIZE: 3, PLAYS_PER_ROUND: 2, DISCARDS_PER_ROUND: 2, MIN_WORD_LEN: 3,
    LENGTH_BONUS_PER_LETTER: 0, ROUND_TARGETS: [50],
  };
  const r = simulateRun({ config, dictionary: dictCat, words: wordsCat, seed: 1 });
  assert.equal(r.won, false);
  assert.equal(r.hitCap, false);       // terminated via dead-hand / exhaustion, not the cap
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/sim.test.js` — FAIL.

- [ ] **Step 3: Implement** — append to `src/sim.js`:

```javascript
// Drive one full run with the greedy "best word" policy. Deterministic given seed.
export function simulateRun({ config, dictionary, words, seed, deck = null, cap = 1000 }) {
  const run = newRun({ config, dictionary, seed, deck });
  let iter = 0;
  while (run.status === 'playing' && iter < cap) {
    iter++;
    const play = bestPlay(run, words);
    if (play) {
      playWord(run, play.selection);
    } else if (run.discardsLeft > 0 && run.rack.length > 0) {
      discard(run, run.rack.map(t => ({ tile: t, letter: t.letter })));   // dump the hand, redraw
    } else {
      break;   // unactionable: no word and no discard (engine dead-hand usually sets 'lost' first)
    }
    if (run.status === 'roundCleared') nextRound(run);
  }
  return {
    won: run.status === 'won',
    status: run.status,
    roundReached: run.roundIndex + 1,   // 1-based; equals ROUND_TARGETS.length on a win
    hitCap: iter >= cap,
  };
}
```

- [ ] **Step 4: Run to verify it passes** — `node --test test/sim.test.js`, then `npm test` — PASS.
- [ ] **Step 5: Commit** — `git add src/sim.js test/sim.test.js && git commit -m "feat: eval harness v1 — greedy simulateRun driver"`

---

### Task 3: `analyze-sim.js` dev instrument

**Files:** Create `scripts/analyze-sim.js`; Modify `package.json`.
**Interfaces — Consumes:** `simulateRun` (Task 2). No unit tests (it's an instrument, like `analyze-builds.js`) — verified by running it.

- [ ] **Step 1: add the npm script** — in `package.json` `scripts`, add (alongside the existing `analyze`): `"analyze:sim": "node scripts/analyze-sim.js"` (check the file for the exact existing format first; match it).

- [ ] **Step 2: Implement** `scripts/analyze-sim.js`:

```javascript
// scripts/analyze-sim.js — Phase 0b eval harness v1: greedy-player full-run simulation.
// Run: npm run analyze:sim   (real ENABLE list + CONFIG; prints win-rate + round-reached; no assertions)
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { makeDictionary } from '../src/dictionary.js';
import { simulateRun } from '../src/sim.js';

const raw = readFileSync(new URL('../assets/enable1.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const dictionary = makeDictionary(raw);
// Pre-filter once for speed: uppercase words in [MIN_WORD_LEN, RACK_SIZE] (longer words never fit the hand).
const words = raw.filter(w => w.length >= CONFIG.MIN_WORD_LEN && w.length <= CONFIG.RACK_SIZE).map(w => w.toUpperCase());

const N = 200;
const results = [];
for (let seed = 1; seed <= N; seed++) results.push(simulateRun({ config: CONFIG, dictionary, words, seed }));

const wins = results.filter(r => r.won).length;
const avgRound = (results.reduce((s, r) => s + r.roundReached, 0) / N).toFixed(2);
const capped = results.filter(r => r.hitCap).length;
const dist = {};
for (const r of results) dist[r.roundReached] = (dist[r.roundReached] || 0) + 1;

console.log(`\nLetter Ride — Model B greedy-player simulation (${N} seeds, standard deck)\n`);
console.log(`Win rate: ${wins}/${N} = ${(wins / N * 100).toFixed(1)}%`);
console.log(`Avg round reached: ${avgRound} / ${CONFIG.ROUND_TARGETS.length}`);
if (capped) console.log(`WARNING: ${capped} run(s) hit the iteration cap (possible stuck loop — investigate).`);
console.log('\nRound reached distribution:');
for (let r = 1; r <= CONFIG.ROUND_TARGETS.length; r++) console.log(`  Round ${r}: ${'#'.repeat(dist[r] || 0)} (${dist[r] || 0})`);
console.log('\nNote: greedy best-single-word policy, no shop purchases, wilds treated as non-letters (v1 limits).');
console.log('Per-archetype committer personas + purchase policies = v2.\n');
```

- [ ] **Step 3: Run it** — `npm run analyze:sim`. Capture the full output verbatim (win-rate, avg round, distribution). If it is noticeably slow (the enumeration is O(words) per play), note the runtime; N is tunable. If any run hits the cap, flag it.
- [ ] **Step 4: `npm test`** — confirm the suite is still green (the script isn't tested, but nothing should have broken). `node --check src/sim.js scripts/analyze-sim.js`.
- [ ] **Step 5: Commit** — `git add scripts/analyze-sim.js package.json && git commit -m "feat: eval harness v1 — analyze-sim greedy-player instrument"`

> **Interpretation (for the author, after running):** a very low win-rate (greedy player rarely clears the ladder) signals the Model B target ladder may be too steep under depletion (the feasibility watch-item) — a Phase 0c tuning input. A ~100% win-rate signals it may be too easy. The round-reached distribution shows where greedy players die. These are *signals*, not verdicts — the author's fun-judgment + (v2) per-archetype win rates are the real arbiters.

---

## Self-Review (plan author)

- **Goal coverage:** beatability + how-far → Task 2 (`simulateRun`) + Task 3 (win-rate/distribution). Enumeration + faithful scoring → Task 1. The depletion-feasibility watch-item → answered by the Task 3 win-rate on the standard deck.
- **Type/signature consistency:** `legalWords(letters, wordList, minLen)`, `bestPlay(run, wordList) -> {word, selection, score}|null`, `simulateRun({config, dictionary, words, seed, deck, cap}) -> {won, status, roundReached, hitCap}` — consistent across tasks; `selection` is `[{tile, letter}]` with REAL rack tiles (matches `playWord`/`discard`). `words` is an uppercase pre-filtered array everywhere (Task 1 tests, Task 2 driver, Task 3 harness all pass the same shape).
- **Determinism / DI:** no `Math.random` in `src/sim.js`; `config`/`dictionary`/`words` injected; `run.js`/`scoring.js` untouched (sim only drives/reads).
- **Termination:** `simulateRun` cannot infinite-loop — the `cap`, the `roundCleared`→`nextRound` advance, and the unactionable-hand `break` (empty rack or no word + no discards) all terminate; Task 2's third test asserts a never-formable config terminates without hitting the cap (engine dead-hand). `nextRound` on a win returns early (status `won`), exiting the `while`.
- **Lean / deferrals stated:** greedy-only, no purchases, standard deck, wilds-as-non-letters — all flagged as v1 limits with v2 carrying personas + purchases + wild substitution.
- **Placeholder scan:** Tasks 1–2 complete code; Task 3 complete instrument code + an explicit run/capture step (no assertions, by design, matching `analyze-builds.js`).
- **Perf note:** the word list is pre-filtered to `<= RACK_SIZE` once in the harness; `bestPlay` enumerates per play. If 200 seeds is slow, N is tunable — flagged in Task 3.
