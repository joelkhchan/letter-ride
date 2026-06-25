# Letter Ride — Achievements & Meta-Economy Design

**Date:** 2026-06-25
**Status:** Design banked. NOT scheduled for implementation. Achievements remain on the
spec's "Deferred wishlist (Tier 4+)"; this doc captures the decided shape and the open
tuning questions for when the roadmap reaches it. Do not pull forward of the tier order.
**Branch:** `worktree-achievements-meta`

---

## 1. Purpose

Add an **achievements** system that **pays out Meta currency** (the persistent between-runs
currency), framed as *competence feedback* rather than a checklist of chores. In the same pass,
fix two existing Meta-economy issues the research surfaced: the per-run difficulty multiplier
(an anti-pattern) and the flat-power loadout perks.

This stays inside the **three-currency rule** (Points / $ / Meta): achievements feed the
existing Meta sink, they do not introduce a new currency.

---

## 2. Background: current state

- **Achievements:** a stub only. A wired main-menu button and a "Coming soon" screen
  (`src/ui.js` `renderAchievements`) that already promises "achievements will award Meta to
  spend in the shop" and previews the Apprentice / Journeyman / Master Printer rank language.
  No data model, no unlock logic, no triggers.
- **Meta currency: fully live** (`src/meta.js`). Earns at run end
  (`perRoundCleared: 2` + `winBonus: 10`, times a stake `metaMult` of 1.0 / 1.5 / 2.0),
  persists to `localStorage` (`letterRide.meta`), and spends in a meta-shop on: unlock relics
  (15), mods (12), decks (20), stakes (10), and capped loadout perks.
- **Loadout perks (`config.LOADOUT`):** `extraDiscards` (+1 discard/round, max 2),
  `startCoins` (+5 starting $, max 2), `startRelic` (start with Vowel Bonus, max 1).
- **The Broadside (SP4 trophy card, `src/broadside.js`)** already surfaces candidate triggers:
  rank, passages cleared, best word + score, win/loss.
- **Telemetry (`src/telemetry.js`)** records dev-facing balance analytics (runs, wins, per-item,
  per-archetype, avg word length) at `recordPlay` / `recordRunEnd` call sites in `main.js`.
  This is anonymous aggregate analytics that is dev-only and freely resettable; the player-facing
  profile (Section 5.1) is a separate source of truth that must persist independently. Where a
  player-facing display overlaps a telemetry counter (e.g. total runs), the **profile** is
  authoritative; we do not derive player-facing numbers from the resettable telemetry store.
- **`src/stats.js`** is eval-harness statistics (Wilson / McNemar), unrelated to player stats.

---

## 3. Research basis (summary)

Two research sweeps grounded the decisions (full notes in session history). Key findings:

- **Horizontal unlocks preserve skill; permanent power erodes it.** The deck-roguelikes Letter
  Ride is modelled on (Balatro, Slay the Spire, Slice & Dice) deliberately have no spendable
  permanent-power meta-currency. The action-roguelites that sell permanent power (Rogue Legacy,
  Vampire Survivors) then need inflation brakes and create a "hardest at the start" curve.
- **Closest analog already chose the skill side:** GMTK's *Word Play* (a Balatro-style spelling
  roguelike) made progression linear not exponential, kept upgrades additive, and harshly
  restricted multipliers "to keep player skill at spelling central."
- **Pay for skill, opted-in difficulty, and build diversity. Never for grind or volume** (Hades
  "prophecies" model). The specific hazard of achievements-pay-currency is the **overjustification
  effect**: a fixed external reward bolted onto something already played for fun can crowd out
  intrinsic motivation (Deci 1971; 128-study meta-analysis). Mitigation: frame every payout as
  competence feedback, never a controlling instruction.
- **Word-game feats feel good when they are constraint-satisfaction in a small/known space**
  (pangram, 7-tile bingo, Q-without-U, clear-in-one-word), not vocabulary trivia. Avoid "spell a
  10-letter word" (rewards knowing a long word over building one).
- **Long tail as a legible grid, not a counter** (Balatro deck x stake sticker grid, lower tiers
  auto-granted so there is no wall of grey).
- **Pacing:** first unlock under one run, a playable spread in ~3-6 runs, bulk of content in
  ~15-30 runs, a deliberate 50+ completionist tail. Front-load cheap, taper steeply.
- **The one mechanism everyone says to avoid:** a per-run Meta payout *multiplier* that scales
  with difficulty (forces grinding a harder-than-fun stake to afford unlocks).
- **Count/craft:** ~20-35 is plenty for a small game; most achievements earnable in a single run;
  show progress bars (goal-gradient), a small endowed head start; a "personal best" stat is
  healthier than a dread-inducing daily streak.

---

## 4. Decisions (locked)

