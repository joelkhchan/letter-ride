# Letter Ride — Systems Bible (Phase 1, the spine)

**Date:** 2026-06-23 · **Status:** Phase 1 deliverable. Locks the scoring boundaries, the effect/letter/word vocabulary, and the scaling-engine design, so Phase 2 (bosses + events) is designable inside known limits. Grounded in the 2026-06-23 research + harness findings.

**Decisions:** D1–D9 (§7) confirmed by the author 2026-06-23 and **locked as recommended**. The 🔷 markers below record where a call was made; all are now settled.

**How to read:** items marked **🔷 DECISION** record an author call (the recommendation that was adopted). Everything else is a locked pillar or derived. The consolidated decision list is §7.

---

## 1. Locked boundaries (unchanged pillars)

- **Formula:** `Score = Points × Mult`, where `mult = (1 + ΣaddMult) × ΠtimesMult`. Phase-ordered: all `+Mult` sum into `(1 + Σ)` first, then all `×Mult` multiply. **Acquisition-order-independent.** All scoring flows through `scoreWord` in `scoring.js`.
- **Three currencies:** Score (in-round vs target), $ (in-run shop), Meta (persistent).
- **Scarcity:** letters are always drawn from a bag you build.
- **Determinism + logic/UI split:** seeded RNG only; rules in pure modules.

None of these change in Phase 1. Everything below is *content + a little per-modifier state* on top of the existing engine. The design spec already anticipated this: "scaling modifiers are content built on per-modifier state, not an engine change."

## 2. The organizing principle: the build ARC

A run is a journey from additive to multiplicative power:

- **Early — `+Points`:** base tile values, length/vowel/rare bonuses. Clears the soft early targets.
- **Mid — `+Mult`:** conditional `+Mult` sources lift the multiplier inside `(1 + Σ)`.
- **Late — `×Mult` + scaling:** multiplicative engines that **compound**. This is the only thing that beats an exponential curve.

The harness proved the late stage is missing: every `×Mult` relic is a fixed constant and **nothing compounds across rounds** (combo/momentum reset each round), so a linear acquisition of fixed bonuses loses to an exponential target (skilled personas win ~0%). The spine's whole job is to build the late stage.

## 3. The scaling engine (the core new system)

Two complementary compounding sources:

**(a) Snowball relics — passive auto-ratchet.** A relic carries per-relic state that permanently grows its own `×Mult` (or `+Mult`) as you play qualifying words, reset each run. This is Balatro's scaling-joker analog. Shape: *"Avalanche: +0.2 ×Mult permanently each time you play a rare letter."* A snowball that fires 15 times over a run is at ×4 and still climbing.
- **🔷 DECISION — the canonical snowball trigger.** Recommend **per-qualifying-play ratchet** (grows when its archetype condition is met), so it rewards committing to and repeatedly hitting a build. Alternatives: per-round, per-tile-played.
- Implementation: per-relic mutable state on the run (e.g. `relic.state.stacks`), read inside `evaluate(ctx)`. Deterministic and DI-clean; persists in the save.

**(b) Hone — active investment scaling.** Hone already exists: spend $ to permanently level an archetype within a run (our Planet-card analog). Today it emits only `+Points/+Mult`.
- **🔷 DECISION — let high Hone levels emit `×Mult`.** Recommend **yes**: at high levels Hone adds `×Mult`, not just `+Points/+Mult`, so investing $ into a build compounds. Keeps the current per-archetype granularity; gives each archetype a `×Mult` wincon via the axis the player already invests in.

**Per-archetype `×Mult` wincon.** Each of the 6 archetypes must have at least one path to compounding `×Mult` (a snowball relic and/or Hone-`×Mult`). Today only short/long/rare/doubled touch `×Mult`, all fixed; vowel/escalation have none. Closing this is what makes every archetype able to scale into the late rounds.

