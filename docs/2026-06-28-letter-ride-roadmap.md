# Letter Ride — Roadmap (2026-06-28)

**This supersedes all prior roadmap files** (`2026-06-20-plan`, `2026-06-22-roadmap`) and the
2026-06-26 review/rebalance idea docs. It is the single forward-looking plan. Canonical reference
docs (the design spec, systems bible, brand identity, archetype framework, and the five research
docs) remain authoritative for *what the game is*; this doc is *what we do next and why*.

## Where the game stands (2026-06-28)

A complete roguelike skeleton: ~29 relics, 10 tile-mods, 6 hone archetypes, 7 tile-bags, bosses,
events, a meta loop (unlocks/stakes/loadout/levels/achievements), and a finished feel layer. This
week's work fixed the active legibility problems (itemized score readout, concrete relic/mod/hone
wording, first-run onboarding) and added variety (multi-tile imprint, per-bag identities, a Classic
bag). **The skeleton is done. The open problem is depth.**

## Core diagnosis (from the harness + real player data, 2026-06-28)

The author DECIDED to keep the **×Mult engine fantasy** — the fun is watching ×Mult × ×Mult compound
into a big number (the Balatro payoff). The data says the fantasy is fine; players never *reach* it.
The disease is the **acquisition & commitment funnel**, not the engine's power:

1. **Acquisition.** Engine pieces don't reliably arrive — real player owned 3 relics across 3 runs,
   $0 by round 2, walled at rounds 2-5. (The 2026-06-26 review §4b "reliable relic acquisition" named
   this and it was never built.)
2. **Consistency.** The starting bag was enlarged 26→54 for draw variety; this *dilutes* engine
   pieces — count-based synergies ("2+ of a letter," doubled) fire rarely, racks turn clunky
   (low-vowel, high-value-consonant). This **contradicts the research's scarcity-as-depth basis**
   and the corpus numbers were never re-run on the larger bag.
3. **Commitment & legibility.** Nothing teaches or signposts the player to *commit* to a build, and
   nothing shows which owned/offered pieces form an engine. Real player played generic ~5-letter
   words (19 of 36 plays length 5; one short word, one doubled word all session) and committed to
   nothing — the failure mode onboarding research never addressed (it teaches the *formula*, not
   *build selection*).

**Design thesis: keep the ×Mult fantasy; make the engine reliably buildable, consistent, and
legible.** Balatro delivers this joy via a small focusable deck + a coherent shop + clear synergy
reading. We under-deliver on all three. We do NOT cap or nerf the engine.

## Research sufficiency (audit, 2026-06-28)

