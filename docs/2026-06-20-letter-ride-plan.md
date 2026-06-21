# Letter Ride Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revised:** 2026-06-21 (v2 — matches the v2 design spec: tile instances, phase-ordered modifier engine, three currencies, full meta loop, Capacitor delivery).

**Goal:** Build *Letter Ride* — a letter-bag word-builder roguelike — in four playtest-gated
tiers: prove the base word/score loop is fun (Tier 0), then the in-run shop + modifier engine
(Tier 1), then the run-over-run meta loop (Tier 2), then ship it as an Android APK (Tier 3).

**Architecture:** Pure-logic ES modules (no DOM) hold all game rules and are unit-tested
headless with Node's built-in test runner. A thin `ui.js`/`main.js` layer renders to the DOM
and wires modules. All randomness flows through one seeded RNG. The dictionary and tile-values
are injected as parameters so tests use tiny fixtures, not the 170k-word list.

**Tech Stack:** Vanilla JavaScript (ES modules), HTML5, CSS. `node --test` (no test framework).
Static serving via `npx serve` for dev/playtest. No build step. Capacitor for the Tier 3 APK.

## Global Constraints

- **Scarcity pillar (non-negotiable):** letters are always *drawn from a bag*, never an open
  alphabet. If the player can use any letter freely, the economy is dead.
- **Scoring formula (phase-ordered):** `Points = Wit × Mult`. All `+Mult` deltas are summed
  into `(1 + ΣaddMult)`, then **all** `×Mult` deltas multiply that — regardless of the order
  modifiers were acquired or iterated. (Balatro order, enforced by the engine.)
- **Three currencies, no others:** **Points** (in-round score vs target), **Coins** (in-run
  shop), **Meta** (persistent, between-runs meta-shop). No hint/XP/energy currencies.
- **Minimum word length: 3.**
- **Tiles are instances:** `{ id, letter, mods }`. The bag holds `Tile[]`, never bare strings.
- **Determinism:** every random draw and shop roll uses the seeded RNG from `src/rng.js`. No
  `Math.random()` in logic (only for picking a run seed in `main.js`).
- **Tier discipline:** do NOT build a tier's features early, and do NOT build the Tier 4+
  deferred wishlist. Each tier must be playtested as fun before the next begins.
- **Dependency injection:** `dictionary` and `tileValues` are passed into functions, never
  imported as globals inside logic modules — this is what keeps them testable.

---

## File Structure

| File | Responsibility | Tier |
|---|---|---|
| `package.json` | `"type": "module"`, `test` + `serve` scripts. | 0 |
| `index.html` | Single page; loads `src/main.js`. | 0 |
| `src/config.js` | All tunable numbers. No logic. | 0 |
| `src/rng.js` | Seeded PRNG + `shuffle`. | 0 |
| `src/dictionary.js` | `makeDictionary(words)` → `{ isValid }`; `loadFromFile(path)`. | 0 |
| `src/tiles.js` | `makeTile(letter, mods)` w/ stable ids; tile-mod registry + `evaluate`. | 0 / 1 |
| `src/bag.js` | Bag state (`Tile[]`); `draw`, `add`, `remove`. | 0 |
| `src/word.js` | `validate(selection, dict, minLen)`; word string; wild resolution. | 0 |
| `src/patterns.js` | Cheap synergy predicates. | 1 |
| `src/scoring.js` | Phase engine: `scoreWord(selection, ctx)`. | 0 |
| `src/relics.js` | Relic registry + `evaluate`. | 1 |
| `src/shop.js` | In-run shop generation + 7 purchase types. | 1 |
| `src/run.js` | `RunState` machine: targets, plays, discards, coins, win/lose. | 0 |
| `src/meta.js` | `MetaState`: meta earn, meta-shop, decks, stakes, loadout, unlock pool. | 2 |
| `src/storage.js` | Serialize/restore `RunState` + `MetaState`. | 0 / 2 |
| `src/ui.js` | DOM render + tap-to-build + shop + meta-shop + tile-picker. | 0 |
| `src/main.js` | Boot, load dictionary, wire modules, meta→run→round state machine. | 0 |
| `test/*.test.js` | One test file per logic module. | all |
| `assets/enable1.txt` | ENABLE word list (downloaded in Task 0). | 0 |
| `capacitor.config.ts`, `android/` | APK packaging. | 3 |