**The blowup dial.**
- **🔷 DECISION — embrace, don't cap.** Recommend **embrace** (matches the roadmap balance philosophy + the "billions" direction): no hard `×Mult` cap. Intervene only when a line becomes a *zero-decision no-brainer*, never just because it is high.
- **Precision guard (not a gameplay cap):** keep scores representable at the arithmetic *and* display layers, so `score >= target` never breaks on NaN/Infinity (Balatro's "naneinf" bug). Format big numbers for legibility (1.2K, 4.5M).

## 4. Effect vocabulary (role taxonomy + new effect types)

**Relic role taxonomy** (organize the relic set by role; we ship the first three + economy today, and build the rest):

> flat `+Points` · flat `+Mult` · conditional `×Mult` · **scaling/snowball** · **`×Mult` wincon** · economy · **retrigger** · **copy/engine**

**New effect types** (beyond `+Points/+Mult/×Mult`):
- **🔷 DECISION — which are IN for v1.** Recommend: **retrigger IN** (replay a tile's or word's scoring contribution; a big, legible lever), **tile transform / destroy IN** (shop tools + boss fodder), **copy/engine DEFERRED** to Phase 3 (powerful but complex).

**Boss negative / warp effects** (the vocabulary Phase 2 bosses draw from; locking this set is the Phase 1 gate). Bounded to four verbs:
- **Disable:** a scoring source scores 0 (e.g. "vowels score 0", "doubled bonus off").
- **Cap:** a ceiling on a phase (e.g. "×Mult capped at ×4 this round").
- **Tax:** a cost per word/play (e.g. "-15 Points per word", "first play costs $2").
- **Lock:** a constraint (e.g. "can't discard", "must include a rare letter", "one letter is forbidden").

Each boss = one or two of these aimed at a committed build, forcing a pivot or a counter. Bosses themselves are designed in Phase 2; only the *vocabulary* is locked here.

## 5. Letter & word mechanics (IN / OUT for v1)

- **Tile values, wilds, rares, bag rules:** unchanged.
- **Tile-upgrade tiers:** **🔷 recommend light IN** (a shop path that raises a tile's base or adds a mod slot). Feeds the `+Points` early arc.
- **Positional bonuses (in-word):** **🔷 recommend IN** as first/last-letter effects (compatible with phase-order; we already have Fresh Start). Cheap, legible.
- **Word-combos / chaining:** **🔷 recommend DEFER to Phase 3** (a new scoring dimension; not needed for the engine or bosses). Reserve the hook.
- **Word-types (affixes/digraphs `-ING/-ED/QU/TH`):** **🔷 recommend DEFER to Phase 3** as a POS-lite relic class. Reserve the hook.
- **Position-as-skill-lever (relic ordering):** ⚠️ the one item that touches a pillar. Real Balatro's left-to-right running total makes joker *order* matter; our phase-order formula is deliberately order-independent. Enabling relic-ordering means **relaxing the phase-order pillar** (a formula + UI change). **🔷 DECISION** (you lean yes): recommend **keep phase-order locked for v1** and defer relic-ordering as a later mechanic, since it is not needed for the engine or bosses. The in-word positional bonuses above give a compatible taste of "position matters" now.

## 6. The curve (set after the engine exists)

The provisional 0c curve is soft and pre-engine. Once the scaling engine lands, set an **exponential** curve the engine can ride: benchmark **~2.2×/round, front-loaded, with a Small/Big/Boss rhythm**. Targets *chase* the engine's ceiling (a dial, not a cap). Re-tune with the harness + play. (This is the "fine-tune later" already flagged.)

## 7. Decisions consolidated (one pass)

| # | Decision | Recommendation |
|---|---|---|
| D1 | Snowball trigger | Per-qualifying-play ratchet (reward committing + repeating a build) |
| D2 | Hone emits `×Mult` at high levels | Yes (investing $ in a build compounds) |
| D3 | Blowup dial | Embrace (no cap); only fix zero-decision no-brainers; precision guard at arithmetic + display |
| D4 | New effect types IN for v1 | Retrigger IN, transform/destroy IN, copy/engine deferred |
| D5 | Boss warp-effect verbs | Disable / Cap / Tax / Lock (this bounded set) |
| D6 | Tile-upgrade tiers | Light IN |
| D7 | In-word positional bonuses | IN |
| D8 | Chaining + word-types | Defer to Phase 3 (reserve hooks) |
| D9 | Position-as-lever (relic ordering) | Keep phase-order locked v1; defer relic-ordering |

## 8. Exit gate

Boundaries stated (curve shape, blowup dial + precision guard) and the effect/letter/word vocabulary locked (relic roles, new effect types, boss warp-effects) → **bosses + events (Phase 2) are designable.** Build order out of Phase 1: scaling engine (snowball relics + Hone-`×Mult`) → per-archetype wincons → retrigger / transform effects → then Phase 2.
