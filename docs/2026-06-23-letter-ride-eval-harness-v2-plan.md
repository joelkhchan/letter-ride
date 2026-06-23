# Eval Harness v2 (Skill-vs-Luck Instrument) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Extend the eval harness so it can measure *skilled* play: add a pluggable shop-purchase policy, per-archetype personas, and **p10/p50/p90 variance + win-rate reporting** — the literal instrument for the skill-vs-luck design rule. Built to `docs/2026-06-23-letter-ride-empirical-findings.md` §6.

**Architecture:** Extend the existing pure module `src/sim.js` (v1: `legalWords`/`bestPlay`/`simulateRun` greedy — keep it working). Add a purchase policy that drives the real `shop.js` (`generateShop`→`purchase`→reroll) toward a target archetype, an optional `policy` + `pool` on `simulateRun`'s shop loop, pure percentile/aggregation helpers, per-archetype personas, and a `runPersona` aggregator. A new dev instrument `scripts/analyze-sim-v2.js` runs all personas across N seeds and prints the table. **This harness only REPORTS — it changes no config/balance numbers (tuning is a deferred author playtest call).**

**Tech Stack:** Vanilla JS ESM, `node --test`, no build step.

## Global Constraints

- **Determinism:** no `Math.random()` in `src/sim.js`; all randomness is `run.rng` (seeded), which `generateShop` already uses. Percentile math is pure. Same seed ⇒ same run.
- **DI / logic-UI split:** `src/sim.js` stays pure + DOM-free; `config`/`dictionary`/`words`/`pool`/`policy` are injected.
- **Do NOT modify `run.js`, `scoring.js`, or `shop.js`.** The sim only drives + reads them (imports `generateShop`/`purchase` from `shop.js`, like it imports `playWord` etc. from `run.js`).
- **Keep v1 working:** `legalWords`/`bestPlay`/`simulateRun` (greedy, no policy) must still pass. v2 *extends* — `simulateRun` gains an optional `policy`/`pool`; with no policy it behaves exactly as v1 (no shopping).
- **Shop reality (verified in `shop.js`):** `generateShop(run, run.rng, pool={relicIds,modIds})` → `{offers, rerollCost}`; offers are shuffled + sliced to `offersPerShop`. `pool` defaults to ALL_RELIC_IDS/ALL_MOD_IDS — the sim passes `{}` (everything unlocked) so personas can buy their archetype relics. `purchase(run, offer, {targetTileId})` deducts `run.coins`; `buyRelic` does `run.relics.push(RELICS[id])` with **no dedup**; `hone` increments `run.honeLevels`. The real UI regenerates the shop after each buy — the policy mirrors that.
- **Author-decision boundary:** v2 produces numbers; it does not pick tuning values, add a vowel floor, or touch the scarcity pillar / position-lever (those are deferred author calls).

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/sim.js` | + `pickTargetOffer`, `buildPurchasePolicy`, `noShop`; `simulateRun` policy/pool/dead-rack; `percentile`, `summarizePersona`; `PERSONAS`, `runPersona`. | Modify |
| `scripts/analyze-sim-v2.js` | dev instrument: all personas × N seeds → table. | Create |
| `package.json` | add `analyze:sim-v2`. | Modify |
| `test/sim.test.js` | unit tests for the new pure helpers + policy + persona aggregation. | Modify |

---

### Task 1: Purchase policy (`pickTargetOffer` + `buildPurchasePolicy`)

**Files:** Modify `src/sim.js`, `test/sim.test.js`.
**Interfaces — Produces:**
- `pickTargetOffer(run, { targetRelicIds, targetHoneId, reserve }) -> offer | null` — pure pick from `run.shop.offers`: the first affordable (keeps `run.coins - cost >= reserve`) **un-owned** target `buyRelic`, else the target `hone`, else `null`.
- `buildPurchasePolicy({ targetRelicIds, targetHoneId, reserve=0, maxRerolls=3, pool={} }) -> shop(run)` — drives the real shop: buy advancing offers (regenerating the shop after each buy, mirroring the UI), reroll up to `maxRerolls` when nothing relevant is affordable, then clear `run.shop`.
- `noShop = () => {}` — the v1 "buys nothing" policy.

- [ ] **Step 1: Write the failing tests** (append to `test/sim.test.js`; import the new names):

```javascript
import { pickTargetOffer, buildPurchasePolicy } from '../src/sim.js';

