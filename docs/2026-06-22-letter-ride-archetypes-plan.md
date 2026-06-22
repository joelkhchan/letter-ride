# Letter Ride — Archetype Expansion & Hone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn Letter Ride's thin archetype seeds into committable build paths — flesh out 4 archetypes (rare-letter, long-word, pattern/doubled, escalation) to ≥3 pieces each, add a per-archetype **Hone** invest-to-scale mechanic (Balatro Planet-card analog), introduce **enabler** relics, archetype-leaning bags, and extend telemetry/harness to all archetypes.

**Architecture:** A new `archetypes.js` defines each archetype as a `matches(ctx)` condition + a `honeBonus(ctx, level)` increment, both reading `ctx.enablers` (a flag set derived from owned enabler relics). `run.honeLevels` are injected into scoring as **pseudo-relics** via `honeModifiers(honeLevels)`, so the phase-ordered scoring engine needs ZERO changes (a Hone level acts exactly like a relic that adds Points/Mult when the word qualifies). Enabler relics carry an `enabler` tag; `run.js` collects them into `ctx.enablers`, and the archetype/relic conditions relax accordingly. New content is added to the existing `relics.js`/`tiles.js`/`config.js` registries following their established shapes.

**Tech Stack:** Vanilla JS ESM, `node --test`, no build step. Source of truth for design: `docs/2026-06-22-letter-ride-archetypes.md`.

## Global Constraints

- **Scoring phase order unchanged:** `Score = Points × Mult` = `(Σpoints) × ((1+ΣaddMult) × ΠtimesMult)`. Hone and enablers must NOT change `scoreWord`'s math — Hone injects as pseudo-relics; enablers only relax conditions.
- **Modifier delta shape:** relics/mods/hone-pseudo-relics return `{ addPoints?, addMult?, timesMult? }`. ⚠️ The current code still uses the legacy key **`addWit`** (the earlier term rename kept it for compat). **Task 0 renames `addWit`→`addPoints`** across the engine + all modifiers + tests so the delta key matches the "Points" term; every task after Task 0 uses `addPoints`.
- **Determinism / DI:** no `Math.random()` in logic; `run.js` must NOT import `RELICS`/`ARCHETYPES` for *content* (hone pseudo-relics come from `archetypes.js` via `honeModifiers`, which `run.js` MAY import as a function, like it imports other pure helpers). Tests inject fixtures.
- **Co-viability, not equality** (StS stance): each archetype should be able to win; balance numbers below are STARTING POINTS for the author's playtest + telemetry, not final.
- **Scarcity pillar intact:** enablers relax scoring conditions but must not hand the player an open alphabet; the bag is still drawn.
- **Hone = Planet-card analog:** levels one archetype's payoff, no cap, difficulty-weighted increments (rare/doubled big, vowel small).

## File Structure

| File | Responsibility | New/Mod |
|---|---|---|
| `src/archetypes.js` | `ARCHETYPES` (id, name, matches, honeBonus), `honeModifiers(honeLevels)`, `ALL_ARCHETYPE_IDS`. | New |
| `src/patterns.js` | + `hasRareLetter`, `countMaxRepeat` helpers if needed (reuse existing where possible). | Mod (maybe) |
| `src/run.js` | `honeLevels` field; inject `honeModifiers` + `ctx.enablers` into scoring; apply relic `extraPlays`. | Mod |
| `src/storage.js` | serialize/restore `honeLevels`. | Mod |
| `src/config.js` | `HONE` cost; new `DECKS` (rareRich, doubled, lean); META unlock entries. | Mod |
| `src/shop.js` | `hone` offer type + purchase. | Mod |
| `src/relics.js` | 8 new relics (Mult engines + enablers + escalation pieces). | Mod |
| `src/ui.js` | render hone levels; shop hone offers; archetype labels. | Mod |
| `src/telemetry.js`, `scripts/analyze-builds.js` | per-archetype metrics + head-to-head harness. | Mod |
| `test/*.test.js` | per module. | New/Mod |

---

### Task 0: Rename modifier delta key `addWit` → `addPoints`

