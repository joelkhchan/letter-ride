# Letter Ride — Full Play-test, Review & Re-balance Findings (2026-06-26)

Read-only analysis pass. Drives the **real engine** (`run.js`/`scoring.js`) headlessly across all
seven `npm run analyze*` harnesses plus a new **detailed per-run logger**
(`scripts/playtest-detail.js`) that records every word played, where each run died, the
relics/hones/mods it ended with, the purchases it made, and which achievements fired.

**Nothing in `config.js` / `relics.js` / `archetypes.js` was changed.** This doc records what the
data says and proposes tuning for the author to judge (CLAUDE.md: the author owns the final
numbers and judges fun). Tuning questions are collected in §8.

Worktree: `worktree-balance-playtest`. Seeds are deterministic (seeded RNG), so every number here
reproduces for the current config.

---

## 0. How to read the agent ladder

The bot is a *competent floor, not the human ceiling*:

- **greedy** — picks the single highest-scoring word each turn. A floor. Critically, greedy
  **never plays a short word when a long one scores higher**, so it cannot express the Short-Word
  archetype at all (see §3). Treat greedy short-word numbers as a *bot artifact*.
- **lookahead-k** — exact bounded within-round search (k=2, branch=4 here). The skilled-line proxy.
  Still not optimal (branches on top-N immediate-score plays; can miss low-now/high-later setups).

Shop policy = the simple "buy my archetype's target relics/hone/mods, reserve nothing" target-buy.
Discard = `smartDiscard` (keep the playable core, dump the rare clog).

Run shape: **12 encounters**, 4 Passages × (Word, Phrase, Sentence). **Every Sentence (enc 3, 6, 9,
12) is a boss**, drawn from a seeded order. `ROUND_TARGETS = 40/50/60 · 75/90/110 · 130/160/195 ·
240/290/355`.

---

## 1. Corpus & bag health (`analyze:corpus`) — HEALTHY, no change needed

- ENABLE: 172,823 words; 105,145 are rack-formable (len 3–9). 39% of the list is unreachable (>9).
- **Dead racks are a non-issue** from the starting bag: **0/1000** dead racks; median 150 formable
  words/rack; `<2 vowels` only 1.6% of racks. Per-deck dead-rack% (1000 draws): standard 0.0%,
  vowelHeavy 0.0%, wildcard 0.0%. **Confirms the design rule: do NOT add a vowel floor / draw guarantee.**
- Tile-value↔frequency calibration is good (freqRank≈valRank within 1–3 for every letter).
- Pattern hit-rates (for sizing pattern-relic payoffs): doubled-letter 20.7%, rare J/Q/X/Z 7.9%,
  digraph 10.6%, ≥3 vowels 58.9%, starts-with-vowel 17.3%, ends-in-S 33.6%, palindrome 0.1%.
- No-relic best-word score per rack: p10 24, median 32, p90 39. Avg best-word length 6.79.