1. **Achievements pay Meta**, framed as competence feedback. Reward skill, build diversity, and
   opted-in difficulty; never pure grind or volume.
2. **Meta faucet = additive.** Keep the per-run drip (`perRoundCleared: 2` + `winBonus: 10`) as a
   guaranteed floor so no run feels wasted. Layer achievement payouts and difficulty bounties on
   top. Because the faucet grows, **raise `unlockCost` values** to hold the research pacing.
3. **Achievement set: four buckets, ~24-30 total**, weighted toward skill + diversity. No
   pure-grind counters in the *paid* set.
4. **Difficulty rewards = a stake x deck bounty grid** (Balatro-sticker style), one-time per cell,
   lower tiers auto-granted. This **replaces the deleted per-run stake `metaMult`** entirely.
5. **Loadout: keep `extraDiscards` only** (discard is an on-pillar anti-luck skill lever). **Cut
   `startCoins`** (flat economic power that compounds) **and `startRelic`** (flat power that also
   makes every run open the same, killing variety).
6. **Tracking: a rich lifetime stats store** (separate persisted profile). Powers discovery
   achievements and a personal-best display. The richness is for display + future surface; it does
   NOT license farmable grind achievements.

---

## 5. Architecture

**Approach: event-driven checking, hooked into the existing telemetry call sites.** `main.js`
already calls `recordPlay` and `recordRunEnd` at exactly the moments achievements care about. Add
achievement checks at those same points: per-play feats fire live (mid-run celebration), run-end
feats fire on the summary. Pure logic lives in new DOM-free modules. (Alternatives considered:
post-run-only checking, rejected for losing live feel and transient state; checks embedded in
`run.js`/`scoring.js`, rejected for breaking logic-module boundaries.)

### 5.0 Prerequisite run-state wiring (must exist before any predicate works)

The predicates in Section 6 read run/play state that the engine does **not** capture today. These
wiring additions are prerequisites, not implementation detail, and must land first:

- **`deckId` on the run.** Today `main.js` builds the run with `deck: { startingBag }` and strips
  the id, and `storage.js` serializes only that. The bounty-grid key `${stakeId}:${deckId}` and its
  lower-tier auto-grant have nothing to anchor on. Fix: thread the id through (`deck: { id: deckId,
  startingBag }`) and persist it in `storage.js` serialize/deserialize.
- **Run-scoped accumulators on the run object** (reset per run, persisted by `storage.js`):
  `boughtAnythingThisRun` (set at the shop-buy site), `discardedThisRun` (set in `discard`),
  `totalWordsThisRun` (incremented in `playWord`). Needed by "buying nothing", "without
  discarding", and "<= N words" feats; none are inferable from the current end state because
  `recordRunEnd` ctx is only `{ won, ownedIds }` and `discardsLeft` resets each round.
- **Extended achievements play-ctx** (a dedicated object, NOT the telemetry ctx, to avoid the
  telemetry aggregate classifier drifting): the existing
  `{ letters, word, selection, wordsPlayedThisRound, enablers }` plus `status`, `target`,
  `roundTotal`, `playsLeft`, and the **pre-play `roundTotal`** (to compute "from behind" for the
  clutch feat). All are available at the `recordPlay` call site because `playWord` mutates
  `status`/`playsLeft` before the call.
- **`metaMult` removal is a coupled code edit, not just a config delete.** It is read at exactly
  one runtime site (the `endRun` earned-Meta line in `main.js`); deleting it from `STAKES` requires
  dropping the `* metaMult` factor there too. (Removing it from config alone leaves a harmless but
  dead `|| 1` and a misleading intent.)

### 5.1 New modules (pure, DOM-free, dependency-injected, unit-tested)

**`src/achievements.js`** — catalog + checking logic.
- `ACHIEVEMENTS`: array of definitions, each `{ id, bucket, name, desc, predicate, metaReward }`.
  `bucket` in `{ onboarding, mastery, diversity, discovery }`. `metaReward` references a config
  value. `predicate` is a pure function of `(profile, ctx, config)`.
- `checkAchievements(profile, ctx, config)` returns the ids newly satisfied this event that are
  not already in `profile.completed`. No mutation; orchestration applies the award.
- Build-diversity predicates **reuse `src/archetypes.js`** (`ARCHETYPES[id].matches(ctx)` /
  `ALL_ARCHETYPE_IDS`); no new classification code.
- `ctx` is a dedicated achievements context (see 5.0), not the telemetry ctx.
- **Completeness predicates** (Curator "use every relic", Enchanter "every tile-mod") compare the
  profile's `relicsEverUsed` / `modsEverApplied` set against the **full roster id list injected at
  check time** (the roster can grow), never a snapshot. Once an id is in `profile.completed` it
  stays earned: the double-award guard means a later roster addition never un-completes it nor
  re-pays it.

