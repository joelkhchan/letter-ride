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

## Decisions locked (author, 2026-06-28)

1. **Bag: shrink back to the scarcity model.** Reverse the 26→54 enlargement; bring bags back to
   ~26 tiles (keep their identities, just denser/focused), pull rares out of Standard, keep the new
   Classic bag. Consistency beats draw-variety for an engine game; a focused bag is pro-skill.
2. **Difficulty: BUILD-OR-BUST (not floor-smoothing).** Targets stay steep; by ~round 5 a skilled
   player should already be assembling the engine that carries them. We do NOT lift a no-engine
   floor. **CRITICAL CONDITION:** build-or-bust is only fair if assembly is *agency-driven* (shop
   picks, events, saving $, word skill) — and the data shows the funnel currently fails this
   (3 relics across 3 runs, $0 by round 2). So **the assembly funnel + economy (Phase B) is the
   entire skill expression**, and fixing it is the central work. Busting must be the player's fault
   (didn't prioritize/save/pick), never the shop's.
3. **Position lever: after the funnel** (Phase D, post-B/C).

Consequence for measurement: under build-or-bust the greedy no-engine bot reading ~0% is *correct*
— the no-engine line should lose. Phase A3 (a build-assembling buyer persona) is therefore required
to tell a *fair* funnel from a *starved* one.

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

Empirical snapshot (2026-06-29, AFTER Phase-A instrument fixes — context, not a target):
- **Eval personas had drifted** (never bought content added in later sessions). Refreshing them
  (archetype mods compact/stretch/lode/twin/bloom, Pithy for short, Overtime generic, right bags)
  flipped the per-play picture: **Short-word 471% → 1014%** — it was never weak, the persona just
  wasn't equipped. Per-play spread compressed ~4.6× → ~3.8× (Escalation 2058% ceiling, Vowel-heavy
  543% floor). Much of the "build-diversity problem" was a harness artifact. LESSON: re-validate the
  harness after content changes.
- **Full-run win rate stayed 0-4.5% (walls ~round 5)** even with corrected personas + keystone
  banking. The per-play(1014%)-vs-full-run(0%) divergence for Short-word ISOLATES the bottleneck:
  builds are strong WHEN online, but the economy can't get the kit (relics + hone L3 ≈ 30-40+ coins)
  online before the curve walls the run. **The bottleneck is acquisition speed / economy, NOT build
  design.** This is the Phase B thesis, now confirmed with a corrected instrument.
- Remaining instrument limit (pre-existing, not drift): full-run play policy is greedy-best-word
  (auto-adapts to relics via scoring, but no multi-word/chain optimization, wilds treated as dead) —
  so absolute %s are a FLOOR. Fine for gating economy work; an archetype-aware play policy is an
  optional later refinement.

## Research-confirmed patterns (deep-research run, 2026-06-29; 18 claims survived 3-vote verification)

The competitive research confirms our locked direction and hands us a Phase-B toolkit. (The run's
auto-synthesis step was buggy — placeholder output — but the verified claim set is sound.)
- **Fair-acquisition triad (all confirmed):** constrained "pick 1 of 3" pools + reroll tools +
  *hidden pity* that raises offer relevance the longer you go without it. (The stronger "guarantee a
  build reward after every boss" was KILLED 0-3 — use reliability, not a hard guarantee. Fits
  build-or-bust: reliable ≠ handed to you.)
- **Economy (Balatro, confirmed):** interest = $1 per $5 held with the cap as a *deliberate soft
  ceiling* that rewards saving then forces spending; reroll cost *escalates within a shop*; "buy
  economy early, don't overspend." → our interest cap ($5) is too tight; consider escalating reroll.
  (Specific StS gold numbers were KILLED — copy shapes, not absolute values.)
- **Lean focused deck (confirmed):** "keep the deck lean via removal; adding cards dilutes." Word-
  specific: "holding duplicate tiles drastically reduces playability"; "low-point tiles are more
  valuable to retain than high-point" (Scrabble leave value). → validates the bag shrink AND tells us
  *which* tiles to make cheap to thin (dump high-value clunkers, keep low-point connectors).
- **Commitment via an ANCHOR (Monster Train champions; Balatro "commit to 1-2 builds", confirmed):**
  builds want an early, legible anchor piece. → our Hone / a keystone relic should play that role and
  the bag choice should pre-signal it. The real player never committed because nothing anchored it.
- **FLAG — content conflict:** "duplicate tiles reduce playability" fights our Doubled-letter
  archetype + Echo bag (which stack dupes). That archetype trades playability for synergy; tune it
  carefully or it feels clunky as predicted.
- **TO DISCUSS (author flagged 2026-06-29): the hidden-pity mechanic** is a planned Phase-B work item
  — design it deliberately with the author (how strong, what it biases toward, visible or hidden)
  before building.

## Progress — Phase B economy SHIPPED (2026-06-29, pending playtest)

Win-feel STANDARD (the tuning target): a skilled player wins the BASE stake ~40-60% once mastered
(first win takes many runs); mastery lives in harder stakes where win rate falls to ~30-50%. Map to
our harness (a greedy FLOOR bot, below a skilled human): target the banker persona ~15-30% on Stake 0.