**Files:** Modify `src/scoring.js`, `src/tiles.js`, `src/relics.js`; update any test referencing `addWit`.
**Why:** the base term is "Points" but modifiers still add via the legacy `addWit` key — confusing, and the new code in this plan uses `addPoints`. This is a pure rename; behavior is identical, so the 91-test suite must stay green and is the safety net.

- [ ] **Step 1: Find all occurrences** — `grep -rn "addWit" src/ test/` (expected: exactly 8 — `scoring.js:24` reads `d.addWit`; `tiles.js` resonator/polished/anchor return `{addWit:...}`; `relics.js` vowelBonus/rareHoarder/doubleTrouble return `{addWit:...}`; and ONE **stale comment** at `test/scoring.test.js:36`. No test fixture or assertion references the key, so the rename is purely source-side + one comment).
- [ ] **Step 2:** In `src/scoring.js`, change the apply line `if (d.addWit) { points += d.addWit; pointParts.push({ label, amount: d.addWit }); }` → use `d.addPoints` throughout.
- [ ] **Step 3:** In `src/tiles.js` and `src/relics.js`, change every modifier `evaluate` that returns `{ addWit: X }` → `{ addPoints: X }`. Also fix the stale comment at `test/scoring.test.js:36` (`addWit`→`addPoints`) — there are no fixtures/assertions on the key to change.
- [ ] **Step 4:** `npm test` — must stay green (91/91). `node --check src/scoring.js src/tiles.js src/relics.js`.
- [ ] **Step 5: Commit** — `refactor: rename modifier delta key addWit → addPoints`.

---

### Task 1: `archetypes.js` — definitions + hone modifiers

**Files:** Create `src/archetypes.js`, `test/archetypes.test.js`.
**Interfaces — Produces:**
- `ARCHETYPES` — object keyed by id; each `{ id, name, matches(ctx) -> bool, honeBonus(ctx, level) -> {addPoints?, addMult?} }`. `ctx` is the scoring context `{ word, letters, selection, wordsPlayedThisRound, enablers }` (`enablers` = array of active enabler flags, default `[]`).
- `honeModifiers(honeLevels) -> Array<{id, name, evaluate(ctx)}>` — one pseudo-relic per archetype with level>0; `evaluate(ctx)` returns `archetype.honeBonus(ctx, level)`.
- `ALL_ARCHETYPE_IDS` — array of ids.
- **`hasRare(ctx)` and `isDoubled(ctx)`** — `export`ed enabler-aware predicates, imported and reused by `relics.js` (Task 5) so the condition logic lives in ONE place.

- [ ] **Step 1: Write the failing test**

```javascript
// test/archetypes.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { ARCHETYPES, honeModifiers, ALL_ARCHETYPE_IDS } from '../src/archetypes.js';

const ctx = (word, extra = {}) => ({
  word, letters: [...word.toUpperCase()],
  selection: [...word.toUpperCase()].map(l => ({ tile: { letter: l }, letter: l })),
  wordsPlayedThisRound: 0, enablers: [], ...extra,
});

test('rareLetter matches J/Q/X/Z and honeBonus scales points with level', () => {
  assert.equal(ARCHETYPES.rareLetter.matches(ctx('QI')), true);
  assert.equal(ARCHETYPES.rareLetter.matches(ctx('CAT')), false);
  assert.deepEqual(ARCHETYPES.rareLetter.honeBonus(ctx('QI'), 2), { addPoints: 30 }); // 15*2
  assert.deepEqual(ARCHETYPES.rareLetter.honeBonus(ctx('CAT'), 2), {});
});
test('wildsAreRare enabler makes a wild count as rare', () => {
  const c = { ...ctx('A'), letters: ['A'], selection: [{ tile: { letter: '*' }, letter: 'A' }], enablers: ['wildsAreRare'] };
  assert.equal(ARCHETYPES.rareLetter.matches(c), true);
});
test('shortWord hone adds Mult per level on <=3 letters only', () => {
  assert.deepEqual(ARCHETYPES.shortWord.honeBonus(ctx('CAT'), 3), { addMult: 3 });
  assert.deepEqual(ARCHETYPES.shortWord.honeBonus(ctx('CATS'), 3), {});
});
test('escalation hone scales Mult with words played this round', () => {
  assert.deepEqual(ARCHETYPES.escalation.honeBonus(ctx('CAT', { wordsPlayedThisRound: 4 }), 1), { addMult: 2 }); // 0.5*1*4
});
test('honeModifiers yields one pseudo-relic per leveled archetype', () => {
  const mods = honeModifiers({ rareLetter: 2, shortWord: 0, longWord: 1 });
  assert.deepEqual(mods.map(m => m.id).sort(), ['hone:longWord', 'hone:rareLetter']); // level 0 excluded
  const rare = mods.find(m => m.id === 'hone:rareLetter');
  assert.deepEqual(rare.evaluate(ctx('QI')), { addPoints: 30 });
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/archetypes.test.js` — FAIL.