**`src/profile.js`** — persisted player profile. Mirrors the `telemetry.js` / `meta.js` pattern
(storage injected, corruption-tolerant load, key `letterRide.profile`).
- Shape:
  ```js
  {
    stats: {            // lifetime totals + personal bests (display + discovery predicates)
      runs, wins, roundsCleared, wordsPlayed,
      bestWordScore, bestWord, bestRunScore,
      relicsEverUsed: [],   // set, for the Curator achievement
      modsEverApplied: [],  // set, for the Enchanter achievement
      // ... extend as catalog needs
    },
    completed: [],      // achievement ids
    bountyGrid: {},     // keyed `${stakeId}:${deckId}` -> true
  }
  ```
- `makeProfile()`, `loadProfile(storage)`, `saveProfile(profile, storage)`.
- Pure updaters: `recordPlay(profile, ctx)`, `recordRunEnd(profile, runSummary)`.

### 5.2 Reward flow (orchestrated in `main.js`)

When `checkAchievements` returns new ids: add each id to `profile.completed`, and
`metaState.meta += def.metaReward`. Two stores are touched (profile + meta), `main.js` is the only
place that wires them. UI shows an unlock toast + the existing Web Audio chime. Persist both stores
via the existing `saveAll()`.

### 5.3 Stake x deck bounty grid

- Lives in `profile.bountyGrid`, keyed `${stakeId}:${deckId}` (both ids must be present on the run
  at win time per the 5.0 wiring; `deckId` is not on the run today). On a run **win**, the
  `(stake, deck)` cell pays a one-time bounty (`config.BOUNTY` keyed by stake tier).
- **Lower-tier auto-grant:** winning stake N with deck D marks cells for all stakes `<= N` with
  deck D as granted; only the highest is surfaced in the UI. No wall of grey.
- This is the difficulty long-tail. It is the sole replacement for the removed per-run `metaMult`.

### 5.4 UI (`src/ui.js` renders, `src/main.js` orchestrates — no rules in UI)

- `renderAchievements()` becomes real: the four buckets, each row showing name, desc, Meta reward,
  completed/locked state, and a **progress bar** for partial achievements (goal-gradient; a small
  endowed head start where natural). The **bounty grid** as a stake x deck matrix. A
  **lifetime-stats / personal-best panel** (the healthy alternative to a streak).
- **Unlock celebration:** a short corner toast (queued so multiple unlocks do not collide) plus the
  existing SFX chime. Respect the existing mute toggle.
