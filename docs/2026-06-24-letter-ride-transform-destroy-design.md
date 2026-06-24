# Letter Ride — Tile Transform / Destroy (Phase 3, sub-project 2)

**Date:** 2026-06-24 · **Status:** design, pre-build. The second Phase 3 mechanic from the locked
[systems bible](2026-06-23-letter-ride-systems-bible.md) effect vocabulary (D4: "tile transform /
destroy IN for v1, shop tools"). Builds on SP1 (retrigger) + the existing shop. **Author chose the
scope: Recast + Transfer** (2026-06-24). Magnitudes/names are tunable starting points; **copy is
author-owned** and reconciled with the letterpress voice in Phase 4.

## 1. The gap this fills

The deckbuilding pillar says the bag's composition *is* the game, and "skill beats luck" needs real
bag-shaping levers. Today the player can **add** tiles (`buyLetter`, `buyEnchantedTile`), **add mods**
(`enchantTile`), raise a letter's value globally (`upgradeLetter`), and **destroy** tiles
(`thinLetter` in the shop, the **Redaction** event). The missing verbs:

- **Transform** a specific tile's *identity* (its letter). Nothing today does this. This is the
  marquee SP2 lever: convert a dead/clogging tile into the letter your build wants (a low tile into a
  Q for the rare build; an awkward consonant into a vowel), or recast a tile carrying good mods
  (Reprint, Catalyst) into a higher-value letter.
- **Destroy with upside.** Plain thinning already exists; SP2 adds destroying a tile to *concentrate*
  its mods onto another, so enchantments stack on one "super-sort" (strong with SP1's retrigger).

Both are **bag mutations** (the same shape as the Redaction event and `thinLetter`); **no scoring or
engine change.**

## 2. The two tools

Both are **shop offers** (the shop is our forge, per the run-nodes design: it already subsumes
forge/hone-bench). Both mutate `run.bag` via the existing `bag.remove` + direct tile mutation, exactly
like `purchase`'s current cases.

### 2a. Recast (transform)

- **Offer:** a single generic offer `{ type: 'recastTile', cost }` (NOT one per letter, to avoid
  flooding the candidate pool and to let the player choose the letter freely, cost being the limiter,
  per "embrace breaking it").
- **Purchase:** `purchase(run, offer, { targetTileId, targetLetter })` finds the bag tile by
  `targetTileId` and sets `tile.letter = targetLetter`. **Keeps the tile's `id` and `mods`** (only the
  letter changes). Errors: `no-target` if the tile is gone; `bad-letter` if `targetLetter` is not in
  the allowed pool.
- **Letter pool:** `config.SHOP.buyableLetters` (the existing 15-letter shop pool, includes
  J/Q/X/Z), keeping recast consistent with the shop's letter economy.
- **Cost:** new `config.SHOP.cost.recastTile` (tunable; starting point in line with `enchantTile`).

### 2b. Transfer (destroy-with-upside)

- **Offer:** a single generic offer `{ type: 'transferMods', cost }`.
- **Purchase:** `purchase(run, offer, { sourceTileId, targetTileId })` appends the **source** tile's
  mods onto the **target** tile, then removes the source from the bag. Errors: `no-target` if either
  tile is missing; `same-tile` if source === target.
- **Semantics:** all of source's mods move (append to target's mods); the source tile is destroyed
  (net bag size -1, same as `thinLetter`). If the source had no mods, it degrades to a plain thin
  (allowed; the UI guides toward modded sources). Bag-size safety matches `thinLetter` (no extra
  guard; the dead-hand rule + draw already handle small bags).
- **Cost:** new `config.SHOP.cost.transferMods` (tunable).

## 3. UI — generalize the shop picker to multi-step selects

Today the shop shows a **one-tile picker** for `enchantTile`/`thinLetter` (`needsTarget(offer)` in
`ui.js`, then `onBuy(offer, targetTileId)` → `purchase(run, offer, { targetTileId })`). SP2
generalizes this to collect a small, ordered set of selections, then calls
`onBuy(offer, opts)` with an **opts object** (a backward-compatible change: existing callers pass
`{ targetTileId }`).