test('pickTargetOffer prefers an affordable un-owned target relic, respecting reserve', () => {
  const run = {
    coins: 10, relics: [],
    shop: { offers: [
      { type: 'buyLetter', letter: 'E', cost: 3 },
      { type: 'buyRelic', relicId: 'rareHoarder', cost: 6 },
      { type: 'hone', archetypeId: 'rareLetter', cost: 6 },
    ] },
  };
  const off = pickTargetOffer(run, { targetRelicIds: ['rareHoarder'], targetHoneId: 'rareLetter', reserve: 0 });
  assert.equal(off.type, 'buyRelic');
  assert.equal(off.relicId, 'rareHoarder');
});

test('pickTargetOffer skips an already-owned relic and falls back to the target hone', () => {
  const run = {
    coins: 10, relics: [{ id: 'rareHoarder' }],
    shop: { offers: [
      { type: 'buyRelic', relicId: 'rareHoarder', cost: 6 },
      { type: 'hone', archetypeId: 'rareLetter', cost: 6 },
    ] },
  };
  const off = pickTargetOffer(run, { targetRelicIds: ['rareHoarder'], targetHoneId: 'rareLetter', reserve: 0 });
  assert.equal(off.type, 'hone');
});

test('pickTargetOffer returns null when nothing affordable stays above reserve', () => {
  const run = { coins: 8, relics: [], shop: { offers: [{ type: 'buyRelic', relicId: 'rareHoarder', cost: 6 }] } };
  assert.equal(pickTargetOffer(run, { targetRelicIds: ['rareHoarder'], reserve: 5 }), null); // 8-6=2 < 5
});

test('buildPurchasePolicy spends toward the target on a real run (buys and/or rerolls)', () => {
  resetTileIds();
  // CONFIG-like tiny config with a SHOP block; reuse the project CONFIG in the instrument,
  // here use a minimal config whose SHOP offers buyRelic. (See brief for the exact fixture.)
  const run = newRun({ config: configShop, dictionary: dictCat, seed: 7 });
  run.coins = 999;
  buildPurchasePolicy({ targetRelicIds: ['vowelBonus'], targetHoneId: 'vowelHeavy', maxRerolls: 5 })(run);
  assert.ok(run.coins < 999, 'policy spent coins (bought and/or rerolled)');
  assert.equal(run.shop, null, 'shop cleared after the turn');
});
```
(The brief provides `configShop` — a small config with a real `SHOP` block + `HONE` — and reuses `newRun`/`resetTileIds`/`dictCat` already imported in the test file.)

- [ ] **Step 2: Run to verify it fails** — `node --test test/sim.test.js` — FAIL.

- [ ] **Step 3: Implement** — in `src/sim.js`, add the shop import + the policy:

```javascript
import { generateShop, purchase } from './shop.js';

// Pure: choose the best advancing offer from run.shop, or null.
// Priority: an affordable, un-owned target relic; then the target hone. Keeps coins >= reserve.
export function pickTargetOffer(run, { targetRelicIds = [], targetHoneId = null, reserve = 0 }) {
  const offers = (run.shop && run.shop.offers) || [];
  const owned = new Set(run.relics.map(r => r.id));
  const affordable = (o) => run.coins - o.cost >= reserve;
  const relic = offers.find(o => o.type === 'buyRelic' && targetRelicIds.includes(o.relicId) && !owned.has(o.relicId) && affordable(o));
  if (relic) return relic;
  const hone = offers.find(o => o.type === 'hone' && o.archetypeId === targetHoneId && affordable(o));
  if (hone) return hone;
  return null;
}

// A shop policy: each shop turn, buy advancing offers (regenerating the shop after each buy,
// as the UI does), reroll up to maxRerolls when nothing relevant is affordable, then stop.
export function buildPurchasePolicy({ targetRelicIds = [], targetHoneId = null, reserve = 0, maxRerolls = 3, pool = {} } = {}) {
  const opts = { targetRelicIds, targetHoneId, reserve };
  return function shop(run) {
    run.shop = generateShop(run, run.rng, pool);
    let rerolls = 0;
    for (;;) {
      const offer = pickTargetOffer(run, opts);
      if (offer) { purchase(run, offer); run.shop = generateShop(run, run.rng, pool); continue; }
      const rc = run.shop.rerollCost;
      if (rerolls < maxRerolls && run.coins - rc >= reserve) {
        run.coins -= rc; rerolls += 1; run.shop = generateShop(run, run.rng, pool); continue;
      }
      break;
    }
    run.shop = null;
  };
}

