# Letter Ride — Development Roadmap (prototype → substantial game)

**Date:** 2026-06-22 (rev. 2, post spec-review + author discussion) · **Author call:** Joel. **Status:** active strategic roadmap; supersedes the "deferred wishlist" of the original 4-tier plan (`docs/2026-06-20-letter-ride-plan.md`). Grounded in the design spec, the two genre-research docs, and the archetype framework.

## Where we are

Tiers 0–3 complete (core loop, meta-progression, Android/Capacitor scaffold) + a P1 polish pass (telemetry, legibility) + a just-shipped **archetype expansion** (6 archetypes + Hone + enabler relics + archetype-leaning bags; 127 tests green). The result is a **fun, mechanically deep** word-builder roguelike that is, today: structurally flat (round → shop → round), hard to read (bags/archetypes/Hone lack player-facing copy), visually unstyled, and **unvalidated in real play since the archetype layer landed.**

## What "substantial" means here (definition of done — author-set 2026-06-22)

**Not breadth.** The finish line is **bosses + events** layered on a **scoring system whose boundaries we actually understand and whose mechanical vocabulary is locked** — so every piece of content is designed coherently inside that system (or *deliberately breaks it* for fun). Co-viable archetypes are a *means*, not a target count; we cut/merge/add archetypes freely. A "done v1" is: a textured run (bosses + events), a bounded-and-understood scoring system with a defined effect/letter/word vocabulary, and enough content to exercise it — playable and fun on the author's phone.

## The cardinal rule (sequencing principle)

**Validate → know your boundaries → texture → content → feel → longevity, with gates between.** The genre's classic failure (and the scope-creep the author caught) is adding breadth on top of an unvalidated, *un-bounded* core. So: prove it's fun, then *map the system's limits and lock its vocabulary*, then build bosses/events/content inside those limits.

## Balance philosophy (author-set)

