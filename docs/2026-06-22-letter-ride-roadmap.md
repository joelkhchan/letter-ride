# Letter Ride — Development Roadmap (prototype → substantial game)

**Date:** 2026-06-22 · **Author call:** Joel. **Status:** active strategic roadmap, supersedes the "deferred wishlist" section of the original 4-tier plan (`docs/2026-06-20-letter-ride-plan.md`). Grounded in the design spec, the two genre-research docs, and the archetype framework (`docs/2026-06-22-letter-ride-*.md`).

## Where we are

Tiers 0–3 are complete (core loop, meta-progression, Android/Capacitor scaffold) plus a P1 polish pass (telemetry, legibility) and a just-shipped **archetype expansion** (6 archetypes + Hone invest-to-scale + enabler relics + archetype-leaning bags; 127 tests green). The result is a **fun, mechanically deep** word-builder roguelike that is, today: structurally flat (round → shop → round), hard to read (bags/archetypes/Hone have no player-facing descriptions), visually unstyled, and — most importantly — **unvalidated in real play since the archetype layer landed.**

## The cardinal rule (sequencing principle)

**Depth → legibility → texture → content → feel → longevity, in that order, with gates between.** The genre's classic failure (and the one this roadmap exists to prevent) is adding breadth on top of an unvalidated, illegible core. Slay the Spire built a metrics server at prototype stage to tune *before* expanding; Letter Ride already has the telemetry + harness to do the same — so use them before building more.

## Ambition decision (DEFERRED — revisit before Phase 4)

Chosen 2026-06-22: **decide later.** Phases 0–3 are identical whether this stays a deep personal game or aims for a release; only the Phase 4 (identity/juice/onboarding) bar changes. Revisit the release question at the Phase 3→4 gate. Until then the CLAUDE.md framing holds: optimize for "fun on my phone," not store-readiness.

## Phases

| Phase | Theme | Why this slot | Effort |
|---|---|---|---|
| **0 — Now** | Legibility quick-wins + validate & tune the core | Can't tune or enjoy what you can't read; everything downstream is wasted if builds aren't fun *and* fair | Low |
| **1** | Onboarding & game-feel basics | Make it playable without the author present; cut friction | Low–Med |
| **2** | Run-structure texture (nodes · bosses · events) | The flat loop is the #1 "not substantial yet" gap — but must sit on a *proven* core | Med–High |
| **3** | Build depth & content volume | Replayability; only worth authoring once the frame is fixed | Med (ongoing) |
| **4** | Identity, visuals & juice | The "substantial feel" — but juice on an unfun game is lipstick | High |
| **5** | Longevity & endgame | The long-tail "one more run" | Med |

*Cross-cutting, continuous: **simulated-player evals / actor personas** (see dedicated section — built early, re-run every phase as balance + regression + soft-lock testing); Android APK + on-device touch validation (prove early, keep working); telemetry-driven balance tuning every phase.*

### Phase 0 — Prove it's fun *and* fair (validate, don't expand)
- **0a — Legibility first** (so the playtest is informed): player-facing descriptions for bags, the 6 archetypes, and Hone (the "I dunno what the bags do" gap, and the hone "what it scales" gap). Agent drafts; **author approves the copy.**
- **0b — Eval harness v1** (see Simulated-player evals below): extend the static `analyze-builds.js` into a full-run simulator driven by a few actor personas, reporting per-archetype win rates, dominant-strategy flags, and soft-locks across many seeds. This *powers* the tuning — far more signal than manual play alone.
- **0c — Tune to the gate:** author plays committed-archetype runs (the *fun* judgment) while the evals supply the *balance* data; tune the **Long-word (899%) / Escalation (1646%) outliers**, hone increments, and enabler power until every archetype wins at comparable rates and no single line dominates. Protect the "giddy high" of a huge word.
- **Exit gate:** author can win with 3–4 *distinct* builds; evals show comparable per-archetype win rates with no degenerate dominant line; the core still feels fun with the added depth.

### Phase 1 — Teachable & responsive
- First-run tutorial / guided first round; the "a valid word exists" dead-hand affordance (R10); stronger live scoring feedback (why a word scored X — JokerDisplay-style, partly built).
- **Validate the actual APK on-device** here (touch UX, performance) — first real proof it's the phone game it's meant to be.
- **Exit gate:** a first-time player completes a run without external explanation, on a phone.

### Phase 2 — Give the run an arc (structural texture)
- The flat round→shop becomes a shaped run. Sub-projects, designed **one at a time on a tuned core** (each its own spec → plan → build → playtest):
  - **Node variety:** pick-a-node (shop / event / forge / hone-bench) + skip-with-tag.
  - **Archetype-antagonist bosses:** periodic boss rounds with rule-warps that attack the player's committed build (e.g. "vowels score 0," "doubled bonuses off," "Mult capped ×3"), forcing pivots/counters — this makes the archetype system *matter*.
  - (Optional) a light branching path between nodes.
