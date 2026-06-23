---
name: balance-analysis
description: Use when running or interpreting Letter Ride's balance/simulation analysis, or tuning game numbers — the four read-only `npm run analyze*` harnesses (corpus, builds, sim, sim-v2). Covers what each measures, when to use which, how to read the output, and the tune→re-run loop + design rules to respect. Trigger on "run the analysis / harness / sim", "is the balance ok", "tune ROUND_TARGETS / relics / archetypes", "skill vs luck", "archetype spread", "dead racks".
---

# Letter Ride — Balance & Simulation Analysis

Four deterministic, **read-only** Node scripts measure the game's balance from the real ENABLE list + `CONFIG`. They assert nothing and change nothing — they print tables for the author to judge. All randomness flows through the seeded RNG (`src/rng.js`), so output is reproducible for a fixed config. Re-run after any `config.js` / `relics.js` / `archetypes.js` change to see the effect.

## The four harnesses — what each measures, when to use it

| Command | Script | Measures | Use when |
|---|---|---|---|
| `npm run analyze:corpus` | `analyze-corpus.js` | ENABLE corpus structure (formable set, length skew), tile-value↔letter-frequency calibration, **dead-rack % + vowel-drought % per deck** (1000 draws), pattern-predicate hit-rates, rack earning-power percentiles | Checking bag/corpus health; sizing a pattern relic's payoff; deciding deck composition or discard count |
| `npm run analyze` | `analyze-builds.js` | **Per-play** archetype head-to-head: each of the 6 archetypes (its relics + hone L3, its home bag) vs the no-relic best-long-word baseline, over 60 racks → ratio % | Checking the per-play power spread across archetypes (the "is one archetype an auto-pick" view) |
| `npm run analyze:sim` | `analyze-sim.js` | **Full-run, greedy, NO shop** (200 seeds) → win-rate + round-reached distribution | The no-purchase *floor*: is the early curve clearable without scaling? (Expect ~0% — the design requires shop scaling) |
| `npm run analyze:sim-v2` | `analyze-sim-v2.js` | **Full-run, per-archetype SKILLED personas that shop** (200 seeds) → win-rate + **p10/p50/p90 round reached** + dead-rack% (post-thin) | The main instrument: does *skilled* play clear the curve? How much is skill vs luck (variance spread)? Are archetypes co-viable at the run level? |

`analyze:sim-v2` is the primary tuning instrument — it's the literal **skill-vs-luck** measuring stick.

## How to read the output (against the design rules)

The binding design rules live in `CLAUDE.md`; the tuning targets they imply:

- **Skill beats luck → "a skilled line clears the MEDIAN draw, not the lucky tail."** In `analyze:sim-v2`: a healthy game has skilled personas winning at a **high-but-not-certain** rate with a **bounded p10↔p90 spread**. A wide p10↔p90 = luck-dominated (bad). All personas ~0% = the curve (`ROUND_TARGETS`) is too steep even for skilled play → bring it down.
- **Build diversity, not supremacy.** Several archetypes should be viable; they need **not** win equally. Target compressing the `analyze` per-play spread toward ~1.5–2× (it has been ~5×: Escalation/Long-word dominate, Short-word the floor). In `analyze:sim-v2`, watch for one persona winning while others sit at 0% (run-level imbalance).
- **×Mult is the moat** (competitive research): the ×Mult personas (long `longHaul`, rare `rareSurge`, doubled `echoChamber`) clearing with bounded variance = the differentiator working.
- **No vowel floor.** `analyze:corpus` shows dead racks are negligible (≤0.8% on starting decks) — do NOT add a draw guarantee. The ~20% vowel-droughts on `lean`/`rareRich` are covered by the **discard lever** (tune discard count/cost), and `analyze:sim-v2`'s post-thin dead-rack% re-checks this mid-run.
- **Pattern-payoff sizing:** scale a relic's payoff **inversely** to its predicate hit-rate (`analyze:corpus` §pattern table): ≥3 vowels 59% → tiny; doubled 21% → moderate; rare J/Q/X/Z 8% → big payoff OK; palindrome 0.1% → novelty only.

## The tune→re-run loop

1. Form a hypothesis from the harness (e.g. "skilled win-rate is 0% → `ROUND_TARGETS` too steep").
2. Edit **only numbers** in `config.js` (targets, costs, shop, interest), `relics.js` (relic magnitudes), or `archetypes.js` (hone increments). `config.js` holds tunables and no logic.
3. Re-run the relevant harness; compare. Iterate.
4. **The author judges fun and owns the final numbers** — surface what the data suggests; do **not** silently pick "balanced" values and call it done (CLAUDE.md working agreement). Confirm balance changes with a real playtest (`npm run serve`).

## Caveats / current harness limits (v2)

- Personas use a **greedy best-single-word** play policy + a **simple "buy my archetype's relics/hone, reserve coins" shop policy** + a crude **dump-the-whole-hand discard**. A truly optimal player would do better — read win-rates as a *competent* line, not the ceiling.
- **Wilds are treated as non-letters** in word enumeration (can't yet spell *with* a wild) — a v2-later refinement; it slightly understates wild-bearing bags (rareRich/wildcard).
- Magnitudes in `analyze` are a per-play snapshot (Short-word handicapped to ≤3-letter words; Escalation measured at its peak play); the *ranking* is real, the exact ratios are not run outcomes.

## Where the numbers + findings are documented
`docs/2026-06-23-letter-ride-empirical-findings.md` (the corpus/harness analysis + §7 tuning to-do), `docs/2026-06-23-letter-ride-competitive-research.md` (genre context), and the SDD ledger `.superpowers/sdd/progress.md` (per-run results captured during builds).