**Co-viability, not equality — and breaking the system is part of the fun.** Each archetype should be *able* to win; they need not win at equal rates. Discovering a degenerate synergy that obliterates a target (Balatro-style ×Mult blowup) is a **feature**, not a bug. We do **not** reflexively cap or nerf. We intervene only when an archetype is *dead/unwinnable*, or when a single line is a *zero-decision no-brainer* that removes all choices. The earlier "899% / 1646%" figures are **static peak-score ratios** from one instrument (`analyze-builds.js`, fixed builds, Escalation measured at play #4) — **not win rates**; treat them as curiosities, not nerf targets. The binding balance signal is full-run **win rate** from the eval harness + the author's play.

## Core play-loop decision (author-set 2026-06-22)

**Moving from Model A (fresh rack every play) → Model B (persistent hand, consume-and-draw).** Today the engine fully redraws the 9-tile rack after every play (`main.js` calls `drawRack` on each `onSubmit`), so the bag is only a draw distribution and discard is a full reroll. Model B: you hold a hand, a played word *consumes* its tiles, you *draw back up*, unused tiles persist, and discard becomes *selective*. This makes the deckbuilding + tiles-as-instances pillars into actual hand-management skill and is the substrate for chaining/combos. **It is the highest-priority change — it gates Phase 0 balance tuning** (tuning under Model A would be wasted), so it lands *before* 0c. (The reported "discard nukes all tiles" bug is a symptom of this model mismatch; selective discard falls out of Model B.) Open sub-decision: bag depletion semantics (see immediate priorities).

## Ambition decision (DEFERRED — revisit before Phase 4)

Chosen 2026-06-22: **decide later.** Phases 0–3 are identical whether this stays a deep personal game or aims for a release; only the Phase 4 (identity/juice/onboarding) bar changes. Until then: optimize for "fun on the author's phone," **solo** (no outside playtesting — the eval harness carries the objective signal).

## Phases

| Phase | Theme | Why this slot | Effort |
|---|---|---|---|
| **0 — Now** | Validate & tune the core | Everything downstream is wasted if the core isn't fun and at least co-viable | Low–Med |
| **1** | **Systems & Boundaries study** *(the spine)* | Can't design bosses/events/content without knowing the scoring system's limits + a locked mechanical vocabulary | Med |
| **2** | Run texture: bosses + events | The #1 "not substantial yet" gap — the author's headline want; designed *inside* the known boundaries | Med–High |
| **3** | Mechanics & content (only what Phase 1 greenlit) | Build the in-scope mechanics; content serves texture + vocabulary, not a relic count | Med (ongoing) |
| **4** | Feel, identity & visuals | The "substantial feel" — but juice on an unproven game is lipstick; revisit ambition here | High |
| **5** | Longevity & endgame (trimmed) | Long-tail "one more run" — lighter for a solo game | Low–Med |

*Cross-cutting, continuous: **simulated-player eval harness** (built in 0b, re-run as a gate every later phase); Android APK + on-device validation (incl. the 172k-word dictionary load into the WebView); **save-schema versioning** (graceful drop of unknown relic/mod/deck ids so content updates never brick an active save); telemetry of real play.*

### Phase 0 — Validate & tune the core
- **0a — Legibility first** (so play is informed): player-facing descriptions for bags, the 6 archetypes, and Hone. Agent drafts; **author approves copy.** Pull a **thin feel slice** alongside (score-tally/cash-out feedback) so the fun-verdict isn't rendered on an inert build — light, not the Phase 4 art.
- **0b — Eval harness v1** (test infrastructure — *not* new game breadth, so it doesn't violate "don't expand"): a **new** lean `sim` module that *drives* `run.js` end-to-end (`newRun → {play|discard} → nextRound → generateShop → purchase`), reusing only `canForm` + `scoreWord` from the existing static `analyze-builds.js`. v1 deliverables: a legal-word-move enumerator (promote `canForm`), a `Policy` interface (`chooseWord`, `choosePlayOrDiscard`, `choosePurchase`), the run driver, and win-rate aggregation across seeds. **Personas: the 6 archetype-committers only** (greedy toward their build). Defer solver/chaos/economy/node personas. **Timeboxed with a "fall back to manual tuning if v1 runs long" off-ramp.** Perf: bucket the word list once and reuse across turns; cap seeds×personas for gate re-runs.
- **0c — Tune to the gate:** author plays (the *fun* judgment) + eval win-rate data (the *balance* signal). Tune hone increments, enabler power, the target ladder. Don't over-balance — preserve the "break it" highs.
- **Exit gate:** core is fun with the added depth; every archetype is *winnable* (no dead ones); no zero-decision no-brainer line.
- **Failure branch:** if the core isn't fun, or an archetype can't be made winnable without breaking a pillar → **revise/cut/merge the archetype set** (nothing is locked; the archetype doc lists merge candidates, Escalation first) or revert the expansion — *before* any Phase 1+ work. Don't paper over a design failure.

### Phase 1 — Systems & Boundaries study (the spine)
Map the scoring system's real limits and **lock the mechanical vocabulary**, so bosses/events/content are designed coherently. Powered by the eval harness (it *measures* the boundaries). Outputs a short **"systems bible"** doc. Covers:
- **Score-growth curve & ceiling:** with the best legal build, max score per round vs. the target ladder `[40…600]` — headroom or trivialized?
- **The ×Mult blowup:** how many `×Mult` sources stack and the resulting product. Given "breaking it is fun," the question is *how high we let it go* and *whether targets chase it* — a deliberate dial, not a cap.
- **Effect vocabulary** *(candidate-IN: all)*: beyond `+Points/+Mult/×Mult` — retriggers, tile transform/destroy, per-word-property effects, and the **negative/warp effects bosses need** (disable / cap / tax / lock).
- **Letter mechanics** *(candidate-IN)*: tile values, wilds, rares, bag rules; potential tile-upgrade tiers, positional bonuses.
- **Word-combos / chaining** *(candidate-IN)*: consecutive-word relationships (letter-chain, length-ladder, shared-tile) — bound it as a new scoring dimension.
- **Word-types** *(candidate-IN)*: suffix/prefix/digraph (`-ING/-ED/-LY/QU/TH`) as POS-lite (true POS stays out — needs a tagged lexicon).
- **Decision per mechanic:** define its *boundary* (range, cost, interaction with the formula) and whether it's IN for the v1 system. Locking the vocabulary is the gate.
- **Exit gate:** we can state the system's boundaries (curve, ceiling, dials) and the locked effect/letter/word vocabulary; bosses and events are now designable.

### Phase 2 — Run texture: bosses + events (headline want)
Replace the flat round→shop with a shaped run, designed *inside* Phase 1's boundaries. Sub-projects, one at a time (each its own design → build → playtest), eval harness re-run as a gate (run flow changed):
- **Node variety:** pick-a-node (shop / event / forge / hone-bench) + skip-with-tag.
- **Archetype-antagonist bosses:** periodic boss rounds whose rule-warps come from the *locked negative-effect vocabulary* (e.g. "vowels score 0," "×Mult capped," "doubled bonuses off") and attack the player's committed build → force pivots/counters.
- **Events:** small risk/reward choice nodes (trade tiles, anagram challenge, etc.).
- **Exit gate:** a run has rising tension, meaningful between-round choices, and memorable boss moments.

### Phase 3 — Mechanics & content (only what Phase 1 greenlit)
Build the in-scope mechanics (combos / word-types / affixes / richer effects / letter systems) and the relics/mods/enablers that exercise them. **Breadth de-emphasized** — content serves the texture and the vocabulary, not a relic count.

### Phase 4 — Feel, identity & visuals (revisit ambition first)
Real art direction + a genuine hook (the scrabble-bag motif is a seed), scoring/chain/boss-reveal animation, sound — the cohesive identity that makes it *its own thing*. **Author wants a staff game-designer perspective here when we arrive.**
- **Exit gate:** feels good to touch on a phone; recognizable identity.

### Phase 5 — Longevity & endgame (trimmed for solo)
Optional: difficulty/stakes ladder, daily-seed / challenge runs, run history. Lighter than for a commercial release.

## Simulated-player evals & actor personas (cross-cutting infrastructure)

**The idea:** scripted "actor personas" that play *full runs* headlessly end-to-end via a decision policy, across many seeds, reporting outcomes. Reusable every phase as balance + regression + soft-lock testing — freeing the author's manual play to focus on *fun*, while the machine catches dead archetypes, soft-locks, and regressions. (Distinct from telemetry, which records the author's *real* play; note Escalation's telemetry play-share is 100% by design (`matches: () => true`), so don't naively compare the two sources.)

**Honest scoping (per spec-review):** this is a **new `sim` driver on top of `run.js`**, not an extension of the static `analyze-builds.js` — it reuses only `canForm` + `scoreWord`. The decision-policy layer is where the effort lives, so v1 is deliberately minimal: **6 archetype-committer personas, greedy heuristics, win-rate output, timeboxed, with a manual-tuning off-ramp.** Later increments add personas (greedy-best-word + scripted-heuristic-purchase as a "ceiling" probe — *not* a true best-EV solver, which is an unbounded search; chaos/fuzzer for soft-locks; economy) and node-aware play once Phase 2 lands.

**Outputs:** per-persona win rate by round/stake, where runs end, build/relic distribution, economy curves, and **per-archetype win-in-deck rate** (the real co-viability signal). Flags: any *dead* archetype; any soft-lock; any zero-decision no-brainer line. (Not "flag anything above the pack" — high ceilings are allowed.)

## Guardrails (anti-scope-creep)
- Don't start a phase until the previous gate passes; one subsystem at a time, playtested between.
- **Never break the pillars:** one formula `Score = Points × Mult`, **phase-ordered** — all `+Mult` sum into `(1 + Σ)` *first*, then all `×Mult` apply, independent of acquisition order (`scoring.js`); three currencies only (Points / $ / Meta); scarcity (letters always drawn from a bag). *(Note: CLAUDE.md still uses pre-rename terms "Wit"/"chips" — update it to Points/Score/$.)*
- **Breaking the system via synergy is intended fun** — don't reflexively cap; intervene only on dead archetypes or zero-decision no-brainers.
- Don't author content before Phase 1 locks the vocabulary; don't style before gameplay is proven.
- AI builds systems + drafts copy for approval; the **author judges fun and owns final balance/copy calls.**

## Immediate priorities (next moves) — updated 2026-06-23

**Done this session (on `main`):** Model B persistent-hand/consume-and-draw loop (live, browser-smoked) · archetype expansion (6 + Hone + enablers + bags) · eval harness **v1 + v2** (the skill-vs-luck instrument) · CLAUDE.md terminology synced to code (`Score = Points × Mult`, `$`) · harness **smartDiscard** (honest dead-rack measurement) · two project skills (balance-analysis, browser-smoke). 166 tests green.

**Harness v2 verdict (the evidence base for tuning):** even *skilled* shopping personas win **~0%** (Long-word 2% the lone survivor), p50 round 3–4 → **the curve (`ROUND_TARGETS`) is too steep even for skilled play — the #1 tuning target.** Post-smartDiscard dead-rack%: rareRich 17% (clog handled), **lean 37% (a real vowel-drought → the discard-count / lean-composition lever, NOT a vowel floor)**. Re-run `npm run analyze:sim-v2` after any tuning.

1. **Phase 0a — descriptions + thin feel slice** *(buildable now):* agent drafts bag / 6-archetype / Hone player-facing copy → **author approves**; light score-tally feedback (the UX doc's rolling counter + tap-to-skip from the first animation).
2. **Phase 0c — tune to the gate (AUTHOR):** pull `ROUND_TARGETS` down so a **skilled line clears the median draw**; compress the archetype spread toward co-viability; tune discard for the lean drought. Re-run the harness as the gate. **Don't silently pick numbers** — author playtest call.
3. **Phase 1 — Systems & Boundaries study (the spine):** map curve/ceiling + **lock the mechanical vocabulary** incl. the **negative/warp effects bosses need**; lean into true ×Mult (the Spellatro-weakness moat); favor relics that change *which words you want to spell*. Produce the systems bible. *Bosses/events (Phase 2) wait on it.*

**Deferred author decisions** (none block 0a): the **curve target** (0c) · the **scarcity pillar** (contested by the appendix data — recommend keep; decide before Phase 4) · **position-as-skill-lever** (Phase 1; author leans yes) · **infinite-combo cap-or-embrace** (Phase 1) · a **distinctive/thematic base-points name** vs generic "Points" (Phase 4 identity).