Strong on: payoff legibility/juice, what-not-to-do, the position-lever's legitimacy, the archetype
skeleton. **Silent on the four things the next phase turns on:** engine-online pacing; bag-size vs
engine-piece density (the variety↔consistency tension, un-anticipated by every doc); floor-archetype
viability *without a length cap* (Spellatro's worked example depends on a 6-letter cap we rejected);
the bimodal difficulty cliff. **Three of those four are answerable by harness/instrumentation work,
not new web research.** Only the position-lever surface and anti-bimodal design need fresh design
thinking. → Do not commission more competitive research; build measurement and make calls.

Stale, do-NOT-design-against: vowel-floor (reversed in the empirical doc), "short-word is dominant"
(contradicted), any fixed archetype % (stale the moment config changes), 26-tile corpus numbers
(re-run on the 54-tile bag before trusting).

Current empirical snapshot (for context, not a target): per-play spread Escalation 2191% / Long-word
1181% dominate, Short-word 471% / Vowel-heavy 508% floor (~4.6×). Skilled-bot win rate 0-2.5%, walls
round ~5/12 — but the bot plays greedy single words and never builds an engine, so it measures the
*no-engine* line, not a committed build. Recalibrating that instrument is Phase A.

## Roadmap

### Phase A — Instrument (cheap; unblocks everything; mostly internal harness work)
- **A1. Discard + letter-usage telemetry.** Track per-letter played / discarded / left-in-rack and
  discard frequency; surface in stats + export. Answers "what do I dump / overuse" and *measures the
  variety problem* directly. (telemetry.js + export.)
- **A2. Re-run the corpus on the 54-tile bag** and add a count-synergy hit-rate comparison @ 26 vs 54
  tiles. Quantify the dilution before re-tuning the bag.
- **A3. Recalibrate the harness persona** to a *commit-to-archetype buyer* (buys + thins toward one
  build), so win-rate measures "can a committed build clear the curve?" — the real question. The
  current greedy bot measures the no-engine line and reads 0%, contradicting the "too easy" reality.

### Phase B — Make the engine reliably buildable (keeps the fantasy; gated on A)
- **B1. Reliable relic acquisition** (2026-06-26 §4b, still open): cheaper/free rerolls +
  archetype-weighted offers + a dedicated **"pick 1 of 3 relic" node**. NOT forcing a relic into
  every shop (tried and reverted 2026-06-28 — keep the luck-of-the-draw, add reliable *paths*).
- **B2. Bag consistency.** Pull rares (J/Q/X/Z) out of the Standard bag (let Rare Cache own them);
  make bag-sculpting (thin / targeted letter buys) cheaper and more available, so the player can
  *focus* the rich bag toward an engine. Resolution of the tension: **variety is the start, focus is
  earned** (Balatro's start-broad-then-prune arc).
- **B3. Early-game economy.** Tune income so the first engine pieces are affordable by ~round 2-3
  (data shows $0 at round 2). Re-check interest/clear rewards vs shop costs.
- **Gate:** re-run A2/A3 + author playtest — a committed build should reliably come online mid-run,
  and a no-engine line should progress on skill past round 5 (compress the variance cliff from the
  *floor* up, without capping the ceiling).

### Phase C — Commitment & legibility (the product layer)
- **C1. Build signposting / shop coherence:** offers lean toward the player's nascent build; a light
  "you're leaning <archetype>" cue. (Principle exists in research; no algorithm yet.)
- **C2. Synergy-cluster legibility:** at purchase and in the relic strip, show which owned/offered
  pieces combine into an engine (distinct from score-reveal juice, which is done).
- **C3. Onboarding-into-a-build** (extend the first-run help to suggest leaning into a bag's
  identity) + **HUD mobile cleanup** (the top bar's mixed button sizes/shapes read messy on phone).

### Phase D — Depth levers (only after the funnel works)
- **D1. Position / sequencing lever** (author likes it; the ceiling-raiser). Prototype *contained*
  first — one relic family ("×Mult relics fire in order") or an opt-in scoring mode — and resolve the
  documented "engine discipline vs position lever" tension before any engine-wide change. High risk;
  do not rewrite the scoring engine speculatively.
- **D2. Gap-filler content:** affix (-ING/-ED) + digraph (QU/TH) relics (the missing word-shape
  family); a peek / swap-one-tile draw lever. **SKIP letter-mastery** (a letter that grows with play)
  — it is the deferred Tier-4 "leveled alphabet / letter XP"; do not pull forward without explicit
  sign-off.
- **D-optional.** Loadout opt-in + penalty (convert auto-applied loadout into a pre-run risk/reward
  choice); Wordle-style event. Polish, not depth.

### Phase E — Ship (Tier 3, the last roadmap tier)
Android APK via Capacitor is the final tier. Already shipping via the debug APK + reinstall flow;
proper packaging is gated on Phases B/C landing and an author playtest. See `tier3-plan`.

## Open decisions for the author (these gate scoping)
1. **Variety-vs-consistency philosophy** — confirm "variety as the start, focus as earned" (keep the
   rich bag, make focusing cheap) vs. shrinking the bag back toward the research's scarcity model.
   *Recommended: variety-as-start.*
2. **Difficulty model** — accept the bimodal "build-or-bust" cliff as intended, or smooth it from the
   floor (income floor / catch-up so a no-engine line still progresses on skill)? *Recommended:
   smooth from the floor; never cap the ceiling.*
3. **Position lever timing** — prototype now (D1) or after the funnel (B/C) lands? *Recommended:
   after.*

## Tier discipline (unchanged)
Do not build the Tier-4+ wishlist: leveled alphabet/letter-XP (= letter-mastery, see D2), variable
word length, branching run map, true part-of-speech synergies. Bosses/events/meta are built. If a
deferred feature seems needed, STOP and ask.
