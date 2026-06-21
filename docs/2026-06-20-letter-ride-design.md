# Letter Ride — Design Spec

**Date:** 2026-06-20 · **Revised:** 2026-06-21 (v2 — major scope expansion, author-approved)
**Status:** Draft for review
**Type:** Word-builder roguelike (single-player, score-target) with run-over-run meta-progression

> **v2 note.** v1 was a deliberately tiny vertical slice (one currency, no meta, plain
> letter tiles, "chips × mult"). The author has since expanded scope on purpose: tiles are
> now *enchantable instances*, scoring uses a phase-ordered modifier engine, there are
> **three currencies** including persistent **Meta**, and the game ships a full
> meta-progression loop and an Android (Capacitor) build. The tier discipline from v1 is
> retained and extended: each tier is built and **playtested as fun before the next**.

---

## 1. One-paragraph pitch

*Letter Ride* is a single-player, turn-based word-builder roguelike in the Balatro mould.
You build a **bag of letter tiles** (your "deck"), draw a small **rack** each turn, and tap
tiles to spell the highest-scoring word you can. Beat a rising **Points** target each round
to survive; spend **Coins** between rounds in a **shop** to buy, enchant, upgrade, and thin
tiles and collect **relics** that warp scoring. Across runs you earn **Meta** currency and
spend it in a between-runs **meta-shop** that unlocks content, decks, difficulty stakes, and
permanent loadout boosts. The fun is not "know big words" — it's **building a letter economy
and a modifier engine** that makes even short words explode in score. No opponent: you play
against a number, then against your own mastery.

---

## 2. Why this design (decisions locked)

- **Word-*builder*, not Wordle.** You choose the word, so *playing well and scoring well are
  the same act* — no deduction-vs-scoring tension.
- **Your tiles ARE your deck, and tiles are instances.** A tile is `{ id, letter, mods }`, not
  a bare letter. You can own three E's that score differently. This is the heart of the
  deckbuilding and the answer to "why do purchases matter."
- **Scarcity is the core pillar.** Letters are *drawn from a bag you build*, never an open
  alphabet. Bag composition is the deckbuilding. **Non-negotiable.**
- **One scoring formula, phase-ordered.** `Points = Wit × Mult`, with all `+Mult` applied
  before any `×Mult` (Balatro order), enforced by the engine regardless of acquisition order.
- **Relics + tile-mods are the skill expression**, decoupling success from raw vocabulary. A
  clever short word with the right modifiers must be able to beat a long word without them.
- **Three currencies, each with a distinct job** (see §7): **Points** (in-round score),
  **Coins** (in-run shop), **Meta** (persistent, between-runs meta-shop).
- **Solo vs. a target, then vs. mastery.** No enemy AI. The meta loop supplies long-term pull.
- **Stack:** HTML5 + vanilla JS, no build step. **Android via Capacitor** is the delivery
  target (Tier 3), not abandoned — but built last, after the game is proven fun.
- **Input: tap-to-build.** You tap specific tile instances to assemble the word. This makes
  "which tile (and which mod) fired" exact, and removes the "unformable word" failure path.

---

## 3. Core loop

```
META SCREEN (title)
  ├─ spend META in the meta-shop (unlocks, decks, stakes, loadout)
  └─► START RUN (pick deck + stake; seed)
        └─► ROUND (a "blind" with a Points target)
              repeat up to K plays, or until target met:
                1. Draw a RACK of N tiles from your BAG
                2. Tap tiles to form one valid word (min length 3)
                3. Score it (Wit × Mult = Points) → add to round total
                4. (optional) discard the rack and redraw, limited times
              ├─ target met  → earn COINS → in-run SHOP → next round (higher target)
              └─ plays used, target NOT met → RUN OVER
        └─► Clear all rounds → WIN the run
  └─► RUN END (win or loss) → earn META (by rounds cleared + win bonus) → back to META SCREEN
```

A run is a **linear** sequence of rounds (no branching map — deferred). Short and snackable:
~8 rounds ≈ one phone sitting. The meta loop is what makes you start run #2.

---

## 4. Scoring — the phase-ordered modifier engine

For each word played, the engine evaluates three explicit phases. **Order is enforced by the
engine, not by the order modifiers were acquired** — this is the central v1 bug fix.