---

# TIER 0 — The Spine

> **⚠️ Source of truth: the executable plan [`docs/2026-06-21-letter-ride-tier0-plan.md`](2026-06-21-letter-ride-tier0-plan.md).**
> Tier 0 is fully detailed there (Tasks 0–9: complete test + implementation code, TDD steps).
> **Build from that plan, not from this overview** — where the two ever differ (e.g. RNG
> save/restore state, faithful resume), the executable plan wins. This section is the
> roadmap-level summary only, kept so the four tiers read end-to-end in one place.

**Deliverable:** a playable, resumable "tap words from a drawn rack vs. rising Points targets"
game — no shop, modifiers, or meta; plain tiles only.

**Modules built (detail in the executable plan):** `config`, `rng` (seeded + save/restore state),
`dictionary` (+ profanity blocklist), `tiles` (instances with round-trippable ids), `bag`,
`word` (tap-to-build), `scoring` (phase-ordered `Wit × Mult` engine), `run`, `storage` (faithful
save/resume — tiles, rack, and RNG state), and the `ui`/`main` layer.

🛑 **TIER 0 GATE — PLAYTEST BEFORE CONTINUING.** Narrowed to what Tier 0 can actually decide:
*is tap-to-build ergonomic on the phone (tap / backspace / wild-prompt / submit fluid), and can
you almost always form a 3+ word from a 9-tile rack (no dead-rack frustration)?* "Is it **deeply
fun**" is explicitly **deferred to the Tier 1 gate** — the modifier engine is what carries the
fun, and Tier 0 has none of it, so don't abandon on a flat-but-functional spine. If you lose on
raw target size rather than dissatisfaction, lower `TIER0_TARGETS` (a tuning miss, not a mechanic
failure). See the executable plan's gate for the full checklist.

---

# TIER 1 — The In-Run Roguelike Layer

**Deliverable:** the core roguelike — Coins, the 7-offer shop, 8 relics, 4 tile-mods, wild tiles,
synergies. Lighter task grain on purpose: tuning is informed by Tier 0 playtesting. Same TDD
rhythm. Switch the run to `ROUND_TARGETS`.

### Task 10: Coins on round clear
- [ ] Add `awardCoins(run)` = `base + perUnusedPlay*playsLeft + perUnusedDiscard*discardsLeft
  + Σ run.relics.map(r => r.coinsOnRoundClear?.(run) ?? 0)`, called when `status` becomes
  `roundCleared`. The relic term is **0 in Tier 0** (`run.relics` is empty) — it's the hook
  Recycler plugs into in Task 12, written in now so economy relics are never no-ops.
- [ ] Test: clear with 1 play + 1 discard left, no relics → +6.
- [ ] Commit `feat: award coins on round clear (with relic round-clear hook)`.

### Task 11: Pattern/synergy predicates
**Files:** Create `src/patterns.js`, `test/patterns.test.js`.
- [ ] Pure helpers over a word/letters: `hasDigraph(w, ['TH','QU',...])`, `hasDoubledLetter(w)`,
  `isPalindrome(w)`, `endsWith(w, suffix)`, `countOf(letters, ch)`. Unit-test each.
- [ ] Commit `feat: pattern/synergy predicates`.

### Task 11a: Short-word competitiveness analysis harness (makes the design's soul measurable)
**Files:** Create `scripts/analyze-builds.js` (a headless node script, not a unit test).
**Why:** the scoring engine is pure + deterministic, so "can a clever short word beat a long
word?" is computable, not a vibe. This script is the instrument the Tier 1 gate reads.
- [ ] Over N seeded racks, compute the best-scoring **long-word** play (no relics) vs. the
  best-scoring **3-letter** play under a Short&Sweet + chip-mod build, using `scoreWord` directly.
  Report: median per-play Points for each, the short/long ratio, and whether the short build can
  reach round 5's `ROUND_TARGETS` value within `PLAYS_PER_ROUND`.