- [ ] **Step 3: Implement** `src/archetypes.js`:

```javascript
// src/archetypes.js — build archetypes: conditions + per-level hone increments.
// Numbers are difficulty-weighted STARTING POINTS (rare/doubled big, vowel small) — tune via playtest.
const VOWELS = new Set(['A','E','I','O','U']);
const RARE = new Set(['J','Q','X','Z']);
const isVowel = (c) => VOWELS.has(c);
const hasAdjacentDouble = (w) => { for (let i=1;i<w.length;i++) if (w[i]===w[i-1]) return true; return false; };
const hasRepeat = (letters) => { const seen={}; for (const l of letters){ seen[l]=(seen[l]||0)+1; if (seen[l]>=2) return true; } return false; };

// rare check honors the wildsAreRare enabler (a wild tile counts as rare).
// Exported so relics.js (Task 5) reuses the SAME predicate — one home.
export function hasRare(ctx) {
  if (ctx.letters.some(l => RARE.has(l))) return true;
  if ((ctx.enablers || []).includes('wildsAreRare') && (ctx.selection || []).some(s => s.tile?.letter === '*')) return true;
  return false;
}
// doubled check honors the looseDoubled enabler (any letter repeated, not just adjacent).
export function isDoubled(ctx) {
  if (hasAdjacentDouble(ctx.word.toUpperCase())) return true;
  if ((ctx.enablers || []).includes('looseDoubled') && hasRepeat(ctx.letters)) return true;
  return false;
}
// long threshold drops by 1 with the longReach enabler.
const longThreshold = (ctx) => (ctx.enablers || []).includes('longReach') ? 5 : 6;

export const ARCHETYPES = {
  shortWord: {
    id: 'shortWord', name: 'Short-word',
    matches: (ctx) => ctx.letters.length <= 3,
    honeBonus: (ctx, lvl) => ctx.letters.length <= 3 ? { addMult: lvl } : {},
  },
  longWord: {
    id: 'longWord', name: 'Long-word',
    matches: (ctx) => ctx.letters.length >= longThreshold(ctx),
    honeBonus: (ctx, lvl) => ctx.letters.length >= longThreshold(ctx) ? { addPoints: 5 * lvl } : {},
  },
  rareLetter: {
    id: 'rareLetter', name: 'Rare-letter',
    matches: (ctx) => hasRare(ctx),
    honeBonus: (ctx, lvl) => hasRare(ctx) ? { addPoints: 15 * lvl } : {},
  },
  doubled: {
    id: 'doubled', name: 'Doubled-letter',
    matches: (ctx) => isDoubled(ctx),
    honeBonus: (ctx, lvl) => isDoubled(ctx) ? { addPoints: 12 * lvl } : {},
  },
  vowelHeavy: {
    id: 'vowelHeavy', name: 'Vowel-heavy',
    matches: (ctx) => ctx.letters.filter(isVowel).length >= 3,
    honeBonus: (ctx, lvl) => { const v = ctx.letters.filter(isVowel).length; return v >= 3 ? { addPoints: 2 * lvl * v } : {}; },
  },
  escalation: {
    id: 'escalation', name: 'Escalation',
    matches: () => true,
    honeBonus: (ctx, lvl) => { const m = 0.5 * lvl * (ctx.wordsPlayedThisRound || 0); return m ? { addMult: m } : {}; },
  },
};

export const ALL_ARCHETYPE_IDS = Object.keys(ARCHETYPES);

export function honeModifiers(honeLevels = {}) {
  const mods = [];
  for (const id of ALL_ARCHETYPE_IDS) {
    const lvl = honeLevels[id] || 0;
    if (lvl <= 0) continue;
    const a = ARCHETYPES[id];
    mods.push({ id: `hone:${id}`, name: `Hone: ${a.name}`, evaluate: (ctx) => a.honeBonus(ctx, lvl) });
  }
  return mods;
}
```