```
context = {
  word,                       // the string
  tiles,                      // the Tile[] the player tapped (with their mods)
  letters,                    // tiles.map(resolvedLetter)  (wild → chosen letter)
  wordsPlayedThisRound,       // for escalation modifiers
  roundIndex, stake, ...      // any other state modifiers may read
}

PHASE 1 — WIT (additive base):
  wit  = Σ witValue(tile)                          // base tile value; WILD = 0
       + lengthBonus(word.length)                  // +W per letter beyond 3
       + Σ relic.addWit(context)                   // global relics
       + Σ tileMod.addWit(tile, context)           // mods on tiles actually played

PHASE 2 — +MULT (additive multiplier):
  mult = 1
       + Σ relic.addMult(context)
       + Σ tileMod.addMult(tile, context)

PHASE 3 — ×MULT (multiplicative multiplier, applied LAST):
  mult = mult × Π relic.timesMult(context)
              × Π tileMod.timesMult(tile, context)

Points = wit × mult
roundTotal += Points
```

- **Base tile values** (`config`, tunable): A E I O U L N S T R = 1; D G = 2; B C M P = 3;
  F H V W Y = 4; K = 5; J X = 8; Q Z = 10. **WILD `*` = 0** (it is a flexibility tool, never
  strictly better than a real letter).
- **lengthBonus** (config): `+5 × (len − 3)`, min 0.
- **"Multipliers on multipliers"** come for free: multiple `×Mult` modifiers compound in
  Phase 3. **Scaling** modifiers (gain Mult per word/round) are content built on a small
  amount of per-modifier state (see §6), not an engine change.
- A modifier is a plain object returning **deltas** (`{ addWit?, addMult?, timesMult? }`) for
  a context. It never mutates shared score state directly. This is what makes phase order
  enforceable and every modifier independently unit-testable.

---

## 5. Tiles, the bag & the rack

- A **Tile** is `{ id, letter, mods: TileMod[] }`. `id` is stable and **preserved across
  save/load** — tiles are rehydrated with their saved id, never regenerated, and the id
  generator is advanced past the highest restored id so new purchases can't collide. (In-flight
  references like a pending `thinLetter(targetTileId)` or an open tile-picker depend on this.)
- **Starting bag (26 tiles, config, tunable):**
  `A A A E E E I I O O U` (11 vowels) + `R S T L N D C M B P G H F Y K` (15 consonants).
  All plain (no mods) at the start of a default run. Must keep a playable vowel ratio so
  racks are nearly always spell-able. (A *deck* unlock can change this — see §8.)
- **Draw:** each play, shuffle the bag and draw **N = 9** tiles → the rack. The bag is **not
  consumed** — racks are an i.i.d. sample of your bag's composition per play. Bag composition
  *is* the probability distribution of your racks; that's what you optimize.
- **Form a word (tap-to-build):** tap rack tiles in order to assemble the word; backspace /
  clear / submit. You can only build from tiles you hold, so there is no "unformable" error.
  Minimum length **3**.
- **WILD tiles:** a tile with `letter:'*'`. Tapping a wild prompts a letter choice; the chosen
  letter is used for dictionary validation and letter-based synergies, but the wild adds **0
  Wit**. Mods on the wild still apply.
- **Discards:** up to **2 redraws per round** (à la Balatro discards) — discard the current
  rack and draw fresh without scoring.

---

## 6. Modifiers — one engine, three trigger scopes

Relics and tile-mods are the *same kind of thing*: a modifier that contributes phase deltas
for a context. They differ only in **when** they fire:

