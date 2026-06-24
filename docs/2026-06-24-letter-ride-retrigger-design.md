# Letter Ride — Retrigger (Phase 3, sub-project 1)

**Date:** 2026-06-24 · **Status:** design, pre-build. The first Phase 3 mechanic from the locked
[systems bible](2026-06-23-letter-ride-systems-bible.md) effect vocabulary (D4: "retrigger IN for
v1"). Builds on the scaling engine + bosses + events already on `main`. Magnitudes and names are
tunable starting points; **copy is author-owned** and will be reconciled with the letterpress voice
in the Phase 4 reskin (this doc names things functionally so the mechanic is testable now).

## 1. The core idea

**Retrigger = a selected tile's scoring contribution is counted more than once.** A tile with one
retrigger contributes its base value and each of its mods' deltas **twice**; the word, the relics,
and the phase-order formula are otherwise unchanged. This is Balatro's "retrigger this card"
primitive, and it is the marquee missing effect type the bible greenlit but the engine never grew.

Why it matters: retrigger is a **multiplier on a tile you already chose to build around.** It rewards
the same commitment the snowball relics do (stack a rare-letter build, then retrigger the rares), and
it gives every archetype a fresh, legible lever that reads instantly ("this sort prints twice").

**Scope of SP1:** the per-tile retrigger primitive + the minimal content that exercises it. Tile
transform/destroy is **SP2** (separate). Word-level "replay the entire scoring including relics" is
**deferred** (it is copy/engine territory, bible D4-deferred). A "retrigger every tile this word"
relic gives the *word-retrigger feel* using only the per-tile primitive, so we get that flavor
without a second code path.

## 2. The engine change (the one touch to the locked module)

This is the only place SP1 modifies the **locked** `scoring.js`. **The phase-order pillar is
preserved exactly:** all `+Mult` still sum into `(1 + Σ)`, then all `×Mult` still multiply, and the
result is still acquisition-order-independent. Retrigger changes only *how many times a single tile's
contribution is counted*, not the order of operations.

### 2a. What retrigger affects

Retrigger applies to a tile's **own** contribution only: its **base letter value** + the deltas from
**its own mods**. It does **not** re-fire word-level relics (a "retrigger rares" relic must not also
re-apply Vowel Bonus) and does **not** re-apply the word-level length bonus. Those fire once per word.

### 2b. Where the retrigger count comes from

Two sources, summed per tile:
- **Tile-mods** may return a new delta field `retrigger: N` from `evaluate(tile, ctx)` (alongside the
  existing `addPoints / addMult / timesMult`). `N` is "extra times this tile prints."
- **Relics** may expose a new optional per-tile hook `retriggerTile(tile, ctx) -> N` (distinct from
  the word-level `evaluate(ctx)`). This lets a relic grant retriggers to tiles matching a condition
  (the first tile, rare letters, etc.) without a word-level delta.

`tileRetrigger = Σ(mod.retrigger for the tile's mods) + Σ(relic.retriggerTile(tile, ctx))`, and the
tile prints `times = 1 + tileRetrigger`.

### 2c. The applied formula (preserves phase order)

For each selected tile, with `times = 1 + tileRetrigger`:
- **base value** is additive, so it contributes `baseValue × times` to `points`;
- **each of the tile's mod deltas** is applied `times` times (looping `apply()`), because `timesMult`
  compounds (printing a ×Mult mod twice squares it, the intended blowup) while `addPoints/addMult`
  simply sum. Looping handles all three delta kinds correctly; scaling would not.

Word-level relics and the length bonus are applied exactly once, as today. Then, unchanged:
`mult = (1 + ΣaddMult) × ΠtimesMult`, `score = points × mult`.

Sketch (the real diff lands in the plan):

```js
// per selected tile: compute retrigger, then count the tile's contribution `times` times
for (const sel of selection) {
  const { tile, letter } = sel;
  const baseVal = tile.letter === '*' ? 0 : (tileValues[letter.toUpperCase()] || 0);
  let tileRetrigger = 0;
  for (const mod of tile.mods || []) tileRetrigger += (mod.evaluate?.(tile, ctx)?.retrigger || 0);
  for (const relic of relics) tileRetrigger += (relic.retriggerTile?.(tile, ctx) || 0);
  const times = 1 + tileRetrigger;
  base += baseVal * times;                                       // base value counted `times` times
  for (const mod of tile.mods || [])
    for (let i = 0; i < times; i++) apply(mod.evaluate?.(tile, ctx), mod.name || mod.id);  // mod deltas too
}
const lengthBonus = Math.max(0, letters.length - 3) * lengthBonusPerLetter;  // word-level, once
let points = base + lengthBonus;
for (const relic of relics) apply(relic.evaluate?.(ctx), relic.name || relic.id);            // word-level, once
```

(The exact reordering of `scoreWord` so `apply()` can run inside the tile loop is an implementation
detail for the plan; the contract is: base counted `times`, mod deltas applied `times`, relics +
length bonus once, then the unchanged `mult = (1 + ΣaddMult) × ΠtimesMult`. How retrigger is shown in
`breakdown` is a render detail, kept minimal: the data is already in the part lists.)

### 2d. Boss interaction (no special-casing)

Bosses warp via the three sanctioned mechanisms (injected `tileValues`, post-process, setup). A
"disable" boss zeroes a tile's value before scoring, so retriggering a disabled tile is `0 × times = 0`.
A "cap" boss caps the final `×Mult` after scoring. No retrigger-specific boss code is needed.

## 3. Content (serves the vocabulary, not a relic count)

Lean SP1 set: **1 tile-mod + 2 relics.** Names/magnitudes are starting points; **author finalizes
copy + numbers** (relic magnitudes are tunable, per house rule). Functional names below.

| Kind | Working name | Effect | Pairs with |
|---|---|---|---|
| Tile-mod | **Reprint** | The sort it is on prints **+1** time (`{ retrigger: 1 }`); no other delta | Any high-value tile; the `+Points` early arc |
| Relic | **Press Lead** | The **first** tile of the word retriggers (+1) | First-letter play (pairs with the `anchor` mod / Fresh Start) |
| Relic | **Rare Reprint** | Each **rare** tile (J/Q/X/Z) in the word retriggers (+1) | The rare-letter archetype (high base values make this juicy) |

Deferred (named here so the hook is reserved, **not built in SP1**): a "retrigger every tile this
word" relic (word-retrigger feel) and a true full-replay (re-apply relics too). Revisit once SP1 is
playtested; both ride the same per-tile primitive except full-replay.

Shop integration is automatic: relics register in `RELICS` / `ALL_RELIC_IDS` and the mod in the tile
`MOD_REGISTRY` / `ALL_MOD_IDS`, which the existing shop pools already draw from (verify in the plan).

## 4. Legibility (the touch-first rule from Phase 2)

- The **Reprint** mod and the two relics get a `desc` that states the effect plainly, surfaced by the
  existing tap-to-reveal popover (built in Phase 2) on the HUD + shop chips. No hover-only text.
- The **score breakdown** should make a retrigger visible (e.g. a retriggered tile's point line shows
  the multiplied amount, or a small "×2" marker), so the player can see *why* a number jumped. Exact
  presentation is a render detail for the build; the data is in `breakdown.pointParts`.

## 5. Persistence (no schema bump)

Retrigger is **stateless per play** (computed fresh inside `scoreWord` each word), unlike the snowball
relics' per-run `relicState`. The Reprint mod persists as an ordinary mod id (already serialized via
`modIds`); the two relics persist as ordinary relic ids. **No new save state, no schema version bump**
(stays at 5). Old saves keep loading.