- [ ] **Step 4: Run to verify it passes** — `node --test test/archetypes.test.js`, then `npm test` — PASS.
- [ ] **Step 5: Commit** — `git add src/archetypes.js test/archetypes.test.js && git commit -m "feat: archetype definitions + hone modifiers"`

---

### Task 2: run.js — hone levels, scoring injection, enabler flags, extra plays

**Files:** Modify `src/run.js`, `test/run.test.js`.
**Interfaces:** `newRun` adds `honeLevels: {}`. `playsPerRound` stays the **static base** (`config.PLAYS_PER_ROUND + stake delta`); each round `playsLeft = playsPerRound + Σ run.relics.extraPlays` (recomputed from current relics, so a shop-bought Overtime counts next round). `playWord` passes to `scoreWord`: `relics: [...run.relics, ...honeModifiers(run.honeLevels)]` and `context: { wordsPlayedThisRound: run.wordsPlayedThisRound, enablers: run.relics.filter(r => r.enabler).map(r => r.enabler) }`.

- [ ] **Step 1: Write the failing test** (append to `test/run.test.js`)

```javascript
import { honeModifiers } from '../src/archetypes.js';
test('a hone level adds its archetype bonus to a matching word', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.honeLevels = { shortWord: 2 };           // +2 Mult on <=3-letter words
  const res = playWord(run, seatCat(run));     // CAT (3 letters): base 5, mult (1+2)=3 -> 15
  assert.equal(res.scored.score, 15);
});
test('an enabler relic flag reaches scoring context', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1 });
  run.relics = [{ id: 'wc', enabler: 'wildsAreRare' }];
  // a relic that scores +7 only when ctx.enablers includes wildsAreRare (proves flow)
  run.relics.push({ id: 'probe', evaluate: (ctx) => ({ addPoints: ctx.enablers.includes('wildsAreRare') ? 7 : 0 }) });
  const res = playWord(run, seatCat(run));     // CAT base 5 + 7 = 12
  assert.equal(res.scored.points, 12);
});
// nextRound is already imported in run.test.js; if not, add it to the import.
test('extraPlays is derived from current relics each round (loadout + shop-bought)', () => {
  resetTileIds();
  const run = newRun({ config, dictionary: dict, seed: 1, loadout: { startRelics: [{ id:'ep', extraPlays: 1, evaluate:()=>({}) }] } });
  assert.equal(run.playsLeft, config.PLAYS_PER_ROUND + 1);          // loadout Overtime active in round 1
  run.relics.push({ id:'ep2', extraPlays: 1, evaluate:()=>({}) });  // simulate a shop-bought Overtime
  nextRound(run);
  assert.equal(run.playsLeft, config.PLAYS_PER_ROUND + 2);          // BOTH apply next round, no double-count
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/run.test.js` — FAIL.

