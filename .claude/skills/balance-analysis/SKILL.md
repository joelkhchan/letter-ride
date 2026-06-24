---
name: balance-analysis
description: Use when running or interpreting Letter Ride's balance/simulation analysis, or tuning game numbers — the six read-only `npm run analyze*` harnesses (corpus, builds, sim, sim-v2, eval, boss). Covers what each measures, when to use which, how to read the output (skill-gradient ladder, Wilson CIs, paired McNemar, clear-margin, decision-gap, boss survivability), and the tune→re-run loop + design rules to respect. Trigger on "run the analysis / harness / sim / eval", "is the balance ok", "tune ROUND_TARGETS / relics / archetypes", "skill vs luck", "lookahead vs greedy", "archetype spread", "dead racks", "boss survivability", "analyze:eval", "analyze:boss".
---

# Letter Ride — Balance & Simulation Analysis

Six deterministic, **read-only** Node scripts measure the game's balance from the real ENABLE list + `CONFIG`. They assert nothing and change nothing — they print tables for the author to judge. All randomness flows through the seeded RNG (`src/rng.js`), so output is reproducible for a fixed config. Re-run after any `config.js` / `relics.js` / `archetypes.js` change to see the effect.

The run is now a **12-encounter Passage structure** (4 Passages × Word/Phrase/Sentence; **Sentence rounds are bosses**, assigned from a seeded `bossOrder`). The scaling engine (snowball relics + Hone-×Mult kicker) is live. The harnesses below drive the **real engine** (`run.js`/`scoring.js`), so they automatically experience bosses and snowballs.

## The six harnesses — what each measures, when to use it

| Command | Script | Measures | Use when |
|---|---|---|---|
| `npm run analyze:corpus` | `analyze-corpus.js` | ENABLE corpus structure (formable set, length skew), tile-value↔letter-frequency calibration, **dead-rack % + vowel-drought % per deck** (1000 draws), pattern-predicate hit-rates, rack earning-power percentiles | Checking bag/corpus health; sizing a pattern relic's payoff; deciding deck composition or discard count |
| `npm run analyze` | `analyze-builds.js` | **Per-play** archetype head-to-head: each of the 6 archetypes (its relics + hone L3, its home bag) vs the no-relic best-long-word baseline, over 60 racks → ratio % | Checking the per-play power spread across archetypes (the "is one archetype an auto-pick" view) |
| `npm run analyze:sim` | `analyze-sim.js` | **Full-run, greedy, NO shop** (200 seeds) → win-rate + round-reached distribution | The no-purchase *floor*: is the early curve clearable without scaling? (Expect ~0% — the design requires shop scaling) |
| `npm run analyze:sim-v2` | `analyze-sim-v2.js` | **Full-run, per-archetype SKILLED personas that shop** (200 seeds, greedy play) → win-rate + **p10/p50/p90 round reached** + dead-rack% (post-thin) | The simple single-policy skilled view: does the greedy-but-shopping line clear the curve? per-archetype run-level spread |
| `npm run analyze:eval` | `analyze-eval.js` | **Skill-gradient:** policy **ladder** (random → greedy → lookahead-k) × personas × *shared seeds* → win-rate + **Wilson 95% CI**, round + **clear-margin** percentiles, the paired **greedy→lookahead McNemar** p-value, and the **decision-gap** (legibility) distribution | The headline **skill-vs-luck** instrument: does *skill* (deeper play) beat the same luck? is any decision a no-brainer? Flags: `--n` `--k` `--branch` `--json` |
| `npm run analyze:boss` | `analyze-boss.js` | **Boss survivability matrix:** per-(persona × forced boss) win-rate vs a no-boss baseline, on shared seeds (greedy default; `--lookahead` for the skilled read) | Checking each boss antagonizes its target archetype **without killing it** (the no-dead-archetype rule) |

`analyze:eval` is the **primary skill-vs-luck instrument** — the random→greedy→lookahead win-rate *gradient* with CIs and paired significance is the literal measuring stick. `analyze:sim-v2` remains the simpler single-policy percentile view.

## How to read the output (against the design rules)

The binding design rules live in `CLAUDE.md`; the tuning targets they imply:

- **Skill beats luck → "a skilled line clears the MEDIAN draw, not the lucky tail."** In `analyze:eval`, the read is the **gradient**: a *positive, CI-separated* `lookahead − greedy` win-rate delta with **McNemar p < 0.05** means skill has real headroom on the same draws. A **flat** gradient (random ≈ greedy ≈ lookahead) means luck-dominated or the decisions are trivial. Within a rung, a wide p10↔p90 = luck-dominated. All rungs ~0% = the curve (`ROUND_TARGETS`) is too steep even for skilled play → bring it down.
- **Legibility / "no zero-decision lines."** `analyze:eval` reports the **decision-gap** p50/p90 (normalized best vs 2nd-best play per rack). A high p50 means one play usually dominates (a no-brainer-board risk). It is reported as a *distribution* — no fixed pass/fail threshold; the author judges.
- **Build diversity, not supremacy.** Several archetypes should be viable; they need **not** win equally. Target compressing the `analyze` per-play spread toward ~1.5–2× (it has been ~5×: Escalation/Long-word dominate, Short-word the floor). In `analyze:eval`/`sim-v2`, watch for one persona winning while others sit at 0% (run-level imbalance).
- **Bosses antagonize, they don't kill.** In `analyze:boss`, each boss should **drop its target archetype** vs the no-boss column **but not to a dead 0%**. A boss that zeroes an otherwise-viable archetype violates the no-dead-archetype rule. (The 4 bosses: Mute = vowels score 0 → hits vowel-heavy; Ceiling = mult capped → hits ×Mult engines; Toll = −15 Points/word → hits short/many-word lines; Vise = no discards → hits drought-prone bags.)
- **×Mult is the moat** (competitive research): the ×Mult personas (long `longHaul`, rare `rareSurge`, doubled `echoChamber`, plus the snowball relics + Hone ×Mult kicker) clearing with bounded variance = the differentiator working.
- **No vowel floor.** `analyze:corpus` shows dead racks are negligible (≤0.8% on starting decks) — do NOT add a draw guarantee. The ~20% vowel-droughts on `lean`/`rareRich` are covered by the **discard lever** (tune discard count/cost); the sims' post-thin dead-rack% re-checks this mid-run.
- **Pattern-payoff sizing:** scale a relic's payoff **inversely** to its predicate hit-rate (`analyze:corpus` §pattern table): ≥3 vowels 59% → tiny; doubled 21% → moderate; rare J/Q/X/Z 8% → big payoff OK; palindrome 0.1% → novelty only.

## Current state (read this before concluding "it's broken")

On the **current steep 12-encounter curve**, the competent bot wins **~0% across the board** — greedy AND shallow lookahead — so `analyze:eval`'s gradient is flat and `analyze:boss` reads ~0% everywhere. **This is the documented "the bot can't ride the steep curve" state, not a bug.** The bot is a *competent floor*, not the human ceiling, and the snowball/×Mult lines that beat an exponential curve need either a deeper lookahead or real play to express. The instruments produce a meaningful skill-vs-luck / boss-survivability signal **once `ROUND_TARGETS` is tuned so archetypes win above 0% without bosses**. Until then, treat ~0% as "curve too steep for the bot," the standing #1 tuning signal.

## The tune→re-run loop

1. Form a hypothesis from the harness (e.g. "lookahead−greedy delta is ~0 and everyone wins 0% → `ROUND_TARGETS` too steep").
2. Edit **only numbers** in `config.js` (targets, costs, shop, interest), `relics.js` (relic magnitudes, snowball per-stack), or `archetypes.js` (hone increments). `config.js` holds tunables and no logic.
3. Re-run the relevant harness; compare. Use the **Wilson CIs and the paired McNemar** to judge whether a change is *real* or within noise — don't chase a win-rate wiggle inside the CI. (`--json` output diffs cleanly run-to-run.)
4. **The author judges fun and owns the final numbers** — surface what the data suggests; do **not** silently pick "balanced" values and call it done (CLAUDE.md working agreement). Confirm balance changes with a real playtest (`npm run serve`).

## Caveats / current harness limits (v3)

- **Play policy is a ladder, not one policy.** `random` (floor) → `greedy` (a *competent* best-single-word line) → `lookahead-k` (an **exact bounded within-round search** — the skilled-ceiling *proxy*, still not optimal: it branches on the top-N immediate-score plays, so it can miss a low-now/high-later setup). Shop policy is the simple "buy my archetype's relics/hone, reserve coins" target-buy. Discard is `smartDiscard` (selective — keep the playable core, dump the rare clog), not dump-all.
- **`analyze:eval` lookahead is the runtime cost** (`branch^k` clones + word-enumerations per play, over the full ENABLE list). The default `--k=4 --branch=6` is slow over the whole list — **iterate at `--k=2 --branch=4`** (and modest `--n`), and reserve a `--k=4 --n=200` run for a one-off definitive skill-headroom read. `analyze:boss` defaults to the cheaper greedy agent.
- **Enumeration is now wild-aware.** A `*` tile substitutes for any one missing letter in the harness's word search (it scores 0 base but counts as its chosen letter for length/patterns), so `rareRich`/`wildcard` are no longer understated. (This is harness-only; the live game's dead-hand check still uses `dictionary.findWord`.)
- **`analyze:boss` is uninformative until the curve is tuned** (everything reads ~0% now — see "Current state"). The matrix is *ready* for post-tuning use.
- Magnitudes in `analyze` (builds) are a per-play snapshot (Short-word handicapped to ≤3-letter words; Escalation measured at its peak play); the *ranking* is real, the exact ratios are not run outcomes.

## Where the numbers + findings are documented
`docs/2026-06-23-letter-ride-empirical-findings.md` (corpus/harness analysis + §7 tuning to-do), `docs/2026-06-23-letter-ride-eval-harness-v3-plan.md` (the v3 instrument design: Agent ladder, `scoreFor`, lookahead, stats, boss matrix), `docs/2026-06-23-letter-ride-competitive-research.md` (genre context), and the SDD ledger `.superpowers/sdd/progress.md` (per-run results captured during builds).