// v1 default: no shopping.
export const noShop = () => {};
```

- [ ] **Step 4: Run to verify it passes** — `node --test test/sim.test.js`, then `npm test` (was 146) — PASS.
- [ ] **Step 5: Commit** — `git add src/sim.js test/sim.test.js && git commit -m "feat: harness v2 — pluggable purchase policy"`

---

### Task 2: `simulateRun` shop loop + dead-rack-after-thin counter

**Files:** Modify `src/sim.js`, `test/sim.test.js`.
**Interfaces — Consumes:** `buildPurchasePolicy`/`noShop` (Task 1). **Produces:** `simulateRun({config, dictionary, words, seed, deck, cap, policy})` — on `roundCleared`, runs `policy(run)` (the shop turn) **before** `nextRound`; default `policy = noShop` preserves v1. Return adds `deadRacks` + `racksSeen` (a rack is "dead" when `bestPlay` is null after a play). `roundReached`/`won`/`status`/`hitCap` unchanged.

- [ ] **Step 1: Write the failing tests** (append):

```javascript
test('simulateRun with a purchase policy acquires the target relic and out-progresses no-shop', () => {
  // a config beatable only with a relic boost; persona buys it → reaches a later round than greedy
  const noShopRes = simulateRun({ config: configBeatable, dictionary: dictCat, words: wordsCat, seed: 3 });
  const policy = buildPurchasePolicy({ targetRelicIds: ['shortAndSweet'], maxRerolls: 5 });
  const buyRes = simulateRun({ config: configBeatable, dictionary: dictCat, words: wordsCat, seed: 3, policy });
  assert.ok(buyRes.roundReached >= noShopRes.roundReached, 'shopping does not regress progress');
  // (brief: configBeatable is tuned so the relic measurably helps; assert ownership via a probe if preferred)
});

test('simulateRun reports dead-rack count and racks seen', () => {
  const r = simulateRun({ config: configB, dictionary: dictB, words: wordsB, seed: 1 });
  assert.equal(typeof r.deadRacks, 'number');
  assert.equal(typeof r.racksSeen, 'number');
  assert.ok(r.racksSeen >= 1);
});
```
(`configB`/`dictB`/`wordsB` are the v1 Model-B fixtures already in the test file; `configBeatable`/`wordsCat`/`dictCat` come from the brief.)

- [ ] **Step 2: Run, see fail.**

- [ ] **Step 3: Implement** — modify `simulateRun` in `src/sim.js`:
  - Signature: add `policy = noShop` to the destructured params.
  - Add counters before the loop: `let deadRacks = 0, racksSeen = 0;`
  - After each successful action (play or discard) while still in a round, sample the hand: `racksSeen += 1; if (!bestPlay(run, words)) deadRacks += 1;` (this is the post-play/post-thin dead-rack check — placed where the loop re-evaluates the hand).
  - Replace the bare `if (run.status === 'roundCleared') nextRound(run);` with: `if (run.status === 'roundCleared') { policy(run); nextRound(run); }` — the policy shops (buying/thinning mutates `run.bag`) before the next round deals from the refreshed bag.
  - Return object: add `deadRacks, racksSeen` alongside the existing fields.
  (Exact insertion points are in the brief; the controller will hand the current `simulateRun` body.)

- [ ] **Step 4: Run, pass; `npm test`.**
- [ ] **Step 5: Commit** — `feat: harness v2 — simulateRun shop loop + dead-rack-after-thin counter`.

---

### Task 3: Pure aggregation — `percentile` + `summarizePersona`

**Files:** Modify `src/sim.js`, `test/sim.test.js`.
**Interfaces — Produces:**
- `percentile(values, p) -> number` — the p-th percentile (0–100) of a numeric array (sorts a copy; nearest-rank or linear interpolation — pick one, document it; linear interpolation between closest ranks is fine). Empty array → 0.
- `summarizePersona(results) -> { n, winRate, roundReached: {p10,p50,p90,mean}, deadRackRate }` — aggregate an array of `simulateRun` result objects.

- [ ] **Step 1: Write the failing tests** (append):

```javascript
import { percentile, summarizePersona } from '../src/sim.js';