- [ ] **Step 3: Implement** — in `src/run.js`:
  - add `import { honeModifiers } from './archetypes.js';`
  - in `newRun`, add `honeLevels: {}` to the returned state. Define `const sumExtraPlays = (relics=[]) => relics.reduce((n,r)=>n+(r.extraPlays||0),0)` at the top of run.js. Keep `playsPerRound = config.PLAYS_PER_ROUND + (stake?.playsDelta||0)` as the **static base** — do NOT bake extraPlays into it. Then **everywhere `playsLeft` is set from `playsPerRound`** (the initial-round setup in `newRun` AND the reset in `nextRound`), use `playsLeft = playsPerRound + sumExtraPlays(run.relics)`. Deriving from the *current* `run.relics` each round is what makes a shop-bought Overtime take effect next round (and a loadout Overtime from round 1) with no double-count.
  - in `playWord`, build the scoring call as:
    ```javascript
    const enablers = run.relics.filter(r => r.enabler).map(r => r.enabler);
    const allMods = [...run.relics, ...honeModifiers(run.honeLevels)];
    const scored = scoreWord(selection, {
      tileValues: run.tileValues,
      lengthBonusPerLetter: run.config.LENGTH_BONUS_PER_LETTER,
      relics: allMods,
      context: { wordsPlayedThisRound: run.wordsPlayedThisRound, enablers },
    });
    ```
  (Hone pseudo-relics and enabler-flag relics both flow through the existing `relics` loop; enabler relics whose `evaluate` is absent/`{}` contribute nothing directly.)

- [ ] **Step 4: Run to verify it passes** — `node --test test/run.test.js`, then `npm test` — PASS.
- [ ] **Step 5: Commit** — `git add src/run.js test/run.test.js && git commit -m "feat: hone injection, enabler ctx flags, extra-plays in run"`

---

### Task 3: storage — persist `honeLevels`

**Files:** Modify `src/storage.js`, `test/storage.test.js`.

- [ ] **Step 1: Failing test** — append: serialize→deserialize a run with `run.honeLevels = { rareLetter: 3 }` preserves it (and a run with no `honeLevels` deserializes to `{}`). (The enabler-relic round-trip assertion lives in **Task 5**, where the `wildcardRares` enabler relic is actually defined — it can't be tested here because that relic doesn't exist yet.)
- [ ] **Step 2: Run, see fail.**
- [ ] **Step 3: Implement** — `serializeRun`: add `honeLevels: run.honeLevels || {}`; `deserializeRun`: add `honeLevels: data.honeLevels || {}`.
- [ ] **Step 4: Run, pass; `npm test`.**
- [ ] **Step 5: Commit** — `feat: persist honeLevels across save/resume`.

---

### Task 4: Hone shop offer

**Files:** Modify `src/config.js`, `src/shop.js`, `test/shop.test.js`.
**Interfaces:** offer `{ type:'hone', archetypeId, cost }`; `purchase` increments `run.honeLevels[archetypeId]`.

