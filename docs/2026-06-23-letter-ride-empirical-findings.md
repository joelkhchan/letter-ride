# Letter Ride — Empirical Findings (corpus + harness analysis)

**Date:** 2026-06-23 · **Type:** Empirical analysis of the *actual codebase* (not external research)
**Status:** Reference for tuning. Informs config/balance; **no config changes made yet.**
**Companion docs:** `2026-06-23-letter-ride-competitive-research.md` (external/competitor) ·
`2026-06-23-letter-ride-research-appendix.md` (deep-research streams).

> **How to reproduce.** All numbers below come from three read-only Node scripts (no assertions,
> deterministic via the seeded RNG in `src/rng.js`):
> - `npm run analyze:corpus` → `scripts/analyze-corpus.js` (NEW 2026-06-23): ENABLE corpus + bag analysis.
> - `npm run analyze` → `scripts/analyze-builds.js`: archetype head-to-head (per-play, 60 racks).
> - `npm run analyze:sim` → `scripts/analyze-sim.js`: greedy full-run sim (200 seeds).
> Re-run after any `config.js` / `relics.js` / `archetypes.js` change to see the effect.

---

## TL;DR — what the data changed

1. **Dead racks are a non-issue → don't build a vowel floor.** 0.0% dead racks on the standard bag
   over 1,000 draws (worst starting deck 0.8%). The earlier "add a vowel-floor draw rule"
   recommendation is **descoped by evidence.** (Caveat: vowel *droughts* and mid-run thinned bags
   still matter — see §3.)
2. **Tile values are well-calibrated** to letter frequency (zero mispricing flags). No action needed.
3. **Build diversity exists but is badly unbalanced (~5× spread).** All six archetypes beat the
   no-relic baseline (so "mods > vocabulary" holds), but Escalation/Long-word dominate and Short-word
   is the floor. **This is the #1 Tier-1 tuning target.**
4. **The full-run sim's 0% win rate is expected, not a bug** — it's a no-shop greedy bot, and the
   design requires shop scaling to win. But it means the harness **cannot yet answer "does a skilled
   player beat the curve / how much is luck vs skill"** → the documented **harness v2** (purchase
   policy + personas + variance percentiles) is the highest-value next build. Spec in §6.

---

## 1. Corpus structure (ENABLE, 172,823 words)

- **39.1%** of ENABLE (67,582 words) is **unreachable** — longer than the 9-tile rack. The
  rack-formable set (len 3–9) is **105,145 words**.
- Length distribution of the formable set skews long: **76%** are ≥7 letters; only **0.9%** (972
  words) are 3-letter. Long words are abundant; 3-letter words are scarce.
  → Implication: the length-bonus (`5×(len−3)`) plus corpus abundance structurally favors long words.
  Short-word builds must lean on **mods**, not raw availability — exactly the design intent, but it
  means short-word relic power has to be generous to compensate.

## 2. Tile values vs letter frequency

Letter frequency (in formable words) tracks assigned `TILE_VALUES` cleanly — freqRank ≈ valRank
across the board, **no mispricing flags**. Scrabble-style pricing is sound as-is.
- **Watch item — S:** freqRank 2 (9.5% of letters), value 1, and **ends 33.6% of all words** (the
  plural vector). Intentional (S is a "power tile"), and the real lever is bag scarcity (1 S in the
  starting bag). Keep S scarce in the bag; don't over-supply it in the shop.

## 3. Dead racks & rack quality (per deck, 1,000 seeded 9-tile draws, wild-aware)

| Deck | size | vowels | wilds | dead-rack % | median formable | racks <2 vowels |
|---|---|---|---|---|---|---|
| standard | 26 | 11 | 0 | **0.0%** | 150 | 2.8% |
| vowelHeavy | 26 | 14 | 0 | 0.0% | 139 | 0.3% |
| wildcard | 26 | 11 | 2 | 0.0% | 838 | 2.8% |
| rareRich | 26 | 7 | 2 | **0.8%** | 448 | **19.5%** |
| doubled | 26 | 9 | 0 | 0.7% | 211 | 7.9% |
| lean | 20 | 5 | 0 | **0.8%** | 146 | **22.3%** |

- **Dead racks are negligible** (≤0.8%) on every *starting* deck → no vowel-floor feature needed.
- **But vowel droughts are common on lean & rareRich** (~20% of racks have <2 vowels). These decks
  lean on the **discard** lever for playability, not on a draw guarantee. Tune discard count / cost
  with this in mind.
- **Open risk:** these are *starting* bags. A thinned mid-run bag is smaller, so dead-rack and
  drought risk rise. The greedy sim (which thins via play) hasn't flagged stuck loops, but re-check
  dead-rack rate *with purchases/thinning* once harness v2 exists.

**Rack earning power (standard bag, no relics):** best single word per rack — p10 **24**, median
**32**, p90 **39**, max 49; avg best-word length **6.79**. Rough no-relic round ceiling ≈ median ×
`PLAYS_PER_ROUND(4)` ≈ **128/round**, which clears ~5/8 `TIER0_TARGETS` and the first 3/8
`ROUND_TARGETS` before any shop scaling. → Confirms the base bag *should not* win the real curve
unaided (intended), and that late Tier-0 targets (185, 230) may be slightly hot for a relic-less bag.

## 4. Pattern-relic design space (predicate hit-rates over formable words)

| Predicate | Hit rate | Design read |
|---|---|---|
| ≥3 vowels (vowel-heavy) | **58.9%** | cheap/reliable → keep the per-hit bonus small (it is) |
| ends in S | 33.6% | very common → plural proxy; small payoff only |
| doubled letter (adjacent) | 20.7% | moderate |
| starts with vowel (Fresh Start) | 17.3% | uncommon → justifies a real payoff |
| digraph TH/QU/CH/SH | 10.6% | uncommon |
| rare letter J/Q/X/Z | 7.9% | rare → justifies a big payoff (rareHoarder +30 is reasonable) |
| palindrome | **0.1%** | novelty-only — cannot anchor a build |