test('percentile returns boundaries and the median', () => {
  const v = [10, 20, 30, 40, 50];
  assert.equal(percentile(v, 50), 30);
  assert.equal(percentile(v, 0), 10);
  assert.equal(percentile(v, 100), 50);
  assert.equal(percentile([], 50), 0);
});

test('summarizePersona aggregates win-rate, round percentiles, and dead-rack rate', () => {
  const results = [
    { won: true,  roundReached: 8, deadRacks: 0, racksSeen: 10 },
    { won: false, roundReached: 4, deadRacks: 1, racksSeen: 9 },
    { won: false, roundReached: 6, deadRacks: 0, racksSeen: 11 },
  ];
  const s = summarizePersona(results);
  assert.equal(s.n, 3);
  assert.equal(Number(s.winRate.toFixed(3)), 0.333);
  assert.equal(s.roundReached.p50, 6);
  assert.equal(Number(s.deadRackRate.toFixed(4)), Number((1 / 30).toFixed(4))); // 1 dead / 30 racks
});
```

- [ ] **Step 2–4:** implement `percentile` (sort copy, index `= (p/100)*(n-1)`, interpolate) + `summarizePersona` (winRate = wins/n; roundReached percentiles over the `roundReached` array; deadRackRate = ΣdeadRacks/ΣracksSeen). Run, `npm test`.
- [ ] **Step 5: Commit** — `feat: harness v2 — percentile + persona aggregation`.

---

### Task 4: Per-archetype personas + `runPersona`

**Files:** Modify `src/sim.js`, `test/sim.test.js`.
**Interfaces — Produces:**
- `PERSONAS` — array of `{ id, name, bagId, targetRelicIds, targetHoneId }`, one per archetype, mirroring the `scripts/analyze-builds.js` fixture mapping:
  - `shortWord` → bag `lean`, relics `['shortAndSweet']`, hone `shortWord`
  - `longWord` → `standard`, `['lengthy','longHaul']`, `longWord`
  - `rareLetter` → `rareRich`, `['rareHoarder','rareSurge']`, `rareLetter`
  - `doubled` → `doubled`, `['doubleTrouble','echoChamber']`, `doubled`
  - `vowelHeavy` → `standard`, `['vowelBonus','freshStart']`, `vowelHeavy`
  - `escalation` → `standard`, `['comboCounter','momentum']`, `escalation`
- `runPersona({ config, dictionary, words, persona, seeds, pool, reserve, maxRerolls }) -> summary` — for each seed in `seeds`, build the persona's deck (`config.DECKS[bagId]` or `{startingBag: config.STARTING_BAG}` for `standard`) + policy (`buildPurchasePolicy({targetRelicIds, targetHoneId, reserve, maxRerolls, pool})`), `simulateRun`, then `summarizePersona` the results.

- [ ] **Step 1: Write the failing test** (append): on a tiny beatable config, `runPersona` for one persona over a few seeds returns a summary with `n === seeds.length`, a numeric `winRate`, and `roundReached.p50` present. (Brief gives the tiny config + a 1-relic persona.)
- [ ] **Step 2–4:** implement `PERSONAS` + `runPersona` (build deck + policy per persona, loop seeds, aggregate). Run, `npm test`.
- [ ] **Step 5: Commit** — `feat: harness v2 — per-archetype personas + runPersona`.

---

### Task 5: `analyze-sim-v2.js` instrument (run it, capture the numbers)

**Files:** Create `scripts/analyze-sim-v2.js`; Modify `package.json`. (Instrument — no unit tests; verified by running.)

- [ ] **Step 1: add npm script** — `"analyze:sim-v2": "node scripts/analyze-sim-v2.js"` (match the existing `analyze:sim` format).
- [ ] **Step 2: Implement** `scripts/analyze-sim-v2.js`:

```javascript
// scripts/analyze-sim-v2.js — harness v2: per-archetype skilled-persona simulation (skill-vs-luck).
// Run: npm run analyze:sim-v2   (real ENABLE list + CONFIG; prints win-rate + p10/p50/p90 + dead-rack%; no assertions)
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { makeDictionary } from '../src/dictionary.js';
import { PERSONAS, runPersona } from '../src/sim.js';

