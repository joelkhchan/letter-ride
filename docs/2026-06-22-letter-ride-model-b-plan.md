# Model B Rack Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace Letter Ride's fresh-rack-every-play loop (Model A) with a **persistent hand, consume-and-draw** loop (Model B): you hold a hand, a played word consumes its tiles, the hand refills from a depleting draw-pile, unused tiles persist, and discard is selective.

**Architecture:** A new per-round **draw-pile** (`run.drawPile: Tile[]`) is built once per round from the canonical owned bag (`run.bag`, shuffled via the seeded RNG) and depletes as you draw. The canonical bag is unchanged — shop purchases still use `bag.add`/`bag.remove`; the draw-pile is separate, round-scoped state managed entirely in `run.js`. `bag.js` needs no change. Played/discarded tiles do **not** return to the pool until the round ends; each round rebuilds the pool from the full bag. **Shop→pool flow:** the shop runs *between* rounds, so a bought/enchanted tile mutates `run.bag`, and the next `nextRound → startRound` rebuilds the draw-pile from the updated bag — i.e. a purchase enters play next round. There is no mid-round shop, so the bag is immutable within a round and the draw-pile is the only depleting state.

**Tech Stack:** Vanilla JS ESM, `node --test`, no build step.

## Global Constraints

- **Determinism:** the draw-pile is shuffled with `shuffle(arr, run.rng)` from `src/rng.js` — **no `Math.random()`** in logic. (`shuffle` returns a new array; it does not mutate input or the bag.)
- **Scoring untouched:** this change does NOT modify `src/scoring.js`. `Score = Points × Mult` phase-ordered stays exactly as is. `playWord`'s scoring call is unchanged; only tile consumption + refill are added after it.
- **Scarcity pillar:** letters still come only from the bag (now even more so — the round depletes a pool).
- **Logic/UI split:** all rack/draw/discard rules live in `run.js` (pure, DOM-free, DI). `ui.js` only renders the hand and emits the selection; `main.js` wires events.
- **Hand size = `config.RACK_SIZE`** (currently 9). The hand refills *up to* RACK_SIZE; if the pool is short, the hand simply shrinks (no error).
- **Dead-hand rule (author-confirmed default):** after a play or discard, if `status === 'playing'` AND `discardsLeft === 0` AND no legal word is formable from the hand → `status = 'lost'`. If discards remain, a dead hand does **not** lose (you can discard). **Wild exception:** a hand containing any wild tile (`letter === '*'`) is **never** dead — a wild can stand in for any letter, and `dictionary.findWord` does literal matching so it cannot see wilds (`rareRich`, a wild-bearing deck, is unlocked on the first run, so this case is reachable day-one).
- **Round feasibility (watch-item for Phase 0c):** depletion + a losable dead-hand together can, in principle, strand a round (pool empties into an unspellable remnant). The intended invariant is **bag size ≫ RACK_SIZE + a few plays' worth of consumption** so a round stays survivable; whether depletion-into-deadhand feels too punishing with the real bag/RACK_SIZE/PLAYS numbers is a **named Phase 0c tuning watch-item**, not tuned here.
- **Schema bump:** persisting the draw-pile changes the save schema → `version: 2`. A `version !== 2` save loads as `null` (fresh start). At this dev stage that's acceptable — but note the rollback implication: **reverting Model B means wiping the active save** (a v2 save is unreadable by v1 code, and the v1 save is already gone). No precious save exists now, so this is fine; revisit if a real save needs to survive a revert.

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/run.js` | round-start draw-pile + dealing; `playWord` consume+refill; selective `discard`; dead-hand. | Modify |
| `src/bag.js` | canonical owned-tile set (draw/add/remove). | **No change** |
| `src/storage.js` | persist `drawPile`; schema v2. | Modify |
| `src/main.js` | drop Model-A `drawRack` calls; `onDiscard` passes selection. | Modify |
| `src/ui.js` | discard button emits the current tile selection; rack renders the persistent hand. | Modify |
| `test/run.test.js`, `test/storage.test.js` | new Model-B tests; storage v2 migration. | Modify |

---

### Task 1: Round-start draw-pile + persistent-hand dealing

**Files:** Modify `src/run.js`; Test `test/run.test.js`.
**Interfaces — Produces:**
- `startRound(run)` (exported) — sets `run.drawPile = shuffle([...run.bag.tiles], run.rng)`, clears `run.rack`, deals up to `RACK_SIZE`.
- `run.drawPile: Tile[]` — new per-round depleting state.
- `newRun(...)` and `nextRound(run)` now produce a dealt hand (engine-side, no UI deal needed).
- `drawRack(run)` is **kept permanently** as a thin alias to `startRound` (re-deals a fresh hand). Not removed — `test/storage.test.js` and the future eval harness call it, and the roadmap never asked to remove it. (During Tasks 1–5 `main.js` still calls it after `newRun`/`nextRound`, causing a harmless transient double-deal; Task 6 drops those redundant calls.)

- [ ] **Step 1: Write the failing tests** (append to `test/run.test.js`). Add a Model-B fixture (bag larger than the hand so depletion is observable):

```javascript
// --- Model B fixtures (bag > hand so the draw-pile is observable) ---
const dictB = makeDictionary(['cat', 'tab', 'bat', 'act']);
const configB = {
  STARTING_BAG: ['C','A','T','B','A','T'],          // 6 tiles
  TILE_VALUES: { C:3, A:1, T:1, B:3 },
  RACK_SIZE: 3, PLAYS_PER_ROUND: 4, DISCARDS_PER_ROUND: 2, MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 5, ROUND_TARGETS: [999, 999],   // high so plays don't auto-clear
};