- **Operationalizing the competence-feedback framing** (the design's central mitigation against
  overjustification, turned into testable UI rules, not a slogan):
  1. The unlock toast **leads with the feat name + flavor** ("One and Done: a round in a single
     word"). The Meta amount is shown **secondary and muted**, as a byproduct, never the headline.
  2. **No achievement frames a Meta amount as a pre-shown target.** Progress bars show progress
     toward the *feat* ("3/5 relics used"), not "earn N Meta". The payout is revealed on
     completion, not advertised as the goal.
  3. The achievements screen groups by feat bucket (skill/diversity/etc.), not by payout size, so
     the player is not nudged to grind the highest-Meta entries.

### 5.5 Config changes (`src/config.js` — numbers only, no logic)

- **Remove** `metaMult` from each `STAKES` entry (the difficulty ladder stays; only the per-run
  multiplier is deleted).
- **`LOADOUT`:** remove `startCoins` and `startRelic`; keep `extraDiscards`. This is a coupled
  code change, not a config-only delete: `buildLoadout` reads `LOADOUT.startRelic.relicId` and
  `metaShopOffers` iterates `Object.keys(LOADOUT)`, so both must stop referencing the removed keys.
  See the migration step in 5.7 for the already-banked Meta spent on these.
- **Keep** `META.earn` drip (`perRoundCleared: 2`, `winBonus: 10`).
- **Add** `META.achievementReward` (per-bucket default payouts, overridable per achievement) and
  `META.bounty` (per-stake-tier grid reward).
- **Raise** `META.unlockCost` values to absorb the larger faucet, targeting the research pacing.

### 5.6 Tests

- `test/achievements.test.js`: predicates fire on the right context; payouts correct; no
  double-award (an id already in `completed` is never re-paid); lower-tier bounty auto-grant;
  completeness predicate against a roster that **grows after completion** (stays earned, never
  re-paid).
- `test/profile.test.js`: load/save round-trip; corruption tolerance; stat accumulation; personal
  bests update only on improvement; sets dedupe.
- Migration: an old `letterRide.meta` with `loadout.startCoins`/`startRelic` > 0 is refunded and
  zeroed exactly once (idempotent on re-load).
- Tiny fixtures only (3-word dictionary, small bag), per the project testing rule.

### 5.7 Migration of existing saved state

The author already has a save; removing the two perks must not silently confiscate Meta:
- On `loadMeta`, detect `loadout.startCoins > 0` or `loadout.startRelic > 0`, **refund** the Meta
  spent (sum of `unitCost * level` for each removed perk, using the costs they were bought at),
  add it back to `metaState.meta`, and zero the fields. Mark the migration done so a second load
  does not double-refund (e.g. a `schemaVersion` bump on the meta state).
- After migration, `metaShopOffers` and `buildLoadout` reference only `extraDiscards`.

---

## 6. Representative catalog (~26 + the grid)

Names and thresholds are illustrative. All thresholds and payouts are **TUNE** (see Section 7).

**Onboarding (~5, small Meta, one-time):**
- Clear your first round.
- Win your first full run.
- Buy your first relic.
- Play your first 5+ letter word.
- Reach Passage 2.

**Mastery / challenge (~10, the bulk of the Meta budget):**
- Win a run buying nothing from the shop.
- Clear a round in a single word.
- Play a single word worth >= X.
- Win on Stake 1.
- Win on Stake 2.
- Score >= X in a round with a xMult engine active.
- Win a run in <= N total words (efficiency, Spellatro-style).
- Win a run without discarding.
- Clutch: clear a round on the final available play from behind.
- Flawless full press (definition TUNE).

**Build-diversity nudges (~6, moderate Meta — reuse the archetype classifier):**
- Win leaning vowels.
- Win leaning rare letters (J/Q/X/Z).
- Win with a short-word stack.
- Win with a long-word build.
- Win a run using >= N distinct tile-mods.
- Win a run with >= N relics.

**Discovery / long-tail prestige (~5, low Meta + the grid):**
- Curator: use every relic at least once (across runs).
- Enchanter: apply every tile-mod at least once (across runs).
- Q-without-U: play a valid word with Q and no U.
- A themed word-constraint delight (e.g. distinct high-value letters).
- **The stake x deck bounty grid** (the difficulty long-tail).

**Guardrails baked in:** no pure-grind counters in the paid set (the stats store powers the
personal-best *display*, not farmable achievements); no achievement forces a single un-fun line;
content access (relics/mods/decks) is never gated behind the grind, only mastery and prestige are.

---

## 7. Open tuning questions (for playtest, not pre-decided)

Per the project working agreement, balance numbers are surfaced, not silently chosen:

1. **Per-achievement Meta payouts** by bucket, and the total expected faucet per run.
2. **Raised `unlockCost` values** to hold the pacing target (first unlock under one run; bulk in
   ~15-30 runs; 50+ tail) given the new additive sources.
3. **Bounty reward** per stake tier in the grid, and whether the grid's total Meta is meaningful
   without becoming a grind incentive to replay the same content.
4. **Thresholds** for the >=X word score, >=X round score with a mult engine, <=N words efficiency,
   and the >=N mods / >=N relics diversity wins.
5. **"Flawless full press"** exact definition.
6. **`extraDiscards` cap** — confirm it remains 2 and the round curve is not balanced around it.
7. Whether the four build-diversity "win leaning X" achievements pressure any single un-fun line in
   practice (watch during playtest; the pillar is build diversity, not archetype supremacy).
8. Overjustification check: do the Meta payouts make play feel like chasing a reward rather than
   playing for the feat? If completing achievements starts to feel like a chore, mute or remove the
   payout display further (the 5.4 rules are the first lever; reducing payout salience is the next).

---

## 8. Scope & sequencing

- **This is a banked design only. The entire doc, including the two economy fixes, is one unit of
  deferred work.** No implementation, no tier change now. Revisit when the roadmap reaches the
  deferred wishlist and the core loop is locked. (Earlier draft language implying the economy fixes
  should "ship separately now" was contradictory and is removed: the `metaMult` deletion's
  replacement is the bounty grid, which is part of this banked feature, so it cannot precede it.)
- **Internal build ordering (when this is built):**
  1. Prerequisite run-state wiring (5.0) + the profile store + the migration step (5.7).
  2. The bounty grid, then delete `metaMult` (the grid must exist before the multiplier is removed,
     or harder stakes briefly pay *less* with no replacement).
  3. The achievement catalog + checking + UI.
  4. A dedicated balance pass on the open tuning questions (Section 7).
- The **loadout trim** (`startCoins`/`startRelic` removal + migration) is the one piece that is
  independent of the grid and could ship on its own if ever desired; everything else is coupled.
- Related memory/docs: `achievements-future`, `balance-tuning-state`, `skill-vs-luck-principle`,
  `roadmap-march-discipline`; the design spec's Meta section and Deferred wishlist; the competitive
  research and research appendix (Letterlike "too stingy" criticism; "leash not a crutch").