const raw = readFileSync(new URL('../assets/enable1.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const dictionary = makeDictionary(raw);
const words = raw.filter(w => w.length >= CONFIG.MIN_WORD_LEN && w.length <= CONFIG.RACK_SIZE).map(w => w.toUpperCase());

const N = 200;
const seeds = Array.from({ length: N }, (_, i) => i + 1);

console.log(`\nLetter Ride — Harness v2: skilled per-archetype personas (${N} seeds each)\n`);
console.log('| Persona | Win rate | round p10 | p50 | p90 | dead-rack% (post-thin) |');
console.log('|---|---|---|---|---|---|');
for (const persona of PERSONAS) {
  const s = runPersona({ config: CONFIG, dictionary, words, persona, seeds });   // pool {} = everything unlocked
  const rr = s.roundReached;
  console.log(`| ${persona.name} | ${(s.winRate * 100).toFixed(1)}% | ${rr.p10} | ${rr.p50} | ${rr.p90} | ${(s.deadRackRate * 100).toFixed(2)}% |`);
}
console.log('\nWide p10↔p90 spread = luck-dominated; tight = skill-rewarding. 0% across the board would mean the curve is unbeatable even with a skilled line.');
console.log('Limits: greedy best-word + simple target-buy policy; wilds treated as non-letters (v2-later). This REPORTS only — no tuning applied.\n');
```

- [ ] **Step 3: Run it** — `npm run analyze:sim-v2`. Capture the full table verbatim + the runtime (it runs 6 personas × N full runs with per-play enumeration — if it exceeds ~60s, reduce N and note it). Flag any persona that wins 0% or any cap-hits.
- [ ] **Step 4: `npm test`** (still green) + `node --check src/sim.js scripts/analyze-sim-v2.js`.
- [ ] **Step 5: Commit** — `feat: harness v2 — per-archetype skilled-persona instrument`.

> **Interpretation (for the author, after running — NOT acted on here):** per the skill-vs-luck rule, the target read is *several personas clearing at a high-but-not-certain win rate with bounded p10↔p90 spread*. If every persona wins ~0%, the curve is too steep even for skilled play (tune `ROUND_TARGETS` down). If one persona dominates (high win-rate, others ~0%), that's the §5 archetype-spread imbalance at the run level (compress relic numbers). A wide p10↔p90 within a persona = luck-dominated (the rule wants it tighter). All tuning is a deferred author playtest call.

---

## Self-Review (plan author)

- **§6 coverage:** purchase policy → Task 1; per-archetype personas → Task 4; **variance/percentile reporting** → Tasks 3 + 5 (the headline); dead-rack-with-thinning → Task 2; wild substitution → explicitly deferred (§6 "later"). The pluggable-policy requirement is met (`buildPurchasePolicy` params + `noShop`; greedy/thrifty/all-in are reserve/maxRerolls/target variations).
- **Type/signature consistency:** `pickTargetOffer(run, opts)` → used by `buildPurchasePolicy` → passed as `policy` to `simulateRun` → built per-persona in `runPersona` → tabulated in the instrument. `percentile`/`summarizePersona` produce the `{winRate, roundReached:{p10,p50,p90,mean}, deadRackRate}` shape the instrument prints. `PERSONAS` entries match the analyze-builds fixture mapping.
- **v1 preserved:** `simulateRun`'s `policy` defaults to `noShop` (no shopping) → the v1 greedy tests still pass; `legalWords`/`bestPlay` untouched.
- **No engine edits:** only `src/sim.js` (+ instrument + tests) change; `run.js`/`scoring.js`/`shop.js` are imported and driven, never modified. Determinism preserved (seeded `run.rng`; no `Math.random`). Relic dedup handled in `pickTargetOffer` (no infinite dup-buying); reroll bounded by `maxRerolls` + reserve (shop turn always terminates).
- **Reports only:** no `config.js`/`relics.js`/`archetypes.js` numbers change — tuning stays a deferred author playtest call (honors CLAUDE.md "don't silently pick numbers").
- **Placeholder scan:** core logic (Tasks 1–3) has complete code; Tasks 4–5 give the persona table + instrument code, with tiny fixtures deferred to the briefs (the controller hands `configShop`/`configBeatable` from the existing test fixtures' shape).
