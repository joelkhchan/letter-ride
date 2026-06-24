# Run Nodes + Events Implementation Plan (Phase 2, sub-project 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** After clearing each encounter, the player picks one node — the **Shop** or an **Event** (5 starter events, one a push-your-luck mini-game) — plus touch-friendly tap-to-reveal definitions for relics/mods/Hone/events.

**Architecture:** A new pure `src/events.js` (content + a seeded run-mutator + The Press state machine). On `roundCleared`, `run.js` picks the offered event from a SEPARATE seeded stream (no `run.rng` consumption -> no shop desync) into `run.nodeEventId`. `main.js` routes the node choice (Shop -> existing shop flow; Event -> resolve). `ui.js` renders the node choice, the event UIs, and the definitions popover. `scoring.js` + the boss/engine code are untouched.

**Tech Stack:** Vanilla JS ESM, `node --test`, no build step. Seeded RNG in `rng.js`.

## Global Constraints

- **`src/scoring.js`, `src/bosses.js`, and the boss/engine code in `run.js` (playWord/applyEncounterBoss) stay UNCHANGED.** This sub-project adds a node layer around the existing round flow.
- **Determinism:** the offered event is drawn from a separate seeded stream `makeRng((seed ^ 0x5bf03635 ^ roundIndex) >>> 0)` (a different constant than bossOrder's `0x9e3779b9`), so it does NOT consume `run.rng` and cannot desync the shop. Event resolution may draw from `run.rng` (only when the chosen event needs randomness). No `Math.random()` in logic.
- **Do NOT persist the shop** — it regenerates from RNG today (`main.js`). Persist only `run.nodeEventId` (string|null).
- **Schema:** at build time, READ the current `version` in `src/storage.js` (it is `4`) and bump to the next integer (`5`); update the loader guard. Do NOT trust this doc's number — verify against the file.
- **`applyEventOption` is a seeded run-mutator** (mutates `run`, draws from `run.rng`), NOT pure — like `playWord`. The harness does not cover events, so per-event unit tests are the only automated guard.
- DI + logic/UI split; tests inject tiny fixtures.

## File Structure

- `src/events.js` — **new.** `EVENTS` (5), `ALL_EVENT_IDS`, `applyEventOption(run, eventId, optionIndex)`, The Press helpers (`pressStart`/`pressDraw`/`pressBank`). Pure module (mutators take `run`).
- `src/run.js` — add `offerNode(run)` (sets `run.nodeEventId` on roundCleared) + call it where the shop is currently triggered; export it. (Modify — node layer only; do NOT touch playWord/boss code.)
- `src/storage.js` — serialize/deserialize `nodeEventId`; bump schema. (Modify.)
- `src/main.js` — route the node choice (Shop vs Event) + event handlers. (Modify.)
- `src/ui.js` — `renderNodeChoice`, event UIs (one-shot + The Press), tap-to-reveal definitions. (Modify.)
- `style.css` — node-choice + event + definitions-popover styling. (Modify.)
- Tests: `test/events.test.js` (new), `test/run.test.js`, `test/storage.test.js`.

---

### Task 1: `src/events.js` — the 4 one-shot events + `applyEventOption`

**Files:** Create `src/events.js`; create `test/events.test.js`.

**Interfaces — Produces:** `EVENTS` (map), `ALL_EVENT_IDS`, `applyEventOption(run, eventId, optionIndex)` (returns `{ ok, reason? }`; mutates run). Each event: `{ id, name, desc, interactive?, options: [{ label, apply(run) }], canOffer(run) }`.

- [ ] **Step 1: Write the failing test** (`test/events.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { EVENTS, ALL_EVENT_IDS, applyEventOption } from '../src/events.js';
import { newRun } from '../src/run.js';
import { makeDictionary } from '../src/dictionary.js';

const config = {
  STARTING_BAG: ['A','E','I','O','U','R','S','T','N','L','D','C','M','B','P','G','H','K','Y','F','W','V'],
  TILE_VALUES: { A:1,E:1,I:1,O:1,U:1,R:1,S:1,T:1,N:1,L:1,D:2,C:3,M:3,B:3,P:3,G:2,H:4,K:5,Y:4,F:4,W:4,V:4,J:8,X:8,Q:10,Z:10,'*':0 },
  RACK_SIZE: 9, PLAYS_PER_ROUND: 4, DISCARDS_PER_ROUND: 2, MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 5, ROUND_TARGETS: [9999,9999,9999], COINS_ON_CLEAR: null,
  HONE: { cost: 6 },
};
const dict = makeDictionary(['cat','cats']);

test('roster: 5 events incl. one interactive (The Press)', () => {
  assert.equal(ALL_EVENT_IDS.length, 5);
  const press = Object.values(EVENTS).find(e => e.interactive);
  assert.ok(press, 'one event is interactive');
});

test('Redaction removes a chosen tile set (free thinning)', () => {
  const run = newRun({ config, dictionary: dict, seed: 1 });
  const before = run.bag.tiles.length;
  // Redaction option apply should remove tiles; the exact targeting is via opts/UI — here assert bag shrinks.
  const id = Object.keys(EVENTS).find(k => /redact/i.test(EVENTS[k].name) || k === 'redaction');
  // apply the primary option with two target ids supplied via run.pendingTargets (UI sets these)
  run.pendingEventTargets = [run.bag.tiles[0].id, run.bag.tiles[1].id];
  applyEventOption(run, id, 0);
  assert.equal(run.bag.tiles.length, before - 2);
});

test('Ink Merchant canOffer is false when coins < 5', () => {
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.coins = 4;
  const id = Object.keys(EVENTS).find(k => k === 'inkMerchant' || /merchant/i.test(EVENTS[k].name));
  assert.equal(EVENTS[id].canOffer(run), false);
});
```

(Targeting note: events needing a player target — Redaction's tiles, Wordsmith's archetype — read from a `run.pending*` field the UI sets before `applyEventOption`, OR take an `opts` arg. Pick ONE convention and use it consistently; the test above assumes `run.pendingEventTargets`. Confirm against how `purchase(run, offer, opts)` passes `targetTileId` and mirror that style — prefer an `opts` arg: `applyEventOption(run, eventId, optionIndex, opts)`.)

- [ ] **Step 2: Run to verify it fails** — `node --test test/events.test.js` -> FAIL (module missing).

- [ ] **Step 3: Implement `src/events.js`** (the 4 one-shot events; The Press added in Task 2). Use the `owned`-relic filter pattern from `shop.js` for Ink Merchant. Each one-shot event:

```js
// src/events.js — run nodes: events are a between-encounter choice vs the Shop.
// One-shot events resolve on pick; The Press (Task 2) is interactive. Seeded mutators (draw from run.rng).
import { makeTile, WILD } from './tiles.js';
import { RELICS, ALL_RELIC_IDS } from './relics.js';
import { shuffle } from './rng.js';

// helper: pick N distinct random tiles from the bag via run.rng
function pickRandomTiles(run, n) {
  return shuffle([...run.bag.tiles], run.rng).slice(0, n);
}

export const EVENTS = {
  theBlank: {
    id: 'theBlank', name: 'The Blank',
    desc: 'Swap 3 random tiles in your bag for 1 Wild',
    options: [{ label: 'Swap 3 tiles for a Wild', apply: (run) => {
      const victims = pickRandomTiles(run, 3);
      for (const t of victims) run.bag.remove(t.id);
      run.bag.add(makeTile(WILD));
    } }],
    canOffer: (run) => run.bag.tiles.length > run.config.RACK_SIZE + 3,
  },
  wordsmith: {
    id: 'wordsmith', name: 'Wordsmith',
    desc: 'Gain a free Hone level for an archetype you choose',
    options: [{ label: 'Hone an archetype (free)', apply: (run, opts) => {
      const arch = opts?.archetypeId; if (!arch) return { ok: false, reason: 'no-target' };
      run.honeLevels[arch] = (run.honeLevels[arch] || 0) + 1;
    } }],
    canOffer: () => true,
  },
  redaction: {
    id: 'redaction', name: 'Redaction',
    desc: 'Remove 2 tiles of your choice from your bag',
    options: [{ label: 'Remove 2 tiles (free)', apply: (run, opts) => {
      const ids = opts?.tileIds || []; if (ids.length !== 2) return { ok: false, reason: 'need-2' };
      for (const id of ids) run.bag.remove(id);
    } }],
    canOffer: (run) => run.bag.tiles.length > run.config.RACK_SIZE + 2,
  },
  inkMerchant: {
    id: 'inkMerchant', name: 'Ink Merchant',
    desc: 'Pay $5: gain a random relic you do not own',
    options: [{ label: 'Pay $5 for a random relic', apply: (run) => {
      if (run.coins < 5) return { ok: false, reason: 'broke' };
      const owned = new Set(run.relics.map(r => r.id));
      const pool = ALL_RELIC_IDS.filter(id => !owned.has(id));
      if (!pool.length) return { ok: false, reason: 'all-owned' };
      const pick = shuffle(pool, run.rng)[0];
      run.coins -= 5;
      run.relics.push(RELICS[pick]);
    } }],
    canOffer: (run) => run.coins >= 5 && run.relics.length < ALL_RELIC_IDS.length,
  },
  // thePress added in Task 2
};

export const ALL_EVENT_IDS = Object.keys(EVENTS);

export function applyEventOption(run, eventId, optionIndex, opts = {}) {
  const ev = EVENTS[eventId]; if (!ev) return { ok: false, reason: 'unknown' };
  const opt = ev.options?.[optionIndex]; if (!opt) return { ok: false, reason: 'no-option' };
  const r = opt.apply(run, opts);
  return r && r.ok === false ? r : { ok: true };
}
```

(Update the test to pass `opts` (`{ tileIds: [...] }`, `{ archetypeId }`) instead of `run.pendingEventTargets` — match the `opts` convention above. Verify `bag.add`/`bag.remove` exist in `src/bag.js` before relying on them.)

- [ ] **Step 4: Run to verify it passes** — `node --test test/events.test.js` -> PASS.
- [ ] **Step 5: Full suite + commit** — `npm test`; then `git add src/events.js test/events.test.js && git commit -m "feat: events.js — 4 one-shot run-node events (Blank/Wordsmith/Redaction/Ink Merchant)"`

---

### Task 2: The Press (interactive push-your-luck) in `src/events.js`

**Files:** Modify `src/events.js`; append `test/events.test.js`.

**Interfaces — Produces:** `EVENTS.thePress` (with `interactive: true`), and a small state machine: `pressStart(run)` -> `run.press = { drawn: [], pot: 0, busted: false, banked: false }`; `pressDraw(run)` (draw a letter via `run.rng`; if already in `drawn` -> bust; else pot += tileValue, push letter); `pressBank(run)` (coins += pot if not busted; clears state).

- [ ] **Step 1: Write failing tests**

```js
import { pressStart, pressDraw, pressBank, EVENTS } from '../src/events.js';

test('The Press: pot grows on unique draws, busts on a duplicate, bank pays the pot', () => {
  assert.equal(EVENTS.thePress.interactive, true);
  // deterministic via seeded run.rng — drive draws and assert the invariants, not exact letters
  const run = newRun({ config, dictionary: dict, seed: 2 });
  pressStart(run);
  assert.deepEqual(run.press, { drawn: [], pot: 0, busted: false, banked: false });
  pressDraw(run);
  assert.equal(run.press.drawn.length, 1);
  assert.ok(run.press.pot >= 1);                       // first letter's value
  // force a duplicate to prove the bust path:
  const dup = run.press.drawn[0];
  run.press.forcedNext = dup;                           // test hook (see impl note)
  pressDraw(run);
  assert.equal(run.press.busted, true);
  const coinsBefore = run.coins;
  pressBank(run);                                        // busted -> pays nothing
  assert.equal(run.coins, coinsBefore);
});
```

- [ ] **Step 2: Run -> FAIL.**
- [ ] **Step 3: Implement** in `src/events.js`:

```js
import { LETTERS_FOR_DRAW } from './tiles.js';   // OR derive from Object.keys(tileValues) minus '*'

export function pressStart(run) { run.press = { drawn: [], pot: 0, busted: false, banked: false }; }

export function pressDraw(run) {
  const st = run.press; if (!st || st.busted || st.banked) return st;
  const pool = Object.keys(run.tileValues).filter(l => l !== '*');
  // test hook: st.forcedNext lets a test force a specific letter; otherwise seeded draw
  const letter = st.forcedNext || shuffle([...pool], run.rng)[0];
  st.forcedNext = null;
  if (st.drawn.includes(letter)) { st.busted = true; st.pot = 0; return st; }
  st.drawn.push(letter);
  st.pot += run.tileValues[letter] || 0;
  return st;
}

export function pressBank(run) {
  const st = run.press; if (!st || st.busted) { run.press = null; return run; }
  run.coins += st.pot; run.press = null; return run;
}

export const EVENTS_THE_PRESS = {
  thePress: {
    id: 'thePress', name: 'The Press', interactive: true,
    desc: 'Draw letters for $; Bank or Press; bust on a repeat',
    canOffer: () => true,
  },
};
// merge into EVENTS:
Object.assign(EVENTS, EVENTS_THE_PRESS);
```

(Confirm the cleanest way to expose the draw pool; the `forcedNext` test hook is acceptable for determinism testing. Adjust if a cleaner seam exists.)

- [ ] **Step 4: Run -> PASS. Step 5: Full suite + commit** — `git commit -m "feat: The Press — interactive push-your-luck run-node event"`

---

### Task 3: Node-offer logic in `src/run.js`

**Files:** Modify `src/run.js`; append `test/run.test.js`.

**Interfaces — Produces:** `offerNode(run)` sets `run.nodeEventId` (a seeded-stream pick from the events whose `canOffer(run)` is true, or null if none); exported. Called wherever the round is cleared. Do NOT touch playWord/boss code.

- [ ] **Step 1: failing test** — `offerNode(run)` sets `run.nodeEventId` to a valid event id deterministically (same seed+roundIndex -> same offer), and respects `canOffer` (e.g. with `coins < 5` and a full bag, Ink Merchant is excluded).
- [ ] **Step 2: FAIL. Step 3: implement** in `run.js`:

```js
import { EVENTS, ALL_EVENT_IDS } from './events.js';
import { makeRng, shuffle } from './rng.js';   // makeRng already imported

export function offerNode(run) {
  const stream = makeRng((run.seed ^ 0x5bf03635 ^ run.roundIndex) >>> 0);   // separate stream, not run.rng
  const eligible = ALL_EVENT_IDS.filter(id => EVENTS[id].canOffer(run));
  run.nodeEventId = eligible.length ? shuffle(eligible, stream)[0] : null;
}
```

Add `nodeEventId: null` to the `newRun` run object. Decide the call site: the cleanest is for `main.js` to call `offerNode(run)` when it detects `roundCleared` (alongside today's shop generation), so the engine/harness path is untouched. (The harness never calls offerNode -> sim is unaffected. Confirm this placement keeps `simulateRun` clean.)

- [ ] **Step 4: PASS. Step 5: full suite + commit** — `git commit -m "feat: offerNode — seeded node-event offer on roundCleared"`

---

### Task 4: Persist `nodeEventId` (schema bump)

**Files:** Modify `src/storage.js`; append `test/storage.test.js`.

- [ ] **Step 1: failing test** — round-trip `nodeEventId`; `version` is the bumped integer.
- [ ] **Step 2: FAIL. Step 3:** READ the current `version` in `storage.js` (it is `4`), bump to `5`; add `nodeEventId: run.nodeEventId ?? null` to serialize, `nodeEventId: data.nodeEventId ?? null` to deserialize; update `loadRun` guard to `!== 5`.
- [ ] **Step 4: PASS. Step 5: commit** — `git commit -m "feat: persist nodeEventId; bump save schema 4->5"`

---

### Task 5: `main.js` — route the node choice

**Files:** Modify `src/main.js`.

Read the current `roundCleared`/shop flow first (`onSubmit` generates `run.shop` on roundCleared; `onContinue` does `run.shop = null; nextRound`). Change: on roundCleared, call `offerNode(run)` and present the NODE CHOICE (not the auto-shop). Add handlers via `bindControls`:
- `onPickShop()` — `run.shop = generateShop(run, run.rng, pool()); recordOffers(...)`; render the shop (existing flow).
- `onPickEvent()` — resolve the offered event `EVENTS[run.nodeEventId]`: if one-shot, the UI collects any target (`opts`) then calls `applyEventOption`; if interactive (The Press), `pressStart` + show the loop.
- `onPressDraw()` / `onPressBank()` — call `pressDraw`/`pressBank`, render.
- After the node resolves (shop continue OR event done), `onContinue` clears node state (`run.nodeEventId = null; run.press = null; run.shop = null`) and `nextRound`.

**Constraint:** keep the boss/engine paths untouched; the node layer wraps the existing roundCleared->shop->continue flow. Browser-verified (no unit test for main.js).

- [ ] Implement; `npm test` (expect green, 187+); commit `feat: main.js routes the Shop-vs-Event node choice + event handlers`.

---

### Task 6: `ui.js` — node-choice + event UIs

**Files:** Modify `src/ui.js`, `style.css`.

Read `renderRun`/`renderShop` first. Add:
- `renderNodeChoice(run)` — two cards: **Shop** (-> onPickShop) and **Event: <name>** with the event `desc` (-> onPickEvent). Shown on roundCleared instead of the auto-shop.
- One-shot event UI — show the event name/desc + its option button(s); for Redaction, a tile-picker (reuse the bag/tile rendering, select 2); for Wordsmith, an archetype picker. On confirm, emit the option + opts.
- The Press UI — show drawn letters + the running pot + **Draw/Press** and **Bank** buttons; on bust, show the bust + a continue. Wire to onPressDraw/onPressBank.
- Each event option label states its concrete effect (legibility). No emoji.
- ui.js stays render-only (no game logic; call the run/events functions via handlers).

- [ ] Implement; browser-smoke is the controller's gate; commit `feat: UI for node choice + event resolution (one-shot + The Press)`.

---

### Task 7: `ui.js` — tap-to-reveal definitions (relics / mods / Hone / events)

**Files:** Modify `src/ui.js`, `style.css`.

Today relic/mod/Hone descs surface only via `title=` hover tooltips (don't fire on touch). Add a **tap-to-reveal** popover: tapping a relic/mod/Hone chip (in `relicsModsPanelHtml` + shop offers) shows its `desc` inline/popover; same for the offered event. Reuse existing `desc` fields (`RELICS[id].desc`, `getMod(id).desc`, `ARCHETYPES[id].desc`). Keep it touch-first (click/tap, not hover).

- [ ] Implement; browser-smoke; commit `feat: tap-to-reveal definitions for relics/mods/Hone (touch-friendly)`.

---

### Task 8: Harness check

**Files:** none expected.

- [ ] Run `npm run analyze:sim-v2`. Confirm it still completes (the node layer must NOT break the sim: `simulateRun` advances via `policy(run); nextRound(run)` and never calls `offerNode`, so the bot effectively always "picks Shop"). Capture the table; if the sim throws because the roundCleared flow changed, fix `sim.js` minimally + add a test, else no change. Report.

---

## Self-Review notes
- Spec coverage: N1 node choice = T5/T6; N2 fold forge/hone = no-op (shop unchanged); N3 events = T1/T2; N6/N7 persistence + seeded offer = T3/T4; N8 definitions = T6/T7; N5 harness = T8; N9 success criterion = author play.
- `scoring.js`/`bosses.js`/playWord/boss code UNCHANGED across all tasks.
- Determinism: offered event from a separate seeded stream (distinct constant from bossOrder); event resolution draws from run.rng only on the chosen event.
- Schema: verify current version against storage.js (it's 4 -> 5), don't trust the doc.
- Type consistency: `run.nodeEventId` string|null; `EVENTS[id]` the object; `applyEventOption(run, id, optIndex, opts)`; The Press state on `run.press`.