- [ ] **Step 1: config + fixture** — add `HONE: { cost: 6 }` inside `CONFIG` (config.js) **AND** add `HONE: { cost: 6 }` to the test fixture `config` in `test/shop.test.js`. ⚠️ The shop-test fixture currently has no `HONE` key; without this, `generateShop` reading `run.config.HONE.cost` throws `TypeError` and breaks **every existing shop test**, not just the new one.
- [ ] **Step 2: Failing test** — `generateShop` can produce hone offers (one per `ALL_ARCHETYPE_IDS` in the candidate pool); `purchase(run, {type:'hone', archetypeId:'rareLetter', cost:6})` with enough $ sets `run.honeLevels.rareLetter` to 1 (and 2 on a second buy), deducts cost; broke → no change.
- [ ] **Step 3: Run, see fail.**
- [ ] **Step 4: Implement** — in `src/shop.js`:
  - import `ALL_ARCHETYPE_IDS` from `./archetypes.js`.
  - in `generateShop`, add to the candidate list: `for (const archetypeId of ALL_ARCHETYPE_IDS) candidates.push({ type: 'hone', archetypeId, cost: run.config.HONE.cost });`
  - in `purchase`, add a case (with a defensive init guard matching the codebase's `|| {}` style): `case 'hone': { if (!run.honeLevels) run.honeLevels = {}; run.honeLevels[offer.archetypeId] = (run.honeLevels[offer.archetypeId] || 0) + 1; break; }` — place it before the `run.coins -= offer.cost` deduction.
- [ ] **Step 5: Run, pass; `npm test`. Commit** — `feat: hone shop offer (invest to level an archetype)`.

---

### Task 5: New relics — Mult engines + enablers + escalation pieces (8)

**Files:** Modify `src/relics.js`, `test/relics.test.js`.
**Interfaces:** add to `RELICS` (each `{ id, name, desc, evaluate?(ctx), enabler?, extraPlays? }`). Enabler relics have `enabler: '<flag>'` and an `evaluate` returning `{}` (they only set the ctx flag, read by `archetypes.js` conditions + condition-based relics). Use `ctx.enablers` in the conditional relics so they relax with enablers too.

Add these (numbers are starting points):
```javascript
// Rare-letter
rareSurge:   { id:'rareSurge', name:'Rare Surge', desc:'×1.5 Mult if the word uses a rare letter (J/Q/X/Z)',
               evaluate:(ctx)=> hasRareCtx(ctx) ? { timesMult: 1.5 } : {} },
wildcardRares:{ id:'wildcardRares', name:'Wildcard Rares', desc:'Wilds count as rare letters (J/Q/X/Z)',
               enabler:'wildsAreRare', evaluate:()=>({}) },
// Long-word
longHaul:    { id:'longHaul', name:'Long Haul', desc:'×Mult grows with length: ×(1 + 0.25 per letter beyond 5)',
               evaluate:(ctx)=> ctx.letters.length>5 ? { timesMult: 1 + 0.25*(ctx.letters.length-5) } : {} },
longReach:   { id:'longReach', name:'Long Reach', desc:'Long-word bonuses trigger one letter sooner',
               enabler:'longReach', evaluate:()=>({}) },
// Pattern / doubled
echoChamber: { id:'echoChamber', name:'Echo Chamber', desc:'×2 Mult if the word has a doubled letter',
               evaluate:(ctx)=> isDoubledCtx(ctx) ? { timesMult: 2 } : {} },
looseDoubles:{ id:'looseDoubles', name:'Loose Doubles', desc:'Any letter appearing 2+ times counts as doubled',
               enabler:'looseDoubled', evaluate:()=>({}) },
// Escalation / combo
momentum:    { id:'momentum', name:'Momentum', desc:'+10 Points per word already played this round',
               evaluate:(ctx)=> ({ addPoints: 10 * (ctx.wordsPlayedThisRound||0) }) },
overtime:    { id:'overtime', name:'Overtime', desc:'+1 play each round', extraPlays:1, evaluate:()=>({}) },
```
The `hasRareCtx`/`isDoubledCtx` calls above are the SAME enabler-aware predicates `archetypes.js` exports (Task 1 exports `hasRare`/`isDoubled`). Add this exact import at the top of `relics.js` so the names resolve and the logic has ONE home — do NOT copy the predicate bodies into relics.js:
```javascript
import { hasRare as hasRareCtx, isDoubled as isDoubledCtx } from './archetypes.js';
```

- [ ] **Step 1: Failing tests** — for each new relic, assert its delta on a fixed word via `scoreWord` (e.g. `rareSurge` on 'QI' → mult ×1.5; `echoChamber` on 'BALL' → ×2; `momentum` with `context.wordsPlayedThisRound:3` → +30 Points; `wildcardRares` sets the enabler so `rareSurge` fires on a wild — test by passing `context.enablers:['wildsAreRare']`). Assert `overtime.extraPlays === 1`.
- [ ] **Step 1b: Storage round-trip test (moved here from Task 3)** — in `test/storage.test.js`, add a case: a run owning `wildcardRares` deserializes with its enabler flag intact — `assert.ok(restored.relics.some(r => r.enabler === 'wildsAreRare'))`. Confirms the new `enabler` field survives because relics restore by id from the registry (the field lives on the registry object, not the serialized state). This belongs here, not Task 3, because `wildcardRares` is defined in this task.
- [ ] **Step 2–4:** implement, run, `npm test` green. Ensure `ALL_RELIC_IDS` includes the new ids.
- [ ] **Step 5: Commit** — `feat: 8 archetype relics (Mult engines, enablers, escalation)`.

---

### Task 6: Archetype-leaning bags

**Files:** Modify `src/config.js` `DECKS`; modify `test`/meta as needed.
**Interfaces:** add bags (keep Standard neutral):
```javascript
rareRich: { id:'rareRich', name:'Rare Cache', startingBag:['A','A','E','E','I','O','U','R','S','T','L','N','D','C','M','B','P','G','H','J','Q','X','Z','*','*','K'] },
doubled:  { id:'doubled',  name:'Echo Bag',   startingBag:['A','A','E','E','E','I','I','O','O','S','S','T','T','L','L','N','N','R','R','D','D','C','M','B','P','G'] },
lean:     { id:'lean',     name:'Lean Bag',   startingBag:['A','E','I','O','U','R','S','T','N','L','D','C','M','B','P','K','F','H','Y','G'] }, // fewer, value-rich tiles
```
- [ ] Add to `config.DECKS`, **and add their ids to `META.baseUnlocked.decks`** so all three start unlocked. Rationale (decision made here, not deferred to the implementer): the bags are the primary archetype-signposting + playtest vehicle, and the Task 8 🛑 gate asks the author to commit-play each archetype — so each archetype's home bag must be reachable without first grinding Meta. (Locking them behind the meta-shop can be a deferred follow-up alongside R-F.)
- [ ] Test: each new deck's `startingBag` is a non-empty letter array; `newRun({deck: CONFIG.DECKS.rareRich})` seeds a bag containing J/Q/X/Z. Commit `feat: archetype-leaning bags (rare/doubled/lean)`.

---

### Task 7: UI — hone levels, hone offers, archetype labels

**Files:** Modify `src/ui.js`, `src/main.js`. (Manual-verify.)
- [ ] `offerLabel` (ui.js): add `case 'hone': return 'Hone: ' + ARCHETYPES[offer.archetypeId].name + ' (Lv ' + (lastRun.honeLevels[offer.archetypeId]||0) + '→' + ((lastRun.honeLevels[offer.archetypeId]||0)+1) + ') — $' + offer.cost;` (import `ARCHETYPES` from `./archetypes.js` for names). Append a short "what it scales" hint from the archetype.
- [ ] In `renderRun`/`renderShop`, show current hone levels (e.g. in the relics/mods panel: "Hone: Rare-letter Lv2, Short-word Lv1" for non-zero levels).
- [ ] Verify: `node --check src/ui.js src/main.js`; `npm test` unaffected; manual: `npm run serve`, clear a round, buy a Hone offer, confirm the level shows and the next matching word scores higher (the scorebug breakdown shows "Hone: X" as a line). Commit `feat: UI for hone levels + offers`.

---

### Task 8: Telemetry + harness — all archetypes head-to-head

**Files:** Modify `src/telemetry.js`, `src/main.js` (the caller), `scripts/analyze-builds.js`.

**Task 8a — per-archetype telemetry (testable).**
- [ ] Extend telemetry to receive the play's context, not just length. `recordPlay` currently takes `(t, wordLength)` — change it to `recordPlay(t, { letters, word, selection, wordsPlayedThisRound, enablers })` (or add a sibling `recordArchetypeHits(t, ctx)`). The caller is `main.js:60` (`recordPlay(telemetry, sel.length)`) — change it to pass the full ctx built from the play: `{ letters, word, selection: sel, wordsPlayedThisRound: run.wordsPlayedThisRound, enablers: run.relics.filter(r => r.enabler).map(r => r.enabler) }` (same `enablers` one-liner scoring uses, so classification matches scoring reality and enabler-relaxed archetypes aren't under-counted).
- [ ] On each play, for every `id` where `ARCHETYPES[id].matches(ctx)` is true (a word can hit several), increment a per-archetype counter and accumulate its score; `summarize` reports each archetype's play-share + avg score. (Import `ARCHETYPES`.)
- [ ] Test the accumulation: feed two fabricated ctx (one rare `QI`, one short `CAT`) and assert the per-archetype counts. Commit `feat: per-archetype telemetry classification`.