- **Exit gate:** a run has rising tension, meaningful between-round choices, and memorable boss moments.

### Phase 3 — Depth & build variety
- base→upgrade relic tiers (R-E); affix/digraph synergies (-ING/-ED/-LY/QU/TH) as POS-lite; word-chaining/combo content (deepens Escalation); more tile-mods, enablers, decks; archetype-weighted shop offers (R-F).
- **Exit gate:** ~20–30 relics, ~6 deep archetypes; runs rarely feel same-y.

### Phase 4 — Identity, visuals & juice (revisit ambition first)
- Art direction + a genuine hook (the scrabble-bag motif is a seed); scoring/chain/boss-reveal animation; sound; the cohesive aesthetic that makes it *its own thing*, not "Balatro with words."
- **Exit gate:** the game feels good to touch on a phone and has a recognizable identity.

### Phase 5 — Longevity & endgame
- Difficulty/stakes ladder (ascension-style); daily-seed & challenge runs; achievements; run history/stats; (optional) local leaderboards.
- **Exit gate:** there's always a reason for "one more run."

## Simulated-player evals & actor personas (cross-cutting infrastructure)

**The idea:** scripted "actor personas" that play *full runs* headlessly end-to-end — choosing words, purchases, discards, and (later) nodes by a decision policy — across many seeds, reporting outcomes. Reusable every phase as balance + regression + behavior + soft-lock testing. This is what frees the author's manual playtesting to focus on *fun*, while the machine catches dominant strategies, dead ends, and regressions.

**Why it's feasible here:** the logic layer is already pure, DOM-free, dependency-injected, and deterministic (seeded RNG) — the engine can be driven headlessly with no UI. The existing `analyze-builds.js` is the seed (it scores best words statically); evals extend it to *full-run simulation with decision policies*. (Distinct from telemetry, which records the author's *real* play.)

**Actor personas (the "several types of users"):**
- **Novice/casual** — plays the first/short valid word, buys cheap or random, no build plan. ("Is it beatable & fun for non-optimizers?")
- **Archetype-committers** (one per archetype: short, long, rare, doubled, vowel, escalation) — pursue a coherent build + buy coherent offers. (Per-archetype *full-run* win rate — the real co-viability test, vs. the static harness.)
- **Economy/greedy-$** — hoards $, leans interest/recycler. (Economy balance.)
- **Solver/optimal-ish** — approximates best-EV play each turn. (Ceiling + "is there a degenerate dominant strategy?")
- **Chaos/random** — random legal choices. (Floor + crash/soft-lock fuzzing: dead hands, unwinnable states, edge cases.)

**Outputs:** per-persona win rate by round/stake, where runs end, build/relic distribution, avg word length, economy curves, and **per-archetype co-viability** (StS "win-in-deck rate," simulated rather than waited-for). Flags: any archetype far above/below the pack; any soft-lock; any single dominant line.

**Lifecycle:** lean v1 in Phase 0b (extend `analyze-builds.js`; a few personas). Grow personas/policies as content lands. **Re-run as a gate** at every later phase — especially Phase 2 (nodes/bosses change run flow) and Phase 3 (new content) — so balance and soft-lock safety are re-proven automatically. Gets its own lean spec/plan when built (it's infrastructure, lower-ceremony than gameplay subsystems). **Evals validate balance/behavior/regressions; the author still judges fun — the two are complementary, not substitutes.**

## Guardrails (anti-scope-creep)
- Don't start a phase until the previous phase's gate passes.
- One subsystem at a time, playtested between (no "build all four at once").
- Never add a 4th currency or break the one-formula (`Score = Points × Mult`, phase-ordered) or scarcity (letters always from a bag) pillars.
- Don't style before gameplay is proven. Don't author content before the frame is fixed.
- AI builds the systems; the **author judges fun/balance and writes player-facing copy** — surface tuning questions, don't silently pick "balanced" numbers.

## Immediate priorities (next moves)
1. **Phase 0a — descriptions:** agent drafts bag/archetype/Hone player-facing copy → author approves (small, unblocks informed play).
2. **Phase 0b — eval harness v1:** agent extends `analyze-builds.js` into a full-run persona simulator (a few actor personas, per-archetype win rates + soft-lock flags across seeds). Gets a lean spec first.
3. **Phase 0c — tune to gate:** author plays committed-archetype runs (fun) + eval data (balance) → tune Long/Escalation outliers + hone/enabler power until the Phase 0 gate passes.
4. Then Phase 1 (onboarding + on-device APK validation).