- [ ] Print a one-screen summary (no assertions — it's a tuning instrument the author runs while
  balancing). Commit `chore: short-word competitiveness analysis harness`.

### Task 12: Relic engine + 8 relics
**Files:** Create `src/relics.js`, `test/relics.test.js`. (Scoring already calls `relic.evaluate(ctx)`.)
**Interface:** each relic `{ id, name, desc, evaluate(ctx) -> { addWit?, addMult?, timesMult? } }`.
- [ ] Implement, each with a unit test asserting its delta on a fixed word:
  `vowelBonus` (+2 Wit/vowel), `rareHoarder` (+30 Wit if J/Q/X/Z), `shortAndSweet`
  (×3 Mult if len ≤3), `lengthy` (+1 Mult per letter beyond 4), `doubleTrouble` (+40 Wit if
  doubled letter), `freshStart` (+2 Mult if first letter is a vowel), `comboCounter` (+1 Mult
  per `ctx.wordsPlayedThisRound`), `recycler` (economy — exposes `coinsOnRoundClear(run) = 2 *
  run.playsLeft`, which `awardCoins` already sums (Task 10); it has **no** `evaluate`/`onScore`).
- [ ] Add a `run.test.js` assertion: owning `recycler` and clearing a round with 2 unused plays
  adds +4 Coins beyond the base award (proves the Task 10 hook is wired, not a no-op).
- [ ] A `RELICS` registry keyed by id (for shop + rehydration).
- [ ] **Extend `storage.js` for relics** (closes the Tier-0 deferral): `serializeRun` writes
  `run.relics.map(r => r.id)`; `deserializeRun` maps saved ids back via `RELICS[id]`. Add a
  storage round-trip test: an owned relic survives save→load with a working `evaluate()`.
- [ ] Commit `feat: relic engine + 8 starter relics (+ relic persistence)`.

### Task 13: Tile-mods + 4 mods + WILD tiles
**Files:** Modify `src/tiles.js`; add `test/tiles.mods.test.js`.
**Interface:** each tile-mod `{ id, name, desc, evaluate(tile, ctx) -> { addWit?, addMult?, timesMult? } }`,
registered so `getMod(id)` rehydrates after load.
- [ ] Implement: `resonator` (+5 Wit if `countOf(ctx.letters, tile.letter) >= 2`), `polished`
  (+4 Wit always), `catalyst` (+1 Mult always), `anchor` (+8 Wit if tile is `ctx.selection[0].tile`).
  Unit-test each via `scoreWord` with a tile carrying the mod.
- [ ] WILD: `makeTile('*')`; confirm `scoreWord` gives it 0 base Wit while its mods still apply;
  test a wild resolved to a letter contributes to synergies but not base Wit.
- [ ] Commit `feat: tile-mods (4) and wild tiles`.

### Task 14: In-run shop (7 offers)
**Files:** Create `src/shop.js`, `test/shop.test.js`.
**Interface:**
- `generateShop(run, rng) -> { offers: Offer[], rerollCost }`, Offer ∈
  `buyLetter{letter,cost}` | `buyEnchantedTile{letter,modId,cost}` | `enchantTile{modId,cost}` |
  `upgradeLetter{letter,plus,cost}` | `thinLetter{letter,cost}` | `buyRelic{relicId,cost}`.
  (Relic offers drawn from the **unlocked** pool — all unlocked in Tier 1; gated in Tier 2.)