test('newRun deals a full hand; the draw-pile holds the rest of the bag', () => {
  resetTileIds();
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  assert.equal(run.rack.length, 3);
  assert.equal(run.drawPile.length, 3);                       // 6 - 3
  const ids = new Set([...run.rack, ...run.drawPile].map(t => t.id));
  assert.equal(ids.size, 6);                                  // hand ∪ pool = full bag, no dupes
});

test('nextRound rebuilds the draw-pile from the full bag and deals a fresh hand', () => {
  resetTileIds();
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  run.status = 'roundCleared';
  run.drawPile = []; run.rack = [];                           // simulate a depleted round
  nextRound(run);
  assert.equal(run.rack.length, 3);
  assert.equal(run.drawPile.length, 3);                       // pool rebuilt from the 6-tile bag
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/run.test.js` — FAIL (`run.drawPile` undefined).

- [ ] **Step 3: Implement** in `src/run.js`:
  - Add to imports at top: `import { shuffle } from './rng.js';`
  - Add helpers + `startRound` (place above `newRun`):

```javascript
// Model B: fill the hand up to RACK_SIZE from the depleting draw-pile.
function refillHand(run) {
  const need = run.config.RACK_SIZE - run.rack.length;
  if (need > 0) run.rack.push(...run.drawPile.splice(0, need));
}

// Start a round: rebuild the depleting draw-pile from the full owned bag, deal a fresh hand.
export function startRound(run) {
  run.drawPile = shuffle([...run.bag.tiles], run.rng);
  run.rack = [];
  refillHand(run);
}

// Permanent thin alias: re-deal a fresh hand (used by storage.test.js + the eval harness).
export function drawRack(run) { startRound(run); return run.rack; }
```
  - In `newRun`, change the end so it builds the object, then deals. Replace `rack: [],` with `rack: [], drawPile: [],` and change the `return { ... };` to assign-then-deal:

```javascript
  const run = {
    config, dictionary,
    seed, rng: makeRng(seed),
    targets,
    roundIndex: 0,
    target: targets[0],
    roundTotal: 0,
    playsPerRound,
    discardsPerRound,
    playsLeft: playsPerRound + sumExtraPlays(startRelics),
    discardsLeft: discardsPerRound,
    bag: makeBag(letters.map(l => makeTile(l))),
    tileValues: { ...config.TILE_VALUES },
    relics: startRelics,
    coins: loadout.startCoins || 0,
    rack: [],
    drawPile: [],
    honeLevels: {},
    wordsPlayedThisRound: 0,
    stake, deck,
    status: 'playing',
  };
  startRound(run);
  return run;
```
  - In `nextRound`, add `startRound(run);` immediately before `return run;` (after `run.status = 'playing';`).

- [ ] **Step 4: Run to verify it passes** — `node --test test/run.test.js`, then `npm test` (the existing run tests use `seatCat` which overrides `run.rack`, so they still pass) — PASS.
- [ ] **Step 5: Commit** — `git add src/run.js test/run.test.js && git commit -m "feat: Model B round-start draw-pile + persistent-hand dealing"`

---

### Task 2: `playWord` consumes used tiles + refills the hand

**Files:** Modify `src/run.js`; Test `test/run.test.js`.
**Interfaces — Consumes:** `refillHand`, `run.drawPile` (Task 1). **Produces:** `playWord` now removes the played tiles from `run.rack` and refills from the draw-pile (depleting it).

- [ ] **Step 1: Write the failing tests** (append to `test/run.test.js`):

```javascript
test('playWord consumes the used tiles and refills the hand from the draw-pile', () => {
  resetTileIds();
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  const C = makeTile('C'), A = makeTile('A'), T = makeTile('T');
  const x = makeTile('B'), y = makeTile('A'), z = makeTile('T');
  run.rack = [C, A, T]; run.drawPile = [x, y, z];
  const res = playWord(run, [{tile:C,letter:'C'},{tile:A,letter:'A'},{tile:T,letter:'T'}]); // CAT
  assert.equal(res.ok, true);
  assert.deepEqual(run.rack.map(t => t.id), [x.id, y.id, z.id]);  // C,A,T consumed; refilled from pool
  assert.equal(run.drawPile.length, 0);                          // pool depleted
});

test('unused tiles persist across a play; empty pool just shrinks the hand', () => {
  resetTileIds();
  const run = newRun({ config: { ...configB, RACK_SIZE: 4 }, dictionary: dictB, seed: 1 });
  const C = makeTile('C'), A = makeTile('A'), T = makeTile('T'), B = makeTile('B');
  run.rack = [C, A, T, B]; run.drawPile = [];                     // empty pool → no refill
  playWord(run, [{tile:C,letter:'C'},{tile:A,letter:'A'},{tile:T,letter:'T'}]); // CAT, B unused
  assert.deepEqual(run.rack.map(t => t.id), [B.id]);             // B persists; no refill from empty pool
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/run.test.js` — FAIL (tiles not consumed).

- [ ] **Step 3: Implement** — in `src/run.js` `playWord`: these are three separate lines in the file (`run.js:78-80`):
```
  run.roundTotal += scored.score;
  run.wordsPlayedThisRound += 1;
  run.playsLeft -= 1;
```
  Immediately after the last of them (`run.playsLeft -= 1;`) and **before** the `if (run.roundTotal >= run.target)` status block, insert:

```javascript
  // Model B: consume the played tiles from the hand, then refill from the draw-pile.
  const usedIds = new Set(selection.map(s => s.tile.id));
  run.rack = run.rack.filter(t => !usedIds.has(t.id));
  refillHand(run);
```

- [ ] **Step 4: Run to verify it passes** — `node --test test/run.test.js`, then `npm test` (existing playWord tests assert score/status/coins, not hand contents → still green) — PASS.
- [ ] **Step 5: Commit** — `git add src/run.js test/run.test.js && git commit -m "feat: Model B playWord consumes tiles + refills hand"`

---

### Task 3: Selective `discard(run, selection)`

**Files:** Modify `src/run.js`; Test `test/run.test.js`.
**Interfaces — Produces:** `discard(run, selection)` — removes only the selected tiles from the hand, refills, costs one discard. `selection` is the same `[{tile, letter}]` shape `playWord` takes. (Old `discard(run)` full-reroll signature is replaced.)

- [ ] **Step 1: Write the failing tests** (append to `test/run.test.js`); import `discard`: change the import line to `import { newRun, playWord, discard, nextRound, awardCoins } from '../src/run.js';`

```javascript
test('discard removes only the selected tiles, refills, and costs one discard', () => {
  resetTileIds();
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  const C = makeTile('C'), A = makeTile('A'), T = makeTile('T');
  const x = makeTile('B'), y = makeTile('A');
  run.rack = [C, A, T]; run.drawPile = [x, y];
  const before = run.discardsLeft;
  discard(run, [{tile:A,letter:'A'}]);                          // drop only A
  assert.equal(run.discardsLeft, before - 1);
  assert.deepEqual(run.rack.map(t => t.id), [C.id, T.id, x.id]); // A gone; C,T kept; refilled with x
  assert.deepEqual(run.drawPile.map(t => t.id), [y.id]);
});

test('discard is a no-op with no discards left or an empty selection', () => {
  resetTileIds();
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  const before = run.rack.map(t => t.id);
  run.discardsLeft = 0;
  discard(run, [{ tile: run.rack[0], letter: run.rack[0].letter }]);
  assert.deepEqual(run.rack.map(t => t.id), before);            // no discards → unchanged
  run.discardsLeft = 1;
  discard(run, []);                                             // empty selection → no spend
  assert.equal(run.discardsLeft, 1);
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/run.test.js` — FAIL.

- [ ] **Step 3: Implement** — in `src/run.js`, replace the existing `discard` function entirely:

```javascript
export function discard(run, selection = []) {
  if (run.discardsLeft <= 0 || selection.length === 0) return run;
  run.discardsLeft -= 1;
  const dropIds = new Set(selection.map(s => s.tile.id));
  run.rack = run.rack.filter(t => !dropIds.has(t.id));
  refillHand(run);
  return run;
}
```

- [ ] **Step 4: Run to verify it passes** — `node --test test/run.test.js`, then `npm test` — PASS.
- [ ] **Step 5: Commit** — `git add src/run.js test/run.test.js && git commit -m "feat: Model B selective discard"`

---

### Task 4: Dead-hand rule

**Files:** Modify `src/run.js`; Test `test/run.test.js`.
**Interfaces — Produces:** after a play or discard, a `'playing'` run with no formable word and no discards becomes `'lost'`.

- [ ] **Step 1: Write the failing tests** (append to `test/run.test.js`):

```javascript
test('a play refilling into an unplayable hand with no discards loses', () => {
  resetTileIds();
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  run.discardsLeft = 0; run.target = 999;                       // don't clear by score
  const C = makeTile('C'), A = makeTile('A'), T = makeTile('T');
  run.rack = [C, A, T]; run.drawPile = [makeTile('X'), makeTile('Q'), makeTile('Z')]; // refill → unplayable
  const res = playWord(run, [{tile:C,letter:'C'},{tile:A,letter:'A'},{tile:T,letter:'T'}]);
  assert.equal(res.run.status, 'lost');                         // XQZ has no legal word, no discards
});

test('an unplayable hand does NOT lose while discards remain', () => {
  resetTileIds();
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  run.discardsLeft = 1; run.target = 999;
  const C = makeTile('C'), A = makeTile('A'), T = makeTile('T');
  run.rack = [C, A, T]; run.drawPile = [makeTile('X'), makeTile('Q'), makeTile('Z')];
  const res = playWord(run, [{tile:C,letter:'C'},{tile:A,letter:'A'},{tile:T,letter:'T'}]);
  assert.equal(res.run.status, 'playing');                      // can still discard out of it
});

test('a hand holding a wild is never dead, even with no discards', () => {
  resetTileIds();
  const run = newRun({ config: configB, dictionary: dictB, seed: 1 });
  run.discardsLeft = 0; run.target = 999;
  const C = makeTile('C'), A = makeTile('A'), T = makeTile('T');
  run.rack = [C, A, T];
  run.drawPile = [makeTile('*'), makeTile('Q'), makeTile('Z')];  // refill → hand holds a wild
  const res = playWord(run, [{tile:C,letter:'C'},{tile:A,letter:'A'},{tile:T,letter:'T'}]);
  assert.equal(res.run.status, 'playing');                      // wild rescues; no false loss
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/run.test.js` — FAIL (status `'playing'` in the first test; the wild test would FAIL without the wild guard).

- [ ] **Step 3: Implement** — in `src/run.js`, add the helper (below `refillHand`):

```javascript
// Dead-hand: a player's turn they can't act on — no legal word and no discard to escape with.
function checkDeadHand(run) {
  if (run.status !== 'playing' || run.discardsLeft > 0) return;
  // A wild ('*') can substitute for any letter, but dictionary.findWord matches literally and
  // can't see wilds — so a hand holding any wild is never declared dead (conservative: wild rescues).
  if (run.rack.some(t => t.letter === '*')) return;
  const word = run.dictionary.findWord(run.rack.map(t => t.letter), run.config.MIN_WORD_LEN);
  if (!word) run.status = 'lost';
}
```
  - In `playWord`, change the trailing status block's final branch to call it — replace `else if (run.playsLeft <= 0) run.status = 'lost';` with:

```javascript
  else if (run.playsLeft <= 0) run.status = 'lost';
  else checkDeadHand(run);
```
  - In `discard`, add `checkDeadHand(run);` immediately before `return run;`.

- [ ] **Step 4: Run to verify it passes** — `node --test test/run.test.js`, then `npm test` — PASS. (Existing tests either clear the round or lose on plays, so `checkDeadHand` — gated on `status==='playing'` — never fires for them.)
- [ ] **Step 5: Commit** — `git add src/run.js test/run.test.js && git commit -m "feat: Model B dead-hand rule"`

---

### Task 5: Persist the draw-pile (storage schema v2)

**Files:** Modify `src/storage.js`; Test `test/storage.test.js`.
**Interfaces — Produces:** `serializeRun` writes `drawPileIds` + `version: 2`; `deserializeRun` restores `run.drawPile`; `loadRun` treats `version !== 2` as no save.

- [ ] **Step 1: Write the failing test** — append to `test/storage.test.js`, **reusing the fixtures that file already defines** (`config` = 5-tile bag `['C','A','T','E','S']` with `RACK_SIZE: 3` → a draw-pile of 2 after dealing; `dict`; `fakeStorage()`; and the already-imported `newRun`, `serializeRun`, `deserializeRun`, `loadRun`, `resetTileIds`). Do **NOT** reference `configB`/`dictB` — those are module-scoped in `run.test.js` and are not in scope here.

```javascript
test('serialize/deserialize round-trips the draw-pile by id', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });   // 5-tile bag, RACK_SIZE 3 → drawPile length 2
  const ids = run.drawPile.map(t => t.id);
  assert.ok(ids.length >= 1, 'pool should hold the undealt tiles');
  const back = deserializeRun(serializeRun(run), { config, dictionary: dict });
  assert.deepEqual(back.drawPile.map(t => t.id), ids);
  const bagIds = new Set(back.bag.tiles.map(t => t.id));
  assert.ok(back.drawPile.every(t => bagIds.has(t.id)), 'pool tiles are the restored bag instances');
});

test('a version-1 save is treated as no save (fresh start)', () => {
  const s = fakeStorage();
  s.setItem('letterRide.run', JSON.stringify({ version: 1 }));
  assert.equal(loadRun(s, { config, dictionary: dict }), null);
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/storage.test.js` — FAIL.

- [ ] **Step 3: Implement** in `src/storage.js`:
  - `serializeRun`: change `version: 1,` → `version: 2,` and add after the `rackIds` line: `drawPileIds: run.drawPile.map(t => t.id),`
  - `deserializeRun`: add to the returned object (after `rack: ...`): `drawPile: (data.drawPileIds || []).map(id => byId.get(id)).filter(Boolean),`
  - `loadRun`: change `if (data.version !== 1) return null;` → `if (data.version !== 2) return null;`

- [ ] **Step 4: Run to verify it passes** — `node --test test/storage.test.js`, then `npm test`. If any existing storage test hard-codes `version: 1`, update it to `2` (it's the same round-trip behavior). — PASS.
- [ ] **Step 5: Commit** — `git add src/storage.js test/storage.test.js && git commit -m "feat: persist Model B draw-pile (storage schema v2)"`

---

### Task 6: Wire Model B into the UI — go live (manual-verify)

**Files:** Modify `src/main.js`, `src/ui.js`. (No new unit tests — UI is verified by `node --check` + a browser smoke. The engine is already covered by Tasks 1–5.) Note: `drawRack` is **kept** in `run.js` (permanent alias) — this task just stops `main.js` from calling it.

- [ ] **Step 1: `main.js` — stop dealing in the wiring** (the engine now deals): 
  - Remove `drawRack` from the import on line 4 (it's no longer called from `main.js`): `import { newRun, playWord, discard, nextRound } from './run.js';`
  - `startRun`: delete the `drawRack(run);` call (newRun already dealt). The line becomes `run = newRun({...}); view = 'run'; saveAll(); render();`
  - `onSubmit`: delete the trailing `if (run.status === 'playing') drawRack(run);` (playWord now consumes+refills). Keep the rest.
  - `onContinue`: delete `if (run.status === 'playing') drawRack(run);` (nextRound now deals).
- [ ] **Step 2: `main.js` — `onDiscard` forwards the selection:** change `onDiscard() { discard(run); saveAll(); render(); }` to `onDiscard(sel) { discard(run, sel); saveAll(); render(); }`.
- [ ] **Step 3: `ui.js` — discard emits the selection, and the button gates on it.** Read `ui.js` and make three changes (the discard handler currently *zeroes the selection before* invoking the callback, so it must be captured first):
  - The discard handler (currently `on('discard', () => { selection = []; handlers.onDiscard?.(); })`): capture the selection before clearing it, and pass it — `on('discard', () => { const sel = selection.slice(); selection = []; handlers.onDiscard?.(sel); })`.
  - The Discard button's `disabled` condition (currently `done || run.discardsLeft <= 0`): also disable when nothing is selected — `done || run.discardsLeft <= 0 || selection.length === 0`. (Selective discard with an empty selection is a no-op in the engine; the button must not look active when it would do nothing.)
  - Relabel the button to show the count, e.g. `` `Discard${selection.length ? ' (' + selection.length + ')' : ''}` `` so the player sees what will be swapped. (Button enablement/label re-evaluate on each `renderRun`, which already fires on tile tap.)
  - Confirm the rack renders `run.rack` (the persistent hand) — it already does; no other change.
- [ ] **Step 4: Verify** — `node --check src/run.js src/main.js src/ui.js`; confirm `main.js` no longer calls `drawRack` (`grep -n "drawRack" src/main.js` returns nothing — `drawRack` still exists in `run.js` and `test/storage.test.js`, which is expected). `npm test` — full suite green (drawRack-using storage tests still pass via the permanent alias).
- [ ] **Step 5: Browser smoke** (`npm run serve`): start a run; (a) play a word → **only the used tiles are replaced**, unused tiles stay; (b) with **nothing selected the Discard button is disabled**; select 1–2 tiles → it reads `Discard (N)` and discarding swaps **only those** and spends one discard; (c) clear a round → a fresh full hand next round. No console errors.
- [ ] **Step 6: Commit** — `git add src/main.js src/ui.js && git commit -m "feat: wire Model B persistent hand + selective discard into UI"`

---

## Self-Review (plan author)

- **Design coverage:** persistent hand + consume (Task 2); depleting draw-pile + per-round refill (Tasks 1–2); selective discard (Task 3); dead-hand incl. the **wild exception** (Task 4); persistence + v2 (Task 5); UI wiring + discard-button gating, incl. the discard-bug fix (Task 6). Bag depletion = the draw-pile splices and played/discarded tiles are filtered out of the hand without returning to the pool; the pool rebuilds only in `startRound` (round boundary). **Shop→pool flow** stated in Architecture (purchase mutates `run.bag`; next `startRound` rebuilds the pool; no mid-round bag mutation). **Feasibility** (depletion-into-deadhand) is stated as an invariant + handed to Phase 0c as a watch-item. ✓
- **Type/signature consistency:** `startRound(run)`, `refillHand(run)` (internal), `checkDeadHand(run)` (internal), `discard(run, selection)`, `drawRack(run)` (permanent alias), `run.drawPile`, `drawPileIds` used consistently across tasks. `selection` is `[{tile, letter}]` in `playWord`, `discard`, and the `ui.js` handler.
- **Determinism:** `shuffle(arr, run.rng)` only; no `Math.random`. Draw-pile depletes via `splice`; refill deterministic given the shuffle + RNG state. Persisted via `rngState` + `drawPileIds`.
- **No scoring change:** Task 2 inserts consume/refill *after* the unchanged `scoreWord` call; `scoring.js` untouched.
- **Intermediate states stay green/playable:** `drawRack` is kept as a permanent alias, so `main.js` keeps working (Model-A-ish, with a harmless transient double-deal) through Tasks 1–5; Model B goes live in Task 6. The unit suite validates Model B engine behavior in Tasks 1–4 independent of the UI.
- **Placeholder scan:** Tasks 1–5 have complete code (incl. the wild-tile test); Task 6 (UI) is spec'd against the real `ui.js` wiring (handler + button condition cited) with `node --check` + a concrete browser smoke, per the project's manual-UI-verify convention.
- **Per-file test-survival audit:** `test/run.test.js` — survives: uses `seatCat` (overrides `run.rack`) and asserts score/status/coins, not hand contents; new Model-B tests appended. `test/storage.test.js` — survives: keeps calling `drawRack` (now the permanent alias → re-deals, round-trip assertions still hold); gets the v2 + draw-pile tests (Task 5) using its own `config`/`dict`/`fakeStorage`. No existing test hard-codes `version: 1` (only `version: 999`/stale-version, which still → `null` under v2). No other test imports `drawRack` or calls `discard(run)` with the old no-arg signature.