Levers shipped (author-approved): **interest cap $5 → $12** (rewards saving toward a keystone),
**reroll cost $2 → $0** (free reroll = the shop never denies a piece; affordability is the only gate),
starting purse kept $0. NOT done: clear-reward bump / cheaper relic (the two above sufficed) and the
pick-1-of-3 node (free reroll replaces it).

Harness result: banker persona **0-4.5% → 20-51%** (Escalation 51, Rare 48, Doubled 42, Long 40, Vowel
22.5, Short 20.5); greedy spender stays 2-9.5% — **skill (saving/prioritizing) decides the run,
carelessness busts**, which is the build-or-bust-but-fair goal. All six archetypes viable (~2.5×
spread). CAVEAT: the bot is a floor, so strong builds (40-51% bot) may be slightly generous for a
skilled human → **STOP economy tuning, ship for author playtest**; pull-back lever if too easy =
interest cap (12→10) or a small reroll cost, NEVER engine nerfs.

**Hidden pity: DEFERRED (free reroll makes it redundant** — data confirms builds assemble without it).
Revisit only if playtest shows acquisition still feels luck-gated.

Content backlog (author leans "more content" post-funnel): a **cash-generating tile-mod** ("Gilded":
+$ when this tile scores) so a cash-focused build is viable per-tile (Recycler is the only cash relic
today); plus the Phase-D gap-fillers (affix/digraph relics, peek/swap). NOT letter-mastery (Tier 4).

## Roadmap

### Phase A — Instrument (cheap; unblocks everything; mostly internal harness work) — DONE
- **A1. Discard + letter-usage telemetry.** Track per-letter played / discarded / left-in-rack and
  discard frequency; surface in stats + export. Answers "what do I dump / overuse" and *measures the
  variety problem* directly. (telemetry.js + export.)
- **A2. Re-run the corpus on the shrunk bag** (verify dead-rack% holds + count-synergy hit-rate
  recovers vs the 54-tile version). Quantify that the shrink restores engine-piece density.
- **A3. Recalibrate the harness persona** to a *commit-to-archetype buyer* (buys + thins toward one
  build), so win-rate measures "can a committed build clear the curve?" — the real question. The
  current greedy bot measures the no-engine line and reads 0%, contradicting the "too easy" reality.

### Phase B — Make the assembly funnel FAIR (the heart of build-or-bust; gated on A)
This is the central work: build-or-bust is only fair if a prioritizing player can reliably assemble
an engine by ~round 5 through choices, not luck.
- **B1. Reliable relic acquisition** (2026-06-26 §4b, still open): cheaper/free rerolls +
  archetype-weighted offers + a dedicated **"pick 1 of 3 relic" node**. NOT forcing a relic into
  every shop (tried and reverted 2026-06-28 — keep luck-of-the-draw, add reliable *paths*). Goal: the
  *first* engine piece reliably lands by ~round 2-3.
- **B2. Economy revisit (the `$` lever the author flagged).** Current state starves assembly:
  clear ≈ 5-6/round, relic = 8 (can't afford one after round 1), interest cap $5 (saving past $25 is
  dead weight), starting purse $0. Candidate levers (author owns numbers; verify each via harness):
  raise the **interest cap** ($5 → ~10-15) to reward saving for a keystone relic; bump **clear
  rewards** (base 4 → 5-6 or round-scaled); a **cheaper first relic** (node and/or buyRelic 8 → ~6);
  maybe a small **starting purse** ($3-4). Busting should be the player's fault, not the shop's.
- **B3. Bag shrink (consistency).** Revert bags to ~26 tiles keeping identities; rares out of
  Standard; keep Classic. A focused bag makes word-skill and synergy-firing *reliable* (pro-skill,
  pro-assembly). Verify dead-rack% + count-synergy hit-rate via A2.
- **B4. Archetypes as committable ENGINES, not floor crutches.** Make each archetype (esp. the
  current floors, Short-word/Vowel-heavy) a build you can *commit to and assemble into a real
  ×Mult/Points engine* — not a way to keep raw words afloat. Co-viability = "each is a winnable
  engine," not "each keeps pace without one."
- **Gate:** re-run A2/A3 + author playtest — a player who prioritizes assembly reliably gets an
  engine online by ~round 5 and can win; a player who doesn't, busts (and it reads as their call).
  Targets stay steep; no floor added.

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

## Open decisions
All three framing decisions are now locked — see "Decisions locked (author, 2026-06-28)" above:
bag shrinks to the scarcity model; difficulty is build-or-bust with a *fair* agency-driven funnel
(no floor); position lever deferred to Phase D. Remaining open items are tuning numbers (economy
levers, target curve) — resolved empirically in Phase A/B, with the author owning final values.

## Tier discipline (unchanged)
Do not build the Tier-4+ wishlist: leveled alphabet/letter-XP (= letter-mastery, see D2), variable
word length, branching run map, true part-of-speech synergies. Bosses/events/meta are built. If a
deferred feature seems needed, STOP and ask.