- **Relics** — fire **globally** on every word (subject to their own condition).
- **Tile-mods** — fire **only when their tile is in the played word**.
- **Scaling** (a flag on either) — carry mutable per-modifier state updated by light hooks
  (`onWordPlayed`, `onRoundStart`) so a modifier can *grow* (e.g. "+1 Mult each word this
  run"). Kept tiny and explicit.
- **Economy / round-clear** — some modifiers (e.g. Recycler) don't touch scoring at all; they
  contribute **Coins** via a round-clear hook applied in `awardCoins`, *not* the `scoreWord`
  engine. `awardCoins` sums these hooks from day one so an economy relic is never a no-op.

**Pattern/shape synergies** are the *conditions* modifiers test (cheap string ops, no extra
data): contains a digraph (TH/QU/CH), a doubled letter (LL), a palindrome, a suffix
(-ING/-ED/-S as cheap proxies for word-type), `≥2` of a given letter, all-but-one-vowel, etc.
True part-of-speech detection is **deferred** (needs a tagged dictionary).

**Starter relics (8)** — global modifiers seeding divergent builds:

| # | Relic | Effect | Build |
|---|---|---|---|
| 1 | Vowel Bonus | +2 Wit per vowel used | Vowel-heavy |
| 2 | Rare Hoarder | +30 Wit if word uses J/Q/X/Z | Rare-letter |
| 3 | Short & Sweet | words ≤3 letters: ×3 Mult | **Short-word (anti-vocab)** |
| 4 | Lengthy | +1 Mult per letter beyond 4 | Long-word |
| 5 | Double Trouble | +40 Wit if word has a doubled letter | Pattern |
| 6 | Fresh Start | word starting with a vowel: +2 Mult | Conditional |
| 7 | Combo Counter | +1 Mult per word already played this round | Escalation |
| 8 | Recycler | +2 Coins per unused play at round end (economy) | Economy |

**Starter tile-mods (4)** — attached to specific tiles, fire when that tile is played:

| Mod | Effect (when the tile is used) | Build |
|---|---|---|
| Resonator | +5 Wit if the word has 2+ of this tile's letter | Letter-stacking |
| Polished | +4 Wit, always | Reliable value |
| Catalyst | +1 Mult, always | Mult engine |
| Anchor | +8 Wit if this tile is the word's first letter | Positional |

All numbers above are **tunable in `config`** and are explicitly *not* claimed balanced —
balance is the author's playtest job (see §11).

---

## 7. The three currencies

| Currency | Earned | Spent on | Scope | Persists? |
|---|---|---|---|---|
| **Points** | scoring words (`Wit × Mult`) | nothing — raced against the round **Target** | per round | no (resets each round) |
| **Coins** | clearing a round: `4 + unusedPlays + unusedDiscards` (+ Recycler) | the **in-run shop** (§8) | per run | no (resets each run) |
| **Meta** | run end: `roundsCleared × A + (won ? winBonus : 0)` | the **meta-shop** (§9) | account | **yes** (localStorage) |

Points and Coins were already distinct in v1; **Meta** is the new persistent third currency
and the reason the meta loop exists. All earn formulas are tunable in `config`.

---

## 8. The in-run shop (Coins) — 7 offer types

Generated from a seeded RNG between rounds; offers a random subset each time.

| Offer | Effect |
|---|---|
| `buyLetter` | Add one plain tile to the bag. |
| `buyEnchantedTile` | Add one tile that already carries a mod (letter + mod bundled). |
| `enchantTile` | Attach a mod to one of your **existing** tiles (opens a tile-picker). |
| `upgradeLetter` | +N base Wit to **all** tiles of one letter (type-wide). |
| `thinLetter` | Remove one tile from the bag (concentrates the rest). |
| `buyRelic` | Add a relic from the currently-unlocked pool. |
| `reroll` | Reroll the shop offers (small Coin cost). |

**The economy's built-in governor (enchant-vs-dilute):** every tile added enlarges the bag,
so each tile — including your good ones — appears in fewer racks. You cannot stuff the bag
with power without wrecking your draw consistency. `thinLetter` is the counter-pressure.
That tension is the deckbuilding decision, and it's what makes individual purchases matter
despite the bag being a probability distribution.

`buyEnchantedTile` + `enchantTile` (both, per author) and `upgradeLetter` + per-tile mods
(both overlapping chip axes, per author) are deliberately kept — their interaction is a
flagged balance watch-item (§11), not a pre-solved one.

---

## 9. Meta-progression (Meta) — the run-over-run loop

The title screen **is** the meta-shop. You spend Meta, then choose a deck + stake and start a
run. `MetaState` is persisted in localStorage, **fully separate** from per-run `RunState`.

**Earn:** at run end, `meta = roundsCleared × A + (won ? winBonus : 0)` (tunable).

**Spend (all four categories, per author):**

1. **Content unlocks (variety, safest):** permanently add specific relics / tile-mods /
   wild tiles to the pool the in-run shop can offer. The game ships with a base pool unlocked
   and the rest locked behind Meta.
2. **Difficulty stakes (longevity, cheap):** unlock harder modes — higher targets, fewer
   plays, costlier/nastier shops. Chosen at run start; higher stakes pay more Meta.
3. **New decks / starting bags (replayability):** unlock alternate starting bags or
   rule-twist "decks" (e.g. vowel-light, all-doubled, rare-rich), selectable at run start.
4. **Loadout upgrades (power — the balance trap):** permanent run-start boosts (+1 discard,
   +1 reroll, better starting bag, begin with a chosen relic). Kept **small and few** so they
   can't trivialize the game or gate difficulty behind grind. On the watch-list.

**Unlock model:** content/decks/stakes are one-time purchases that flip a flag in `MetaState`.
Loadout upgrades are owned permanently and applied at `newRun`.

---

## 10. Build tiers (scope discipline — build and PLAYTEST in this order)

Each tier is independently playable and gated by a 🛑 fun-check. **Do not start a tier until
the previous one is proven fun.** If Tier 0 is flat, nothing above saves it.

- **Tier 0 — Spine.** Tile instances (plain), bag + draw rack, dictionary validation,
  tap-to-build word formation, the `Wit × Mult = Points` phase engine (no mods yet), round
  **Tier-0 target curve**, K plays, discards, advance/lose, linear run, **localStorage
  save/resume**. *No shop, no relics, no mods, no meta.*
  🛑 **Gate:** narrowed to what Tier 0 can decide — *(1) is tap-to-build ergonomic on the phone
  (tap / backspace / wild-prompt / submit fluid), and (2) can you almost always form a 3+ word
  from a 9-tile rack (no dead-rack frustration)?* **"Is it deeply fun" is deferred to the Tier 1
  gate** — the modifier engine carries the fun and Tier 0 has none of it, so a flat-but-functional
  spine is expected, not a reason to abandon. Tier 0 uses gentle `TIER0_TARGETS` (validates the
  mechanic, not the ramp; `ROUND_TARGETS` tuning is gated at Tier 1). If you lose on raw target
  size, lower `TIER0_TARGETS` (a tuning miss, not a mechanic failure). **Only STOP if tap-to-build
  itself feels bad after honest tuning.**

- **Tier 1 — In-run roguelike.** Coins, the 7-offer shop, the 8 relics, the 4 tile-mods,
  WILD tiles, scaling/conditional mults, pattern synergies. **The core deliverable.**
  🛑 **Gate:** *Do builds diverge? Does enchant-vs-dilute feel like a real decision? Is the real
  `ROUND_TARGETS` difficulty ramp tense-but-fair (first tier it's playable)?* **Short-word
  criterion (measurable — the design's soul):** via the headless analysis harness (plan Task
  11a), a 3-letter Short&Sweet+chip build must reach **≥80% of the median long-word build's
  per-play Points across N seeded racks** and be able to clear round 5. **If short words can't be
  made competitive after tuning, surface it as a design failure — don't paper over it.**

- **Tier 2 — Meta-progression.** Meta currency earn, `MetaState` persistence, the meta-shop
  with all four spend categories, decks, stakes, loadout.
  🛑 **Gate:** *Does clearing/losing a run make you want to start another?* Gate this on
  **content unlocks alone first** (cheapest, safest category); build decks + loadout only if the
  loop already pulls. **If runs don't create pull, stop and reconsider before adding meta surface.**

- **Tier 3 — Delivery.** Capacitor APK packaging (asset path for the bundled dictionary, build,
  run on device). Dev-server-over-Wi-Fi is the playtest vehicle through Tiers 0–2.

**Deferred wishlist (Tier 4+, do NOT build yet):** leveled alphabet / letter XP; achievements;
variable word length as a stake; branching run map; boss rounds with constraints; true
part-of-speech synergies; rare-letter *tiers* beyond the J/Q/X/Z values already present.

---

## 11. Architecture (modules)

Strict logic/UI split. All rules live in pure, DOM-free modules, unit-tested headless with
`node --test`. `dictionary` and `tileValues` are **injected**, never imported as globals.

| File | Responsibility |
|---|---|
| `src/config.js` | Every tunable number (tile values, N, K, targets, costs, earn formulas). No logic. |
| `src/rng.js` | Seeded PRNG + `shuffle`. |
| `src/dictionary.js` | `makeDictionary(words)` → `{ isValid }`; `loadFromFile(path)`. |
| `src/tiles.js` | `makeTile(letter, mods)` w/ stable ids; tile-mod definitions + their `evaluate`. |
| `src/bag.js` | Bag state (`Tile[]`); `draw(n, rng)`, `add(tile)`, `remove(tileId)`. |
| `src/word.js` | `validate(tiles, dict, minLen)`; wild resolution; word string from tapped tiles. |
| `src/patterns.js` | Cheap synergy predicates (digraph, doubled, palindrome, suffix, countOf). |
| `src/scoring.js` | The phase engine: `scoreWord(playedTiles, ctx)` → `{ wit, mult, points }`. |
| `src/relics.js` | Relic definitions + their `evaluate`. |
| `src/shop.js` | In-run shop generation + 7 purchase types. |
| `src/run.js` | Run/round state machine (`RunState`): targets, plays, discards, coins, win/lose. |
| `src/meta.js` | `MetaState`: meta earn, meta-shop generation + purchases, decks, stakes, loadout, unlock pool. |
| `src/storage.js` | Serialize/restore `RunState` (bag tiles by **saved id** + letter + modIds, **`tileValues` upgrades, owned relics by id**, round/coins/totals/stake/deck) + `MetaState`. Tile ids preserved, not regenerated. |
| `src/ui.js` | Render rack/score/shop/meta-shop; tap-to-build input; tile-picker. |
| `src/main.js` | Boot, load dictionary, wire modules, drive meta→run→round state machine. |
| `capacitor.config.*`, `android/` | Tier 3 packaging. |

- **Two state layers from day one:** `RunState` (bag, coins, relics, tiles, round, points,
  seed, stake, deck) vs `MetaState` (meta currency, unlocked content/decks/stakes, owned
  loadout). The split exists in Tier 0; the meta *content* lands in Tier 2.
- **Determinism:** seeded RNG for all bag draws and shop generation → reproducible, testable
  runs. No `Math.random()` in logic (only acceptable for picking a run seed in `main.js`).
- **Dictionary:** bundle ENABLE (~170k words) as a Set for O(1) lookup. Min length 3.

---

## 12. Known risks & playtest watch-list (eyes open)

**Resolved in v2:**
- *Phase-order scoring bug* (v1's single-pass mutation) — fixed by the §4 phase engine.
- *Marginal purchases* — reframed: per-tile mods + enchant-vs-dilute make each purchase a
  real decision.
- *"Play it on my Android" gap* — Tier 3 ships a real APK.

**Playtest-only (the author's call — NOT pre-solved, per the project's working agreement):**
- **Short-word competitiveness** — the design's soul. A stacked 3-letter word must be able to
  beat a bare 7-letter word. Current numbers probably don't achieve it; Short & Sweet may need
  a bigger ×Mult or a flat-Wit injection. **The Tier 1 gate tests this with a concrete bar
  (≥80% of median long-word per-play Points across N seeded racks + can clear round 5), computed
  by a small headless analysis harness — see plan Task 11a.** This converts the soul from a
  vibe-check into a number to tune against.
- **Enchant-vs-dilute** — is adding power-tiles a satisfying tradeoff, or does dilution feel
  bad? Levers: starting bag size, thin cost, enchant cost.
- **Overlapping chip axes** — `upgradeLetter` (type-wide) vs. `Polished`/per-tile flat Wit:
  ensure one doesn't dominate the other.
- **Wild abuse** — 0-Wit keeps wilds honest, but flag if wild + mod stacking degenerates.
- **E-stacking** — Resonator + "more-of-this-letter" + buying many enchanted E's; tune the
  threshold and cost.
- **Loadout power-creep** — the meta trap. Keep boosts small; watch for trivialization.
- **Meta earn/spend balance** — Meta must arrive fast enough to feel rewarding, slow enough
  that unlocks stay meaningful. Stake pricing too.
- **Low variance / low tension** — non-consuming draws + a 9-tile rack rarely spike. Fine for
  a chill game; flag if more white-knuckle moments are wanted.
- **Dictionary edge cases** — obscure valid words, plurals. Mitigation: trusted list, min
  length, clear tap-to-build feedback.
- **Profanity (decision made, not a hand-wave):** ENABLE contains slurs and min-length-3 does
  NOT filter them. The dictionary applies a small **config blocklist** (`PROFANITY_BLOCKLIST`,
  default ON, one toggle to disable) so they don't validate as high-scoring words on the
  author's phone. *(Author may flip this off if undesired — it's a one-line config.)*

---

## 13. Open decisions / defaults (change any before/while planning)

Baked as defaults so the spec is buildable as-is:

1. **Plays per round (K):** 4.
2. **Rack size (N):** 9.
3. **Discards per round:** 2.
4. **Dictionary:** ENABLE (open, permissive).
5. **Run length:** 8 rounds.
6. **Tier-0 target curve** (flat, beatable from the base bag with no shop) vs **full curve**
   (assumes shop scaling) — two separate config arrays. Tier-0 is for the standalone Tier-0
   playtest; the full curve is the real run.
7. **Base term:** **Wit**. Multiplier term: **Mult**. Score term: **Points**.
8. **Meta earn `A` and `winBonus`, stake count, starter unlock pool size** — tunable, set
   during Tier 2 informed by Tier 0/1 playtests.