- `purchase(run, offer, opts) -> { ok, reason? }` — checks `run.coins`; applies:
  `buyLetter`→`bag.add(makeTile(letter))`; `buyEnchantedTile`→`bag.add(makeTile(letter,[getMod(modId)]))`;
  `enchantTile`→push `getMod(modId)` onto `opts.targetTile.mods`; `upgradeLetter`→`run.tileValues[letter]+=plus`;
  `thinLetter`→`bag.remove(opts.targetTileId)`; `buyRelic`→`run.relics.push(RELICS[relicId])`. Deduct cost.
- [ ] Tests: enough coins → effect applied + cost deducted; not enough → `reason:'broke'`;
  `thinLetter` reduces bag count; `upgradeLetter` raises `tileValues`; `enchantTile` adds a mod.
- [ ] Commit `feat: in-run shop generation + 7 purchase types`.

### Task 15: Wire Tier 1 into the loop + UI
**Files:** Modify `src/main.js`, `src/ui.js`.
- [ ] After a round clears: `awardCoins`, `generateShop`, render a shop screen (offers as buttons
  with cost; reroll; continue → `nextRound` + draw). `enchantTile`/`thinLetter` open the
  **tile-picker** (choose which owned tile). Render active relics, coins, and tile-mod badges
  during play. Save after every change.
- [ ] Manual verification: full run on `ROUND_TARGETS` — clear, earn coins, buy/enchant/upgrade/thin,
  see scoring change, win or lose across 8 rounds.
- [ ] Commit `feat: Tier 1 vertical slice — shop + relics + tile-mods in the loop`.

> **🛑 TIER 1 GATE.** Several full runs on the **real `ROUND_TARGETS` curve** (first tier it's
> playable — confirm the difficulty ramp is tense-but-fair; this is where target tuning happens).
> Do builds meaningfully diverge? Does enchant-vs-dilute feel like a real decision? **Short-word
> bar (measurable):** run `scripts/analyze-builds.js` (Task 11a) — a 3-letter Short&Sweet+chip
> build should reach **≥80% of the median long-word per-play Points** and be able to clear round 5.
> Tune relic/mod numbers toward that bar — the anti-vocabulary-gatekeeping goal. **If short words
> can't be made competitive after tuning, surface it as a design failure, don't paper over it.**

---

# TIER 2 — Meta-Progression

**Deliverable:** the run-over-run loop. Build only after Tier 1 is fun.

### Task 16: MetaState + persistence
**Files:** Create `src/meta.js`; extend `src/storage.js`, `test/storage.test.js`.
- [ ] `makeMetaState() -> { meta:0, unlockedRelics:Set, unlockedMods:Set, unlockedDecks:Set,
  unlockedStakes:Set, loadout:{} }` with a base set unlocked. `saveMeta`/`loadMeta` to a
  `'letterRide.meta'` key (separate from the run key). Test round-trip.
- [ ] Commit `feat: persistent MetaState`.

### Task 17: Meta earn at run end
**Files:** Modify `src/run.js`/`src/meta.js`; tests.
- [ ] `metaEarned(run) = roundsCleared * META_EARN.perRoundCleared + (won ? winBonus : 0)`;
  applied to `MetaState.meta` at run end (win OR loss). Test both paths.
- [ ] Commit `feat: meta currency earned at run end`.

### Task 18: Meta-shop — content unlocks + difficulty stakes
**Files:** `src/meta.js`, `test/meta.test.js`.
- [ ] `metaShopOffers(metaState)` → unlock offers for locked relics/mods/wilds + stake unlocks;
  `purchaseMeta(metaState, offer)` flips the unlock flag and deducts Meta (`reason:'broke'` if short).
- [ ] The in-run shop's relic/mod pool now reads `MetaState.unlocked*`. Stakes modify a run's
  `targets`/plays/shop at `newRun`. Tests for unlock gating + stake application.
- [ ] Commit `feat: meta-shop content unlocks + difficulty stakes`.

### Task 19: Meta-shop — decks + loadout upgrades
**Files:** `src/meta.js`, `test/meta.test.js`.
- [ ] Decks = named starting bags / rule twists; unlock + select at run start (`newRun({deck})`).
  Loadout upgrades (small, few): `+1 discard`, `+1 reroll`, better starting bag, `startRelic`;
  applied in `newRun({loadout})`. Tests: a deck changes the starting bag; a loadout boost
  changes starting `discardsLeft`/relics.