**Task 8b — head-to-head harness (instrument; effectively a rewrite).**
> Scope note: `scripts/analyze-builds.js` (~93 lines) is hardwired short-vs-long (its `variants`, the `len<=3` filter, rack draws from `STARTING_BAG` only, the `bestScore >= bestLong` win metric). This task largely **rewrites** it — treat it as new code, not a one-line extend.
- [ ] Define a per-archetype build fixture `{ archetype, bag, relicIds:[], honeLevels:{} }` for each of the ~6 archetypes, **each measured against the bag that homes it** (rareLetter→`rareRich`, doubled→`doubled`, short→`lean`, long/vowel/escalation→`standard`). A shared bag would falsely zero rare-letter (no J/Q/X/Z form from the rare-poor `standard` bag).
- [ ] For each fixture: draw N racks from its bag, find the archetype's best-scoring legal word under its relics + hone, and compute its score as a ratio of the **no-relic long-word baseline** (the existing baseline). Print a one-row-per-archetype ratio table. No assertions — this is an instrument for the author.
- [ ] Run `npm run analyze`, capture output. Commit `feat: per-archetype head-to-head harness`.

> **🛑 ARCHETYPE GATE (author playtest).** Play runs committing to each archetype. The harness + telemetry **surface** per-archetype ratios and win-in-deck data for the author to judge — they don't by themselves prove co-viability; "each can win" is a judgment call on those numbers (StS stance). Suggested tuning trigger: flag any archetype whose best committed build is **< 50% of the no-relic long baseline**. Tune (in `config.js` / `archetypes.js` / `relics.js`): hone increments, ×Mult magnitudes, enabler power vs. the scarcity pillar. This is the author's balance call.