## 6. Testing

`test/scoring.test.js` (extend) with tiny fixtures (a 3-tile selection, a 3-letter tileValues map):
- a tile with the Reprint mod contributes its base value twice and its mod deltas twice;
- a `timesMult` mod on a retriggered tile is **squared** (proves the loop, not a scale);
- a retriggered tile does **not** re-fire word-level relics or the length bonus (counted once);
- phase order holds: `(1 + ΣaddMult) × ΠtimesMult` with retrigger present;
- `retriggerTile` relic hooks fire only on matching tiles (first-tile, rare) and are deterministic;
- a Wild / boss-disabled tile (base 0) retriggers to 0 (no negative/NaN).

`test/relics.test.js` / `test/tiles.test.js`: the new relics' `retriggerTile` and the mod's
`retrigger` field return the right counts on fixtures. Harness (`analyze:sim-v2`) is re-run as a
regression gate (the greedy bot ignores retrigger content, so this confirms *no break*, not balance;
balance is author play).

## 7. Decisions

| # | Decision | Value |
|---|---|---|
| R1 | Retrigger granularity | **Per-tile** primitive (tile + its own mods); word-retrigger expressed as "retrigger all tiles"; full-replay deferred |
| R2 | Engine surface | One bounded change to `scoreWord`: per-tile `times = 1 + retrigger`, base ×times, mod deltas looped ×times; **phase order preserved** |
| R3 | Count sources | Tile-mod `{ retrigger: N }` delta field + relic `retriggerTile(tile, ctx)` hook |
| R4 | What retrigger affects | The tile's base value + its own mods only; word-level relics + length bonus fire once |
| R5 | Content | 1 mod (Reprint) + 2 relics (Press Lead, Rare Reprint); names/magnitudes **author-owned** |
| R6 | Persistence | Stateless per play; **no schema bump** (stays v5) |
| R7 | Bosses | No special-casing (disable=0×times=0; cap post-processes) |

## 8. Out of scope (later)

Word-level full-replay (re-apply relics); a "retrigger all tiles" relic; retrigger-granting *events*;
retrigger that scales (a snowball that grants more retriggers over a run). Tile transform/destroy is
the separate **SP2**. The Phase 4 reskin renames these into letterpress voice.

## 9. Exit gate

Retrigger is live and phase-order-safe: a Reprint sort and the two relics measurably multiply the
right tile contributions, the breakdown shows it, tests prove the phase-order + squaring + once-only
invariants, and the harness confirms no regression. Author playtest then judges whether it is *fun*
and tunes the magnitudes.