- [ ] Commit `feat: meta-shop decks + loadout upgrades`.

### Task 20: Wire the meta screen + run start
**Files:** Modify `src/main.js`, `src/ui.js`.
- [ ] Title screen = meta-shop (spend Meta on the four categories) + deck/stake pickers + "Start
  Run". Run end → compute + show Meta earned → return to meta screen. Persist `MetaState`.
- [ ] Manual verification: lose/win a run, earn Meta, unlock content + a stake + a deck + a loadout,
  start a new run reflecting them.
- [ ] Commit `feat: Tier 2 meta-progression loop wired into UI`.

> **🛑 TIER 2 GATE.** Gate on **content unlocks (Task 18) alone first** — that's the cheapest,
> safest category and it's enough to answer the core hypothesis: *does clearing/losing a run make
> you want to start another?* Build decks + loadout (Task 19) only if the loop already pulls. Is
> Meta paced right (fast enough to reward, slow enough to keep unlocks meaningful)? Do loadout
> upgrades trivialize anything? **If runs don't create pull, stop and reconsider before adding
> more meta surface.** Author's playtest call.

---

# TIER 3 — Delivery (Android APK via Capacitor)

**Deliverable:** an installable APK. Build only after Tier 2 is fun. **Prerequisites:** Android
Studio + JDK on the Mac, an Android SDK, and (for device installs) a connected phone or emulator.

### Task 21: Capacitor packaging
- [ ] Add Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`); `npx cap init`;
  set `webDir` to the static root; `npx cap add android`.
- [ ] Fix the dictionary load for the WebView origin (bundled asset served at the app's local
  origin — verify `loadFromFile('assets/enable1.txt')` resolves under Capacitor; adjust path if needed).
- [ ] Confirm `localStorage` persists in the WebView (it does) so save/resume + Meta survive.
- [ ] `npx cap sync`; build + run on device/emulator. Verify a full session: meta-shop → run →
  shop → win/lose → meta earned, all on-device.
- [ ] Commit `feat: Capacitor Android packaging`.

---

## Self-Review (plan author)

- **Spec coverage:** Tier 0 (core loop §3, phase scoring §4, tiles/bag/rack §5, save/resume) →
  the executable plan `2026-06-21-letter-ride-tier0-plan.md` (Tasks 0–9, self-reviewed there);
  modifiers §6 → Tasks 11/12/13; three currencies §7 → Tasks 10/16/17 (Points/Coins in Tier 0–1,
  Meta in Tier 2); in-run shop §8 → Task 14; meta-progression §9 → Tasks 16–20; tiers §10 → tier
  ordering + 🛑 gates; architecture §11 → File Structure + per-task files; risks §12 → gates +
  watch-list (balance flagged as playtest-only); open decisions §13 → `CONFIG`.
- **Phase-order fix verified by a test** (Task 6) — the v1 acquisition-order bug cannot recur.
- **Signature stability (provisional):** `scoreWord(selection, {tileValues, lengthBonusPerLetter,
  relics, context})` is fixed in Task 6 and *intended* to remain stable through Tiers 1–2 — but
  it's only exercised by fakes until Tier 1 builds real mods/wilds. The Tier 1 gate may
  legitimately reprice or reshape scoring (e.g. for Short & Sweet), and that's expected, not a
  regression. `relic.evaluate(ctx)` and `tileMod.evaluate(tile, ctx)` share the delta shape;
  `RunState`/`MetaState` fields are defined where introduced and reused unchanged.
- **Two state layers from day one** (Task 7 `RunState`, Task 16 `MetaState`); save keys are
  distinct (`letterRide.run` vs `letterRide.meta`).
- **Tier discipline:** no Tier 1+ feature appears in Tier 0 tasks; Tier 4+ wishlist excluded.