---

## Self-Review (plan author)

- **Coverage (archetype doc):** Hone mechanic (R-A) → Tasks 1–4,7; enablers (R-B) → Tasks 1,2,5; archetype bags (R-C) → Task 6; ×Mult per archetype (R-D) → Task 5; base→upgrade (R-E) → *deferred* (note below); shop coherence (R-F) → partial (hone offers added; offer-weighting toward owned archetypes is a follow-up); short/long co-viability → Task 8 harness/telemetry, no nerf.
- **Deferred from this plan (flag):** R-E base→upgrade relic tiers and R-F archetype-weighted shop offer generation are NOT in this plan (kept it to the 4 archetypes + Hone + enablers + bags + telemetry the author selected). They're natural follow-ups once these land and are playtested.
- **Type consistency:** `honeModifiers(honeLevels)` (Task 1) consumed in run.js (Task 2); `ARCHETYPES[id].matches/honeBonus` shape used in archetypes/telemetry/ui; enabler relics' `enabler` tag (Task 5) collected into `ctx.enablers` (Task 2) and read by `archetypes.js` predicates (Task 1) + conditional relics (Task 5) — single predicate home (`hasRare`/`isDoubled` exported from archetypes.js, imported by relics.js); `extraPlays` (Task 5 relic field) applied in newRun (Task 2); `hone` offer (Task 4) rendered in ui (Task 7); `run.honeLevels` persisted (Task 3).
- **Engine untouched:** `scoreWord` gets no new params — hone rides the existing `relics` array; enablers ride the existing `context`. The additive-points delta key is **`addWit` today**; Task 0 renames it to `addPoints` first, after which every new modifier uses `addPoints`.
- **Escalation kept as its own archetype (deliberate call — author may veto):** the design doc open-questioned folding Escalation into long-word/multi-play. This plan gives it a hone + `Momentum` + `Overtime` but intentionally **no leaning bag and no enabler** this pass (the other three thin archetypes get bags). Caveat: `Overtime` (+1 play) helps *every* build, so it's weak evidence of a distinct identity — revisit fold-vs-keep after the 🛑 gate.
- **Placeholder scan:** system tasks (1–4) have complete code; content (Task 5 relics, Task 6 bags) has exact definitions; UI (7) + telemetry/harness (8) are spec'd against existing patterns with concrete acceptance + the manual-verify gate.