- **Recast:** pick the target **tile** (existing tile-picker), then pick the target **letter** (a row
  of buttons from `buyableLetters`). Resolve with `{ targetTileId, targetLetter }`.
- **Transfer:** pick the **source** tile (destroyed), then the **target** tile (receives the mods).
  Resolve with `{ sourceTileId, targetTileId }`. Two tile-picks; the picker title guides each step
  ("Melt down which tile?" then "Move its mods onto which tile?").

This one picker generalization powers both tools. `main.js`'s `onBuy` changes from
`onBuy(offer, targetTileId)` to `onBuy(offer, opts)` and forwards `opts` to `purchase` verbatim
(mirroring how events pass `opts`). Render-only UI; no rules in the UI.

## 4. Legibility

Offer labels state the effect + cost inline (mirroring the existing shop labels and the Phase 2
"no surprise outcomes" rule): e.g. "Recast a tile to a letter you choose · $X", "Move a tile's mods
onto another (destroys it) · $X". The picker step titles name each choice. The existing tap-to-reveal
definitions already cover any mods involved.

## 5. Persistence (no schema bump)

Both tools mutate fields the save already serializes: a tile is stored as `{ id, letter, modIds }`, so
**Recast** (new `letter`) and **Transfer** (new `modIds` on the target, source tile removed) round-trip
with no new fields. **Schema stays at version 5.** (Verify the tile serialization shape in
`storage.js` at build time.)

## 6. Testing

`test/shop.test.js` (extend), tiny fixtures:
- **Recast:** changes the target tile's `letter`, **preserves `id` + `mods`**, deducts cost;
  `no-target` when the id is absent; `bad-letter` when `targetLetter` is outside `buyableLetters`;
  insufficient coins → `broke` (existing guard).
- **Transfer:** target gains the source's mods (appended), source is removed from the bag, cost
  deducted; `same-tile` when source === target; `no-target` when either id is absent.
- **Persistence:** a round-trip (serialize → deserialize) preserves a recast tile's new letter and a
  transfer target's moved mods (extend `test/storage.test.js` if the existing tile round-trip does not
  already cover a letter/mod change).
- **Harness** (`analyze:sim-v2`) re-run as a regression gate (the bot does not use these shop tools, so
  this confirms *no break*, not balance).

## 7. Decisions

| # | Decision | Value |
|---|---|---|
| T1 | Recast offer shape | Single generic `{type:'recastTile', cost}`; player picks tile + letter (free choice from `buyableLetters`) |
| T2 | Recast semantics | Change `tile.letter` only; **keep `id` + `mods`** |
| T3 | Transfer offer shape | Single generic `{type:'transferMods', cost}`; player picks source + target |
| T4 | Transfer semantics | Append source's mods to target, then remove source (net -1 tile); `same-tile` rejected |
| T5 | UI | Generalize the shop picker to multi-step selects; `onBuy(offer, opts)` forwards an opts object to `purchase` |
| T6 | Persistence | No schema bump (mutates existing `{id, letter, modIds}` serialization); stays v5 |
| T7 | Engine/scoring | Untouched (bag mutation only) |
| T8 | Costs / letter pool | `config.SHOP.cost.recastTile` + `.transferMods` (tunable, author-owned); recast letters = `buyableLetters` |

## 8. Out of scope (later)

A transform/destroy **event** (risk/reward variant); destroy-for-$ ("Smelt", the alternative the
author did not pick); recasting to letters outside the shop pool; transform that scales. The Phase 4
reskin renames Recast/Transfer into letterpress voice (e.g. resetting a sort, melting type).

## 9. Exit gate

Recast and Transfer are live shop tools: Recast changes a chosen tile's letter (keeping id + mods),
Transfer concentrates mods and destroys the source, both round-trip through a save, tests prove the
mutation + error semantics, and the harness confirms no regression. Author playtest then judges feel
and tunes the costs.