→ Use this to size payoffs: payoff should scale **inversely** with hit-rate. A vowel-heavy bonus must
stay tiny; a palindrome bonus would need to be enormous (or be a fun gimmick, not a build).

## 5. Archetype balance (per-play, hone level 3, 60 seeded racks each)

Baseline = best long word, no relics, standard bag = **32.0**.

| Archetype | Relics | Bag | Avg/play | vs baseline |
|---|---|---|---|---|
| **Escalation** | comboCounter, momentum | standard | 527.1 | **1646%** |
| **Long-word** | lengthy, longHaul | standard | 287.8 | **899%** |
| Doubled-letter | doubleTrouble, echoChamber | doubled | 171.5 | 536% |
| Vowel-heavy | vowelBonus, freshStart | standard | 141.3 | 441% |
| Rare-letter | rareHoarder, rareSurge | rareRich | 127.6 | 399% |
| **Short-word** | shortAndSweet | lean | 108.2 | **338%** |

- **Good:** every built archetype beats the bare-long-word baseline → modifiers, not vocabulary,
  drive scoring (core pillar validated).
- **Problem:** a **~5× spread**. Escalation and Long-word are auto-picks; Short-word is the floor.
  Per the build-diversity rule, target compressing this to ~1.5–2×.
- **Methodology caveats (don't over-read the exact ratios):** Short-word is handicapped to ≤3-letter
  words only (can't use a better 4–5 letter word); Escalation is measured at its peak moment
  (`wordsPlayedThisRound=3`); each archetype uses different relics/bags. The *ranking* is real; the
  magnitudes are a per-play snapshot, not run outcomes.
- **Tuning levers** (all in config/data, per the no-logic-in-config rule): Escalation's
  `comboCounter` +Mult-per-word and `momentum` likely too strong; Long-word `longHaul ×Mult` scaling
  steep; Short-word needs either a bigger `shortAndSweet` multiplier or a flat-points injection (the
  spec already flagged this). **Author playtest decision — don't silently pick numbers.**

## 6. Full-run simulation (greedy player, 200 seeds, standard deck, NO shop)

- **Win rate: 0/200 (0.0%).** Greedy bot reaches round 3 (72×) or 4 (128×) of 8, never further.
- **This is expected and arguably correct:** no purchases + standard bag can't beat a curve designed
  to require shop scaling. It confirms the "must convert Coins → power" pressure is real.
- **The limitation that matters:** the sim has **no purchase policy and reports no variance**, so it
  cannot yet answer the two questions that matter most for the skill-vs-luck rule:
  1. Does a *skilled shopping* player clear the curve? (and at what win rate?)
  2. How much does score *spread* for a fixed skilled build across seeds? (the luck-vs-skill metric)

### Harness v2 — spec for the dev session (highest-value next build)
Extend `src/sim.js` (its header already lists these as v2) + a new `scripts/analyze-sim-v2.js`:
1. **Purchase policy / "skilled line":** each shop, spend toward a target archetype — simplest v1:
   buy the cheapest power that advances the chosen build (relic > enchant > upgrade > thin), keep a
   coin reserve for interest. Make the policy pluggable so we can compare "greedy", "thrifty",
   "all-in-one-archetype".
2. **Per-archetype personas:** run the curve once per archetype (short/long/rare/doubled/vowel/
   escalation) → which builds clear, which stall, at what round. This is build-diversity at the
   *run* level (complements §5's per-play view).
3. **Variance / percentile reporting:** for a fixed persona, report p10/p50/p90 round-score and
   win-rate across N seeds. **Wide spread = luck-dominated; tight = skill-rewarding.** This is the
   literal instrument for the skill-vs-luck design rule.
4. **Dead-rack-with-thinning check:** track dead/near-dead racks *after* mid-run thinning to close
   the §3 open risk.
5. (later) **Wild substitution** in `bestPlay` (currently wilds are treated as non-letters).

Target read once built: a skilled persona should clear the curve at a *high but not certain* win
rate (skill matters), with several archetypes viable (diversity), and bounded score variance for a
fixed build (luck doesn't dominate). Tune `ROUND_TARGETS` / relic numbers against that.

---

## 7. Consolidated tuning to-do (for the dev session — all are author-playtest calls)

- **[P0] Compress the archetype spread** (§5): pull Escalation/Long-word down and/or Short-word up
  toward ~1.5–2× of each other. Levers: `relics.js` numbers, `archetypes.js` hone increments.
- **[P0] Re-tune the target curve** against harness v2's skilled-persona percentiles (§6), not the
  greedy no-shop bot. Aim "skilled line clears the median draw."
- **[P1] Build harness v2** (§6) — prerequisite for the two P0 tuning passes to be evidence-based.
- **[P1] Don't build a vowel floor** (§3); instead make sure discard count/cost covers the vowel
  droughts on lean/rareRich (~20% of racks <2 vowels).
- **[P2] Re-check dead-rack rate with mid-run thinning** once harness v2 lands (§3 open risk).
- **[P2] Keep S scarce** in bag and shop supply (§2).
- **[Validated, no action] Tile values** (§2) and **pattern-payoff sizing** guidance (§4).

**Cross-reference:** these empirical findings line up with the external research — the genre's
top-cited problems (brutal target ramps, illegible scoring, dead/OP modifiers) are exactly what the
numbers here predict. See the competitive-research and research-appendix docs.