**Verdict:** the corpus and bags are well-tuned. The droughty `lean`/`rareRich` decks aren't in the
per-deck table (they're the persona decks) — their vowel droughts are meant to be covered by the
discard lever, which the **Vise boss removes** (see §4, a real problem).

---

## 2. The curve is too steep for the floor, and the back half is dominated by snowball variance

### No-shop floor (`analyze:sim`, 200 seeds, greedy, standard deck)
- **Win rate 0/200 = 0.0%.** Avg round reached **5.67 / 12**. Deaths cluster hard at **round 6
  (P2.Sentence, 109 runs)** and round 3 (P1.Sentence, 39 runs). This is the intended floor — the
  design *requires* shop scaling — so 0% is expected and fine.

### Skilled-but-shopping (`analyze:sim-v2`, greedy + target-buy, 200 seeds)
| Persona | Win rate | round p10 / p50 / p90 | dead-rack% (post-thin) |
|---|---|---|---|
| Short Word | 0.5% | 3 / 6 / 9 | 14.84% |
| Long Word | 25.5% | 6 / 10 / 12 | 1.31% |
| Rare Letter | 12.0% | 6 / 7 / 12 | 5.53% |
| Doubled | 10.5% | 6 / 9 / 12 | 4.72% |
| Vowel Heavy | 19.0% | 6 / 10 / 12 | 1.10% |
| Escalation | 25.0% | 6 / 10 / 12 | 1.14% |

Note the **wide p10↔p90 spread** (e.g. Long Word 6/10/12, Doubled 6/9/12) — luck-dominated runs:
the difference between a p10 and a p90 run of the *same archetype* is 6 encounters.

### Skill-gradient instrument (`analyze:eval`, 50 shared seeds, ladder random→greedy→lookahead2 branch4)
| Persona | random | greedy | lookahead2 | lookahead−greedy (McNemar p) | decision-gap p50/p90 |
|---|---|---|---|---|---|
| Short Word | 0% | 2% | 6% | +4% (p=0.479) | 0.08 / 0.26 |
| Long Word | 0% | 28% | 34% | +6% (p=0.248) | 0.08 / 0.29 |
| Rare Letter | 0% | 12% | 16% | +4% (p=0.479) | 0.07 / 0.24 |
| Doubled | 0% | 14% | 12% | **−2% (p=1.000)** | 0.05 / 0.23 |
| Vowel Heavy | 0% | 22% | 34% | **+12% (p=0.041 ✔ significant)** | 0.09 / 0.26 |
| Escalation | 0% | 22% | 32% | +10% (p=0.074, b=5 c=0) | 0.08 / 0.23 |

**Reads:**
- **greedy ≫ random everywhere** (+22–28% for the strong archetypes): *competent* play beats random
  decisively — the first rung of "skill beats luck" holds strongly.
- **The deeper skill rung (lookahead−greedy) is real but only CI-separated/significant for Vowel
  Heavy (p=0.041)** and near-significant for Escalation (p=0.074, every disagreement favors
  lookahead: b=5 c=0). For Long/Rare/Short it's a positive but noisy +4–6%. **Doubled is −2%,
  p=1.000 — no skill headroom at all**, confirming it is luck-decided (its relics key off a board
  condition the player can't engineer).
- **Legibility is healthy: decision-gap p50 0.05–0.09, p90 0.23–0.29 — LOW.** No "no-brainer
  boards"; the best play rarely dominates the 2nd-best, so most racks present a real choice. The
  design rule "no zero-decision lines" holds.
- Caveat: lookahead at k=2/branch=4 is a *shallow* skill proxy; a deeper search (or a human) would
  likely widen the lookahead−greedy gap. The marginal-skill numbers are a floor on skill headroom.

### The structural problem the narratives expose
The detailed logger shows **two completely different games depending on whether the snowball engine
spins up:**
- **Spun up** (Long/Escalation winners): seed 2 won with **juggernaut at 13 stacks**, seed 3 with
  **17 stacks** — late words score 130–360 *each*, trivially crushing the 240/290/355 back half. A
  single word (`KALONGS` = 362) cleared the 355 final boss.
- **Not spun up**: the same archetype dies in Passage 3–4, short by 30–45 points, simply because it
  never hit the relic/stack density to keep pace with the exponential curve.

So the back-half curve is simultaneously **too low for a spun engine and too high for a flat line**.
The deciding variable is *how early you find your engine pieces in the shop* — which is RNG. This is
the genre's #1 failure mode (luck decides the run) leaking in through **snowball variance** rather
than through draw variance. Skill (lookahead) helps at the margin but cannot manufacture stacks that
the shop never offered.

---

## 3. Build diversity — WIDE spread; one archetype is uncompetitive, two dominate

### Per-play power (`analyze:builds`, 60 racks, ratio vs no-relic long-word baseline of 32.0)
| Archetype | Avg Score | Ratio |
|---|---|---|
| Short-word | 135.3 | 422% |
| Long-word | 359.8 | 1124% |
| Rare-letter | 158.3 | 494% |
| Doubled-letter | 212.9 | 665% |
| Vowel-heavy | 173.7 | 543% |
| **Escalation** | **658.9** | **2058%** |

Spread low→high ≈ **4.9×** (target per the skill is ~1.5–2×). Escalation and Long-word are the
clear leaders; Rare-letter is the weakest *expressible* archetype.

### Run-level win rates — greedy floor, all 6 (detailed logger, n=80)
| Archetype | Win% | avg enc cleared | avg snowball stacks | dies mostly at |
|---|---|---|---|---|
| Short Word | 1% (1/80) | 5.3 | 0 | P1.Sentence (20), P2.Sentence (21) |
| Long Word | 26% (21/80) | 9.0 | 2 | P3.Sentence (13), P4.Word (12), P4.Phrase (10) |
| Rare Letter | 11% (9/80) | 6.9 | 2 | P3.Word (21), P2.Sentence (16), P3.Phrase (12) |
| Doubled | 15% (12/80) | 7.8 | 1 | P3.Sentence (21), P2.Sentence (11) |
| Vowel Heavy | 20% (16/80) | 9.0 | 2 | P3.Sentence (18), P4.Sentence (13), P4.Word (10) |
| Escalation | 23% (18/80) | 8.9 | 2 | P3.Sentence (19), P4 spread |

### Skill gradient — greedy floor vs lookahead skilled line (detailed logger, n=80 greedy / n=40 lookahead)
| Archetype | greedy win% | lookahead win% | Δ (skill headroom) |
|---|---|---|---|
| Short Word | 1% | 5% | +4 (artifact-limited) |
| Long Word | 26% | 30% | +4 |
| Rare Letter | 11% | 13% | +2 |
| Doubled | 15% | 15% | **0 (flat — luck-dominated)** |
| Vowel Heavy | 20% | 33% | **+13** |
| Escalation | 23% | 33% | **+10** |

**Skill has real headroom for Vowel/Escalation (+10–13) but is flat for Doubled (0).** A flat
gradient means the Doubled outcome is decided by luck (did the doubled-letter racks + relics show up),
not by play quality — its relics fire on a *board condition* (doubled letter present) the player can't
manufacture. (`analyze:eval` will confirm with McNemar p-values + the decision-gap legibility metric.)

### Meta career win% (`analyze:meta`, greedy, Stake 0, 3 careers × 30 runs)
| Archetype | win% (with-gating / without) |
|---|---|
| Short Word | 2% / 2% |
| Long Word | **36% / 22%** |
| Rare Letter | 10% / 4% |
| Doubled | 11% / 9% |
| Vowel Heavy | 21% / 12% |
| Escalation | 30% / 27% |

**Reads:**
- **Short Word is effectively dead for the bot** (1–2%). Partly artifact (greedy/lookahead won't
  *choose* short words — top words played are long: `GHASTLY`, `OBESITY`), partly real: its key
  relics (`shortAndSweet ×3`, `flywheel +0.3/stack`) only fire on ≤3-letter words, and **snowball
  stacks stayed at 0 across all 80 runs** because the bot never plays the qualifying words. A human
  *committing* to short words could express it, but the harness cannot measure that, so Short Word's
  true strength is **unknown** — needs an author playtest, not a bot verdict.
- **Rare Letter is the weakest real archetype** (4–11%). It dies early (P3.Word x21) — the rareRich
  deck's vowel droughts + the cost of assembling a J/Q/X/Z payoff leave it behind the curve. Top
  words (`ZAX`, `QUACKED`, `QUIZ`) score big but come too rarely.
- **Long Word and Escalation lead** at both per-play and run level. Long Word benefits *most* from
  unlock-gating (36% with vs 22% without) — likely variance across only 3 careers, but it is the
  most forgiving line.

---

## 4. Bosses — Ceiling is inert vs the floor; Toll is over-broad; Vise can pure-luck-kill

### Boss survivability matrix (`analyze:boss`, 50 shared seeds, greedy) — FULL
| Persona | none | mute | ceiling | toll | vise |
|---|---|---|---|---|---|
| Short Word | 4.0% | 4.0% | 2.0% | **0.0%** | **0.0%** |
| Long Word | 38.0% | 40.0% | 38.0% | **22.0%** | **20.0%** |
| Rare Letter | 14.0% | 14.0% | 14.0% | **6.0%** | 8.0% |
| Doubled | 12.0% | 12.0% | 12.0% | 10.0% | 6.0% |
| Vowel Heavy | 26.0% | **20.0%** | 26.0% | **14.0%** | 18.0% |
| Escalation | 28.0% | **16.0%** | 26.0% | **14.0%** | 24.0% |

**Reads (per-boss):**
- **The Mute (vowels score 0) is correctly *targeted*** — it bites only the vowel-dependent builds
  (Vowel 26→20, Escalation 28→16, which plays vowel-heavy words) and is inert for Long/Rare/Doubled.
  This is "antagonize the target, don't kill" working as designed. ✔
- **The Ceiling (mult cap ×4) is the one genuinely inert boss vs the floor** — *every* column ≈ its
  "none" baseline (Long 38→38, Vowel 26→26, Escalation 28→26, Rare 14→14, Doubled 12→12). The greedy
  floor rarely builds mult past ×4, so the cap never triggers. Ceiling is meant to punish spun-up
  ×Mult engines — which the floor isn't — so its bite is invisible here. **It may feel like a
  free round most of the time** and only matter on a fully-spun late game. (A skilled spun-up
  lookahead line would show its teeth — worth a targeted check.)
- **The Toll (−15 Points/word) is over-broad** — it's the most punishing boss against *everyone*,
  not just its nominal target (short/many-word lines): Long 38→22, Vowel 26→14, Escalation 28→14,
  Rare 14→6. A flat −15/word scales brutally against archetypes that play many small-ish words and is
  felt by every build. Consider whether Toll should be this universally strong.
- **The Vise (no discards) punishes drought decks and is a pure-luck loss generator.** Win-rate
  effect is moderate (Long 38→20, Doubled 12→6), but the *failure mode* is the problem: detailed
  narratives show `FAILED (0/110) — dead-hand (no word, no discard)` (Short Word seed 2; Vowel Heavy
  seed 2 on the standard deck). The bag deals an unplayable opening rack and the Vise removes the only
  escape → **instant loss with zero agency**, even on the standard deck. This is the clearest
  **"pure chance decided the run"** violation in the game.

**Caveat (from the harness):** the boss matrix only fully carries "antagonize don't kill" signal once
the base curve is winnable >0% without bosses — which it now is for 5/6 archetypes, so these reads
are valid. Short Word's 0% on Toll/Vise is dominated by its ~4% base + the greedy artifact.

---

## 5. Meta economy, leveling & currency

From `analyze:meta` (greedy floor, Stake 0 only — a human earns faster):
- **Faucet:** Meta/run **15–28** (`earn.perRoundCleared 2` + `winBonus 10` + collected achievements
  + bounties). Unlock costs: relic 25, mod 20, deck 35, stake 15. So ~**1 relic unlock per run** for
  a competent line. **1st unlock always run 1.** All target relics unlocked by run 2–11 (Rare Letter
  slowest at 11, because it targets 4 relics). **Pacing looks reasonable.**
- **Leash is not a crutch:** with-gating ≈ without-gating win% (e.g. Escalation 30% vs 27%, Doubled
  11% vs 9%). Unlock-gating does *not* hide required power — exactly the design intent.
- **Leveling (lifetime Score → rank):** thresholds `0 / 4000 / 12000 / 28000 / 60000`. Greedy-floor
  Score/run is 670–1670. Runs to reach each rank: **Apprentice ~3–7, Journeyman ~8–17, Expert
  ~17–25, Artisan never in 30 runs** (every cell shows `—` for Artisan). Artisan (60k) is a
  *long-haul prestige* rank — fine if intended, but **a competent human may also find it a grind**;
  worth confirming the target is "dozens of runs," not "unreachable."
- **In-run `$` economy looks healthy.** `COINS_ON_CLEAR` (base 4 + 1/unused play + 1/unused
  discard) + interest ($1/$5 held, cap $5) + `recycler` funds **4–11 purchases per run** in the
  detailed logs (relics at $8, enchanted tiles at $7, upgrades at $5 all get bought). The target-buy
  bot reserves nothing and still affords its engine — no evidence the `$` faucet is too tight or too
  loose. (A hoarding human with interest would buy more; this is a floor.)
- **Achievements:** 12–19 of 29 fire for the bot. The **discovery bucket never fires** —
  `curator` (use every relic) and `enchanter` (apply every mod) require breadth the target-buy bot
  never attempts, and Short Word's win-gated achievements can't fire because it can't win. These
  aren't bugs, but the 29-achievement catalog's *effective* Meta payout for a real player skews
  toward the onboarding/mastery/progression buckets.

---

## 6. Scoring / engine correctness findings (NOT balance — verify & fix)

1. **Fractional score float-noise reaches the UI.** `scoreWord` computes `mult = (1 + addMult) *
   timesMult`; with fractional multipliers (`rareSurge ×1.5`, `longHaul ×1.25/letter`,
   `juggernaut`/snowball per-stack, the `catalyst` mod) the score is genuinely fractional and IEEE
   representation yields tails like `304.29999999999995`. The animated headline number is rounded
   (`ui.js:456`, `intFmt`), **but the running total `run.roundTotal` is displayed raw**
   (`ui.js:552`, `:689`, …) and the **score-breakdown formula prints `result.score` raw**
   (`ui.js:322`). A player on a spun-up run will see `304.29999999999995 / 290 Score`. *Fix options:*
   round per-play score in `playWord` (cleanest; makes Score integer end-to-end, and integer Score vs
   integer target is tidier) **or** round only at display. The first is a (small) logic change — author's call.
2. **Profanity filter is inert.** `CONFIG.PROFANITY_FILTER = true` but `PROFANITY_BLOCKLIST` is empty,
   so the bot played `FUCK` (it's in ENABLE). Intended? (CLAUDE.md notes "author may empty this".) If
   the APK ships to anyone but the author, the blocklist needs entries; if it's author-only, fine.

---

## 7. What the data says, in one paragraph

The **floor curve and bag health are good**; dead racks and vowel droughts are handled. The two
real balance problems are: **(a) snowball variance dominates the back half** — the run is decided by
how early the shop hands you your engine, not by skill, and the 240/290/355 tail is both too high
for a flat line and trivial for a spun one; and **(b) build diversity is too wide (~4.9×)** with
**Rare Letter underpowered**, **Short Word unmeasurable/likely weak**, and **Long Word + Escalation
dominant**. Bosses are mostly working: **Mute is correctly targeted at vowel builds; but Ceiling is
inert vs any non-spun line, Toll is over-broad (punishes everyone, not just its target), and Vise can
pure-luck-kill via an unplayable opening rack with no discard escape**. Meta pacing and the unlock
leash are healthy; Artisan rank and the discovery achievements may be out of reach. Plus two
non-balance engine nits (float score display, inert profanity filter).

---

## 7b. CHANGES APPLIED (2026-06-26) + before/after

Implemented on `worktree-balance-playtest` (TDD, 285 tests pass). **UI layer untouched** (no `ui.js`)
→ no overlap with the parallel UI session.

**Deterministic fixes (done, verified):**
- **Score rounded in the engine** (`scoreWord`: `Math.round(points*mult)`) — kills float noise in
  roundTotal / breakdown / lifetimeScore.
- **Bosses:** Vise keeps **1** discard (`warp.keep:1`, no more dead-rack instakill); Toll −15 → **−10**;
  Ceiling cap ×4 → **×3**.
- **Profanity blocklist** populated (46 entries; 42 block real ENABLE words).

**Numeric balance pass (first pass — author-approved magnitudes):**
- Snowball per-stack −⅓: juggernaut .15→.10, perpetualEngine .10→.07, flywheel .30→.20,
  rareAvalanche/resonanceEngine .20→.14, risingTide .12→.08.
- Targets: P3 130/160/195 → **125/150/180**; P4 240/290/355 → **220/260/315** (P1–P2 unchanged).
- Rare: rareHoarder +30→**+40**, rareSurge ×1.5→**×1.8**. Doubled unchanged (per author).

**Win-rate before → after (skilled `analyze:eval` lookahead2 rung, 50 seeds):**
| Archetype | before | after |
|---|---|---|
| Short Word | 6% | 4% (bot artifact) |
| Long Word | 34% | **44%** |
| Rare Letter | 16% | **26%** (laggard caught up ✔) |
| Doubled | 12% | 18% (left alone) |
| Vowel Heavy | 34% | 38% |
| Escalation | 32% | **46%** |

**boss matrix after:** Ceiling now bites (Long `38→32`, was inert); Toll gentler (Long `22→24`);
Vise no longer instakills Short (`0→2`); Rare baseline doubled (`14→28`). Legibility unchanged (p50 0.05–0.09).

**Verdict:** ✔ Rare fixed + bosses fixed + flat lines die closer (short 13–28 vs 30–45). ⚠ leaders now
~44–46% skilled (a touch high) — target relief lifted everyone. ✘ **engine-vs-flat bimodality NOT
closed**: snowball winners still overshoot (Long P4.Phrase 444/260 @16 stacks; Rare 366/260 @14).
**Next dial (author's call):** deeper snowball cut (−50%) + restore some P4 target, or lock & playtest.

## 8. Tuning questions for the author (original — answered; see §7b for what was applied)

These are decisions, not auto-fixes — see §8 follow-up where I'll propose concrete number sets once
you pick a direction.

1. **Snowball variance** — do you want to *compress the spun-vs-flat gap*? Options: lower the
   back-half targets so a flat skilled line can clear (helps non-engine builds, but makes spun
   engines a cakewalk), **or** soften snowball per-stack magnitudes + raise the early curve so
   engines ramp less explosively, **or** leave it (high-variance "did I hit my build" is a genre
   staple). This is the biggest lever and a fun-judgment call.
2. **Rare Letter** — buff it? (e.g. raise `rareHoarder` +30→+40, `rareSurge ×1.5→×1.8`, or add a
   vowel-safety valve to the rareRich deck.) Or is it meant to be the hard, high-skill archetype?
3. **The Vise + droughty decks pure-luck loss** — acceptable? Or should the Vise leave *one* discard,
   or should lean/rareRich get one guaranteed non-drought opening? (I lean: Vise keeps 1 discard.)
4. **Bosses:** (a) **Ceiling** is inert vs any non-spun line — raise the cap's bite (lower max-mult,
   or also cap base Points) so it's felt before the very end, or leave it as a pure engine-check? (b)
   **Toll** punishes every build, not just its target — soften (−15 → −10/word) or keep it as the
   universal "tempo tax"? (c) **Vise** — leave 1 discard so a dead opening rack isn't an instant loss?
5. **Artisan rank (60k lifetime Score)** — is "many dozens of runs / maybe never for a casual line"
   the intent, or should it be reachable in ~15–25 competent runs?
6. **Score rounding** — round per-play Score to an integer in the engine (my recommendation), or
   keep fractional and only fix the display?
7. **Profanity** — author-only build (leave blocklist empty) or populate it?

---

## 9. CURRENCY economy — $ and Meta (`analyze-currency.js`, 2026-06-26)

New harness `scripts/analyze-currency.js` instruments coin/Meta *flow* (the earlier passes only counted
purchases). Section A: per-run `$` by source / spend / rerolls / leftover, split won vs lost (150
seeds/persona, greedy + target-buy). Section B: Meta by source + full-collection timeline (3 careers ×
30 runs). **Author decision: document only — no currency numbers changed this session.**

### In-run `$`
| Signal | Measured | Read |
|---|---|---|
| Earn rate | **~7.4 $/round**, constant across all archetypes AND won/lost | uniform faucet |
| $/run won vs lost | 88–94 vs 45–65 | **pure survival** (winners play more rounds); per-round earn identical |
| Leftover at end | **~0–1** | faucet fully consumed, no hoarding |
| Interest | **0 for everyone** | bot never holds $5+, so the interest mechanic **never fires** — dead for spend-it-all play; only a hoarding *human* uses it |
| Reroll spend | **$12–24/run (~25–30% of income)** | a big sink — coins burned hunting target offers |
| Relics owned at end | winners **~1.5**, losers ~0.3 | engine built mostly from cheaper tile-mods; relics are offer-RNG + reroll gated |

**Key conclusion: coin scarcity does NOT drive the engine-vs-flat bimodality.** Per-round earn is flat
won-vs-lost, leftover ~0 — losers don't lose for lack of coins. *Retires the "loosen $ to fix
bimodality" hypothesis.* What gates the engine is **relic acquisition** (offer RNG + ~⅓ of coins lost
to rerolls), so the targeted economy lever *would be* relic availability (reroll cost / relic cost /
offer rate) — **but the author chose to fix the bimodality via the snowball/curve dial instead and
leave `$` untouched.**

### Meta
| Signal | Measured | Read |
|---|---|---|
| Meta/run | 17–27, **drip-dominated** (14–22) | achievements add only 3–5, **front-loaded** (early 20–49 → late 15–24, one-time) |
| Bounties | **~0** at Stake 0 | reward stake/deck variety the floor never exercises (by design) |
| Full collection | 640 Meta (relics 500 dominate) → **~24–30 runs** for a competent line | healthy long-tail collection arc |

**Conclusion: Meta pacing is healthy** (leash-not-crutch confirmed in §5). Two caveats: interest is a
dead knob for non-hoarders (documented, not changed — author may revisit), and the **Stake-0 floor
does not exercise bounties / higher stakes / locked decks** — so **Meta tuning is deferred until
stake-climb data exists** (author decision). The drip+ach faucet is well-matched to unlock costs.

### Currency decisions (author, 2026-06-26)
- **Interest:** leave as-is, documented (don't change yet).
- **`$` / relic access:** leave the coin economy alone; address the bimodality via snowball/curve.
- **Meta pacing:** revisit after stake-climb data (bounties/stakes/decks unmeasured at Stake 0).

---

## Appendix: methodology & repro

- New harness: `node scripts/playtest-detail.js --agent=<greedy|lookahead> --k --branch --n --detail
  --persona=<id|all>`. Read-only; mirrors `main.js` run-end orchestration (same achievement ctx as
  `analyze-meta.js`). Records per-encounter word lists, death point/reason, relics/hones/mods,
  purchases, achievements.
- Standard harnesses: `npm run analyze:corpus | analyze | analyze:sim | analyze:sim-v2 |
  analyze:eval | analyze:boss | analyze:meta`.
- `analyze:eval` (the skill-gradient / McNemar instrument) was started at `--n=120` but is the
  slowest; re-run at `--n=60 --k=2 --branch=4` for the skill-vs-luck delta (pending, §2 will gain a
  gradient row).
