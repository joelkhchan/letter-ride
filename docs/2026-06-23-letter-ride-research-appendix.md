# Letter Ride — Research Appendix (deep-research streams)

**Date:** 2026-06-23 · **Type:** Deep-research streams (round 2), separate from the headline
competitive report so that stays readable.
**Companion docs:** `2026-06-23-letter-ride-competitive-research.md` (headline competitive findings +
Spellatro) · `2026-06-23-letter-ride-empirical-findings.md` (our own engine/corpus analysis).

> **Status of the four streams (dispatched 2026-06-23):**
> - ✅ **A. Player-sentiment mining** — complete (below).
> - ✅ **B. Competitor mechanics gap-fill** — complete (below).
> - ✅ **C. Roguelike/roguelite genre theory** — complete (below).
> - ✅ **D. Word-games design theory** — complete (below).
> **All four streams complete.**
> Sections B–D will be appended when the agents complete. All claims are paraphrased and
> source-cited; no competitor code/art/text is copied.

---

## A. Player-sentiment mining (Steam + app stores + dev post-mortems)

**Method & honesty:** synthesized from Steam reviews (top + recent) for Beyond Words, Word Play,
Wordatro, OMG Words, Letterlike; Apple App Store reviews for Letterlike & Wordlike; itch.io comments;
two dev post-mortems (GMTK's *Word Play*; Spellatro dev notes); ~10 press reviews + two "I tried every
Balatro-like" roundups. **Reddit/ResetEra were blocked in-environment** (all fetches 403) and **Google
Play raw review text was unreachable** — so community-*thread* sentiment is under-sampled; dev
post-mortems (which summarize playtester feedback) and engaged-player roundups stand in. Frequency
tags (near-universal / common / occasional) describe recurrence *within the reachable corpus* — treat
as directional. Spellatro has no player reviews yet (preview-only signal).

### What HOOKS players (ranked)
1. **"Scrabble × Balatro" fusion + one-more-run loop** *(near-universal)* — the last-second
   high-value word + synergies firing. Both halves are familiar, so onboarding is frictionless.
2. **Build/synergy discovery via tile-mods & perks** *(common)* — the deepest praise. Word Play
   shipped 160 perks specifically to feed this; Wordlike's word-type "Knick-Knacks" give identity.
3. **"Scour your brain for the perfect synergy word"** *(common)* — a build that forces you to find a
   specific word is the celebrated payoff.
4. **Permissive dictionary as delight** *(common)* — Beyond Words praised for accepting slang/proper
   nouns/swears (PC Gamer's literal headline). Generosity reads as a feature.
5. **Premium, no-ads model** *(common, mobile)* — Letterlike & Wordlike win trust for one-time
   purchase, no ads, no IAP.
6. **Clean/accessible presentation & low-pressure pacing** *(common)* — clean UI, dyslexic font,
   color-coded tiles, "no timers."

### What BOUNCES players (ranked)
1. **Content ceiling → repetition** *(near-universal churn driver)* — once the perk pool is seen,
   runs feel samey (raised even by recommenders).
2. **Brutal onboarding / early wall** *(common, quantified)* — OMG Words: **<30% clear level 1, <15%
   clear level 2**; Letterlike's lowest difficulty near-impossible while gems are locked behind wins.
3. **Feel-bad RNG / wasted upgrades** *(common)* — bad draws, unreachable boons, weak shop offers
   deciding a run before skill matters.
4. **Two opposite power failure modes** *(common)* — too swingy (Beyond Words: OP/dead cards + boss
   RNG) vs too flat (Word Play: perks too weak). Both read as "fails to capture Balatro's magic."
5. **Presentation read as soulless** *(occasional)* — "clip-art"/"sterile."

### Balance, difficulty, UX, dictionary, meta — key themes
- **Steep per-round target hikes are the single most-cited difficulty problem genre-wide**
  *(near-universal)* — targets leaping 500 → six figures. **Directly corroborates our empirical
  finding** that the curve is the make-or-break tuning axis.
- **No score preview before commit + opaque stacked-multiplier math** *(common)* — a repeated,
  cheap-to-fix friction. Wordatro is *praised specifically for clear scoring* — clarity is a
  differentiator, not polish. **Corroborates our P0 "show the math" recommendation.**
- **Rejecting believed-valid words is a top trust-killer** *(near-universal where it occurs)* —
  **Wordatro is the cautionary tale** (rejects zipline/poutine/plushie/debt/diet). Mitigations that
  worked: Word Play's word-petition pipeline (+150 words in one update) + spelling suggestions;
  Spellatro's penalty-free misspelled attempts.
- **Letterlike & Wordlike get near-zero dictionary-gatekeeping complaints** — their "strategy/
  modifiers beat vocabulary" framing *inoculates* against gatekeeping resentment. **Strong external
  validation of Letter Ride's core pillar.**
- **Grindy/stingy meta is the dominant mobile complaint** *(common)* — Letterlike: "2 hours per
  unlock," and meta currency competes with in-run spending (feel-bad). **Gold standard: opt-in meta** —
  Spellatro's "unlock-everything-from-start" toggle. Content density (Word Play's 160 perks) is a
  well-received alternative to a persistent grind.

### Mobile-specific (Letterlike / Wordlike — priority for an Android target)
- **Premium, no-ads, no-IAP is validated and praised.** Aligns with Letter Ride's no-IAP design.
- **Late-game performance/stability is a real failure mode** *(common)* — Letterlike slows at high
  levels; **Wordlike's Android build tanked its rating (iOS 4.8 vs Android 3.75)** with freezes/
  force-closes. **The clearest mobile-engineering cautionary tale: watch scoring/animation perf when
  Mult stacks high; build auto-save / interrupt-resume** (praised).

### Recurring feature requests
Endless/more modes (the #1 antidote to repetition) · score preview before commit · in-game
dictionary/definitions + "report this word" button · mobile ports · partial-credit (bronze/silver) on
hard finales · optional meta toggle · longer rounds/more turns.

### Prioritized implications for Letter Ride
**P0 (before Tier-0 is "fun"):**
- **[Designer] Tame the score-target ramp; consider partial-credit soft-fail tiers.** (`config.js`
  ROUND_TARGETS.) The #1 genre-wide difficulty failure. *(near-universal)*
- **[UX] Show the word's score before commit + make `Wit × Mult` legible as it builds.** Most-repeated
  cheap-to-fix churn driver. (`scoring.js` output surfaced live in `ui.js`.) *(common)*
- **[Designer] Protect "clever short word + mods beats a long word" — it's the moat.** Letterlike/
  Wordlike's near-zero gatekeeping complaints validate the soul; don't let relic power drift weak
  (Word Play's mistake). *(near-universal)*

**P1 (before Tier-1/2 lock):**
- **[Designer] Avoid both power failure modes** (not too swingy, not too flat) — actively prune dead
  and OP relics; budget real playtesting. *(common, dev-confirmed)* **Matches our §5 archetype-spread
  finding.**
- **[Designer] Make Meta opt-in / non-punitive** — never force a feel-bad Meta-vs-Coins mid-run
  tradeoff (Letterlike's anti-pattern); offer an unlock-all toggle (Spellatro). *(common)*
- **[Engineer] Dictionary trust** — lean permissive (ENABLE), add a lightweight "report word" capture;
  silent rejection of believed-valid words is a top trust-killer. *(near-universal where it occurs)*
- **[Designer] Combat the content-ceiling churn** — plan an endless/escalating mode or enough relic/
  mod density. *(near-universal)*

**P2 (Tier-3 Android / polish):**
- **[Engineer] Budget for late-game perf & stability on Android** (Wordlike's cautionary tale); build
  auto-save / interrupt-resume. *(common, mobile)*
- **[UX] Modifier descriptions readable BEFORE acquisition** (tooltips). *(common)*

### Flag for the author (not a recommendation)
**The scarcity pillar is contested by the data.** *Word Play* — arguably the best-received title
(~90% of ~970 reviews, GMTK pedigree) — **deliberately abandons letter scarcity** (open repopulating
grid + total-turn budget) and balances purely via score targets, and reviewers liked it. CLAUDE.md
treats "never give an open alphabet — it kills the economy" as an axiom. That axiom is *defensible*
(Letterlike/Wordlike keep the bag and thrive too), but it is **not universally borne out.** Worth a
conscious decision rather than an unexamined invariant.

**Biggest gap in this stream:** Reddit/ResetEra blocked, so head-to-head community consensus rests on
dev post-mortems + roundups, not raw threads. Re-run with an isolated Playwright profile or
authenticated Reddit fetch to convert flagged single-source items (dictionary-rejection rage volume;
tap-vs-type input debates) into confirmed consensus.

---

## B. Competitor mechanics gap-fill (gap-resolution pass)

Resolves UNCONFIRMED items from the main competitive doc. `[INFERENCE]` = reasoned guess, not
confirmed. **Spellatro is pre-release** (demo-only, Next Fest June 2026) with no wiki and a single
Cloudflare-gated source, so several of its numbers remain genuinely unobtainable without hands-on play.

### Spellatro (closest competitor) — partially resolved
- **NOW CONFIRMED:** word-length cap **6**; **all named modifiers are ADDITIVE — no true ×Mult found
  in any reachable source** (Support +2 mult/tile, A/A +1, 4M +10, 6S +80 flat pts); **100+ passives,
  max 6 active**; 5 bags (2 known: Standard, Timed-90s); 10+ letter-upgrade types (2 known: Ice,
  Support); L1 target 80 / ≤3 submits / 7 demo stages; **limited discards**; **efficiency reward
  tiers** (≤3 words→passives, ≤2→buffed, 1-word→reward reroll); 12 bosses w/ curses; 3 difficulties.
- **STILL UNKNOWN:** rack/hand size; scoring order-of-operations; whether any ×Mult hides in the full
  100+ pool; 3 of 5 bags; 8+ of the upgrade types; level 2–7 target curve.

### Beyond Words — resolved well
- **Rack = 7; tiles ARE consumed and the bag refills keeping upgrades** = **exactly Letter Ride's
  Model B**. (Strong external confirmation the Model B switch is right.)
- Length multiplier = the word's letter count at base (3-letter ×3…), each length has a **"level"**
  raisable by Booster Cards; **+100 bingo** for all 7 tiles.
- **Phase-ordered AND a true ×Mult exists** (Blue/Plus add to mult; Purple/Multiply multiply it) —
  **BUT ordering is positional/player-arranged** (guide: additive cards left, multiply right; order
  changes the result). Bag-thinning via **destroy + duplicate** (both directions). Shop reroll exists;
  a permanent upgrade lowers prices. ~300+ modifiers; bosses every 3rd round, pool 30–40.
- Still unknown: exact shop prices/reroll cost; full power-card & boss catalogs.

### Word Play — resolved (and it's NOT a rack game)
- **4×4 = 16-tile grid** fed from a persistent bag (not a drawn rack); per-turn limiter is "Plays."
  Standard tiles **cycle back to the bag**; special tiles shatter. **Two-stage phase-ordered scoring
  with true ×Mult** defined by *which quantity a mod targets* (Word Score vs Final Score), **not
  acquisition order** — a third ordering model distinct from both Beyond Words and Letter Ride.
- ~150–160 perks; min length 4, **no max cap**; **economy = "Refreshes" only, free pick-one-of-N perk
  draft, NO paid coin shop**; **NO between-run meta** (difficulty select only); **Win/Mac, no mobile**.

### Smaller titles
- **Wordatro!** rack **10** (upgradeable); true ×Mult; **no meta, no coin shop** (free 3-pick); PC.
- **OMG Words!** rack **7 on a Scrabble board**; positional Scrabble scoring; no meta; "cash" shop
  (relics+boons); PC.
- **Letterlike** — **DEEP persistent meta** (gems earned even on losses → permanent upgrades; **"Bags"
  = deck variants** unlocked via achievements; NG+); **mobile-first, tap-based**. The truest comp for
  Letter Ride's Tier 2.
- **Wordlike** — true ×Mult; **positional "arranged order"** (Knick-Knacks fire left-to-right); $ shop;
  multi-platform incl. **Android**.

### Mechanics comparison matrix

| Game | Rack/board | Length cap | Scoring order | True ×Mult? | Max active mods | Economy | Meta | Platform |
|---|---|---|---|---|---|---|---|---|
| **Spellatro** | UNKNOWN (word cap 6) | 6 | UNKNOWN | none found (all additive) | 6 | rewards; earned reroll | bags+passives unlock | PC (pre-release) |
| **Beyond Words** | 7 (consume+refill) | none | positional (player L→R) | **YES** | n/s | coin shop, reroll, destroy/dup | bosses; cross-run unclear | Switch/PC/Xbox |
| **Word Play** | 16 (4×4 grid) | min 4, no max | 2-stage, quantity-targeted | **YES** (stacks) | n/c | "Refreshes" only, free draft | **NONE** | Win/Mac |
| **Wordatro!** | 10 | none | Σ×length; +pts & ×mult | **YES** | n/s | no shop (free 3-pick) | **NONE** | PC |
| **OMG Words!** | 7 (board) | board-bound | positional Scrabble | YES (positional) | 5 relic+2 boon | "cash" shop | NONE | PC |
| **Letterlike** | grows (~10) | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | shop+reroll+secret | **DEEP** (gems, bags, NG+) | iOS/Android/Steam |
| **Wordlike** | UNKNOWN | UNKNOWN | positional (arranged) | **YES** | shop 3+2 | $ shop, packs | achievements only | Steam/iOS/Android/web |
| **Letter Ride** | 9 | none (3 min) | **phase-ordered, position-independent** | **YES** | TBD | $ shop (enchant/thin/relics) | **Meta (planned)** | Android |

### [Designer] What the resolved gaps change for Letter Ride
1. **Engine-enforced phase ordering is a genuine differentiator — and the position-lever idea is
   validated.** The market splits two ways and *nobody auto-orders*: Beyond Words & Wordlike use
   **positional** ordering (place additive left, multiply right — order changes the score); Word Play
   uses **quantity-targeted**. So our position-independent engine is the cleaner mobile pitch, **AND**
   the author's interest in *reintroducing position as a skill lever* is confirmed as a real depth
   axis two shipped competitors lean on. (Connects to the position-lever exploration in CLAUDE.md +
   competitive doc §4.)
2. **True ×Mult is the genre norm — and Spellatro appears to LACK it.** Every named Spellatro modifier
   is additive. If that holds, the closest competitor has no multiplicative blow-up moment — exactly
   the "clever short word out-scores a long word" fantasy. **Lean into ×Mult relics hard; it may be
   where Spellatro is weakest.**
3. **Beyond Words confirms Model B** (7-tile consume-and-refill bag retaining upgrades). Borrow its
   **destroy + duplicate** bag-thinning (both directions) — proven deckbuilding texture.
4. **Rack size has no genre consensus** (BW 7, Wordatro 10, OMG 7, Word Play 16-grid; ours 9). No
   number to copy — a tuning dial only playtesting sets. (Our corpus analysis already validated 9 as
   dead-rack-safe.)
5. **Meta-progression: Letterlike (mobile, deep meta) is the truest comp** and its model (currency
   accruing even from losses → unlockable bags/stakes) maps ~1:1 onto our Tier 2. The PC titles' "no
   meta" is a *platform* choice we should NOT copy. **Tier 2 is correctly scoped for Android.**
6. **Spellatro's efficiency-reward tiers** (better rewards / a reward-reroll for clearing in fewer
   words) are an elegant skill incentive that needs no extra currency — worth considering alongside
   the Coins shop to serve the skill-beats-luck pillar.

## C. Roguelike / roguelite genre theory

Evidence tags: **[Studied]** (peer-reviewed / dev-documented data), **[Documented]** (verifiable
mechanic), **[Folk]** (design-community consensus, untested), **[Opinion]**. The agent verified
several sources verbatim (Burgun, StS "going infinite", Hades God Mode, Berlin Interpretation).

### Genre identity
- Letter Ride is unambiguously a **roguelite** (Balatro/StS lineage). The **Berlin Interpretation** is
  a *weighting, not a checklist* — and it explicitly marks grid movement / ASCII / dungeon / single
  avatar as **low-value**, so dropping them needs no justification. Keep the genre-essentials:
  *procedural variation* (bag draw + shop), *permadeath* (run ends), *permachoice* (irreversible
  buy/enchant/discard). [Documented]

### Meta-progression: variety, not power (strongest finding)
- The fault line: meta grants persistent **power** (Rogue Legacy heritable stats, Hades Mirror) vs
  persistent **variety/difficulty access** (StS Ascension, Balatro Stakes). **Persistent power
  produces a *decreasing* difficulty curve** (hardest at the start, trivializes over time) → kills the
  long-tail mastery loop. Heuristic: **"meta should be a leash, not a crutch"** — unlock *options*,
  not raw strength. [Opinion/Documented]
- Hades is the nuanced middle (capped, respeccable power; framing = "take the pain out of restarting").
  **God Mode** is the clean accessibility pattern: *strengthen the player* (start +20% damage
  resist, +2%/death, cap 80%) rather than *weaken the targets* — preserves the learn-by-repetition
  loop. [Documented, verified]
- → **For Letter Ride:** Meta buys tiles/enchants/relics/decks + harder **Stakes**, NOT flat power.
  An optional, capped, *additive* assist (e.g. +starting coins / +1 discard) is defensible if opt-in.
  **Avoid Rogue-Legacy heritable stat power** — it flattens the curve you're building for.

### Difficulty & RNG fairness
- **Burgun's input vs output randomness** [Studied/primary]: randomness *before* the decision (input)
  shapes options you reason about → supports strategy; randomness *after* (output) resolves your
  choice for you → severs action→outcome. **The bag is already the right model** (input, without
  replacement, trackable). Protect it.
- **Absorption thresholds** [Studied]: cap excess random value so luck can't run away. Add **floor
  guarantees** (min usable letters/round) + a **discard/mulligan** so a bad draw can't auto-lose.
- **Choice-from-N** (Hades picks 3 → take 1) keeps RNG generative but agentive → apply to the shop.
- **Post-win Stakes ladders should change *rules*, not just raise numbers** — numbers-only scaling
  *breaks weaker builds' viability*. Make different Stakes favor different builds. [Documented/Opinion]

### Reward psychology — evidence vs folk wisdom (rigorously separated)
- **[Studied]** Variable-ratio reinforcement is powerful but the **Skinner-box model is critiqued** as
  shallow without autonomy/competence. **Near-miss effect** recruits reward circuitry and boosts
  motivation *— amplified when the player perceives control* (so it's legitimate here, not
  manipulative). **Loss aversion** ~2× (global). **Self-Determination Theory:** autonomy + competence
  + relatedness predict enjoyment. **Overjustification:** controlling extrinsic rewards can undermine
  intrinsic motivation — frame meta-currency as *informational/optional*, not a grind gate.
- **[Studied, but small n=42]** Flow's "easy games can be pleasantly challenging" — the *feeling* of
  challenge matters more than objective difficulty. Suggestive, not definitive.
- **[Folk]** The "one more run" compulsion loop is a plausible design thesis, NOT validated science —
  build it, but don't cite it as fact in the spec.
- → **For Letter Ride:** surface the **near-miss honestly** at round-loss ("you were N points short");
  the player had real control, so it's an honest motivator. Lean on SDT/competence, not raw VR.

### Build variety & the infinite-combo decision
- Soren Johnson: *"players will optimize the fun out of a game"* — dominant strategies are the #1
  anti-pattern. **StS's data-driven balance** [Studied, verbatim]: track **pick-rate-when-offered**
  and **win-deck composition**; a card never picked is "not a card," one in most winning decks is OP.
  Their #1 priority: **make "going infinite" rare** — it trivializes play. Fix degeneracy *surgically*
  (nerf the infinite, keep the card).
- Two valid variety routes: combinatorial breadth (Monster Train clan pairs; Hades 2 boons tied to
  skill slots → forces playstyle commitment) vs embrace-the-breakage (Isaac). Seed **rare
  off-archetype** items to sustain discovery.
- → **For Letter Ride:** an uncapped multiplier engine *is* the degenerate case (it kills word
  choice). **Recommend the StS stance: cap/decay true infinites.** Tie relics/enchants to *specific
  letter behaviors* (vowel/position/length/rarity), not flat "+Mult to everything," to force
  playstyle commitment.

### Run structure & pacing
- **A linear ~8-round run is fully legitimate** — Hades is essentially linear but feels choice-rich
  via per-chamber reward routing + small→large escalation within an act. Don't over-build a branching
  map; **invest choice in the shop beat.**
- Make the **shop an untimed breather** (Dead Cells separates decision space from pressure; pauses
  time in shops). **Ruthless zero-friction restart** ("new run" instantly from the loss screen —
  Balatro's praised "zero friction").

### Failure modes → mitigations
Grindy (fix: winnable on skill from run 1; meta = options not power — FTL) · luck-driven (input
randomness + floors + choice-from-N + absorption) · repetitive (curated-feeling generation;
build-dependent challenge; new mechanics not bigger numbers) · solved/dominant (data-driven balance;
cap infinites) · snowball (watch compounding multipliers vs rising targets) · unlock overload
(stagger introductions).

### Letter-Ride-mapped principles (condensed; full list + citations in the agent run)
1. **[Designer]** Meta = variety + Stakes, never raw power.
2. **[Engineer]** Keep the bag as input-randomness-without-replacement; never expose an open alphabet.
3. **[Engineer]** Add floor guarantees + discard/mulligan (absorption) so luck can't auto-lose a round.
   *(Note: doc 2 §3 shows dead racks are already ~0% — so the "floor" is about vowel droughts on
   skewed/thinned bags + the discard lever, not a literal dead-rack fix.)*
4. **[Engineer]** Shop = choice-from-N, not take-it-or-leave-it.
5. **[Designer]** Cap/decay true infinite combos (protect word choice as the skill).
6. **[Designer]** Tie relics/enchants to specific letter behaviors, not flat "+Mult to everything."
7. **[Designer]** Seed rare off-archetype tiles/relics in the shop pool.
8. **[Designer/Engineer]** Stakes ladders change *rules*, not just numbers; different Stakes favor
   different builds.
9. **[Designer]** Keep linear ~8 rounds; invest choice in the shop, not a branching map.
10. **[Engineer]** Untimed shop = the breather beat; ruthless zero-friction restart.
11. **[Designer]** Surface the near-miss honestly at round-loss.
12. **[Designer]** Frame meta-currency as informational/optional (overjustification guard).
13. **[Designer]** Base game winnable on skill from run 1 — no farm tax.
14. **[Engineer]** Instrument pick-rate + win-composition data when tuning (StS method) — our
    `telemetry.js` already records pick rates and per-archetype play/score; extend toward this.
15. **[Designer]** Watch compounding multipliers vs rising targets — that gap *is* the skill expression.

**Two judgment calls flagged for the author (don't silently pick):** (a) the **infinite-combo stance**
(cap vs embrace — trades spectacle vs word-choice-matters); (b) **how aggressive Stakes rule-changes**
get before creative builds become unviable.

## D. Word-games design theory (the broader canon & craft)

Covers the wider word-game canon (not the prior pass's roguelike-specific challenges). [OPINION] tags
mark informed-design-opinion vs evidence; all claims cited in the source agent run.

### Closest precedents for Letter Ride's pillars
- **Quiddler** — rummy with letter *cards* (incl. QU/TH/ER doubles) + leftover-card penalties: the
  direct precedent for "tiles are instances, not strings" + hand-management economy.
- **Letterpress** — spatial/territory layer *dominates* the word layer: the closest precedent for our
  core bet (modifiers, not vocabulary, decide outcomes). Design-lesson source: the spatial/strategic
  layer must beat the word layer.
- **Wordament** — shared-seed boards + rarity/length-weighted scoring: turns solo search into a
  comparison contest that rewards the *uncommon* word (precedent for seeded determinism + our scoring).
- Other per-game lessons: Scrabble (tune economy on real frequency data + *undersupply* cheap utility
  letters — only 4 S tiles); Bananagrams ("Dump" = cost-bearing escape valve for dead tiles); Boggle
  (randomizer + hard pressure constraint = infinite replay); Wordle (scarcity + spoiler-free sharing
  beat content volume); SpellTower ("three reads" visual hierarchy); Typeshift (self-revealing
  progress); Wordscapes (gentle self-paced ramp + calm presentation).

### Letter economy & tile design — KEY for our tuning
- **Scrabble's values (Butts, 1938) were frequency-derived but deliberately playtested** — the 4-S
  undersupply proves scarcity was a tuning knob from day one. Values have been **frozen since 1938**
  and are now provably off: the **Valett** re-pricing (frequency + presence in 2/3/7/8-letter words +
  combinability) finds Z should be ~6 not 10, X ~5 not 8; B/C/F/H/K/M/P/Y overvalued.
- **A tile's value depends on the playable *word set*, not raw rarity** — the QI/ZA problem (cheap
  2-letter words gave Q/Z guaranteed dumps, undercutting their 10-pt price). **V is weak because it
  forms no 2-letter word** — combinability > frequency.
- **A Monte Carlo over 10M random *9-tile* racks** (= our exact rack size) found Scrabble values
  largely defensible except Z/H/U — and this method is **directly reusable for our tile tuning**.
- [OPINION, widely held] Uneven values are the point — flattening them kills the scoring swings that
  reward skill. Depth = a tile's worth comes from the *system around it* (the modifier engine), not
  the letter alone (the Balatro "synergy over a limited curated pool" lesson).

### Vocabulary-vs-skill spectrum
Levers that move a game *toward skill, away from recall* — Letter Ride already uses 3, 4, 6:
(1) constrain the letter set; (2) chunk the building block; (3) **spatial/positional payoff**;
(4) **weight scoring to rarity/length/multipliers**; (5) time/turn/draw pressure; (6) **per-tile
economy + discard**. Our design sits at the skill end (Letterpress/Quiddler neighborhood).

### Replayability & daily-puzzle psychology
- Staleness = a fixed exploitable structure; freshness = **variance from emergent combinations**, not
  more randomness. Consensus model: **authored building blocks, randomly arranged** (Binding of Isaac)
  — our seeded bag-draw + authored shop/relic pools are on the *good* end (bounded random from curated
  pools, not open procedural).
- LocalThunk (Balatro): replayability from **interlocking synergies that steer toward distinct
  builds**; balance **by feel, not spreadsheet**; an over-strong card "cannibalizes adjacent
  strategies" (the #1 replayability killer — hunt these in playtest).
- **Constraint/variant design is a cheap replay multiplier** (Wordle clones: Quordle/Absurdle/Lewdle =
  same verb, warped rules) → maps directly to our **stakes**.
- Wordle's daily-loop psychology = loss aversion (streaks) + variable reward + spoiler-free social
  sharing + scarcity/ritual.

### Mobile market & monetization — what to emulate vs REFUSE
- **Emulate:** bite-sized levels ("one more"); **sawtooth difficulty** (hard level then 5–6 easy —
  too many hard in a row tanks retention; difficulty balance + reward frequency ≈ 65% of
  retention impact); **free shuffle/relief valve** (Wordscapes); aesthetic progression as intrinsic
  reward. Note word games (Wordscapes/Word Cookies) **don't use lives/energy gates** — pressure is
  coins/hints + streaks.
- **REFUSE wholesale** (arXiv study, 1,496 games: "dark" games avg 89 dark-pattern instances vs 16
  healthy; 96.8% F2P): manufactured frustration → sell the cure; currency obfuscation; timed/FOMO
  offers; ad-gating; lives/energy. Our three-currency rule (no hint/energy currency) already excludes
  this — keep it.

### Accessibility (deeper) & integrity
- **Do the math for the player** — a `Wit × Mult` the player must compute in-head taxes exactly the
  working-memory faculty dyscalculic/math-anxious players struggle with. Animate the breakdown +
  running totals.
- **Redundant encoding (icon + text + color)**; **generous letter-spacing first, OpenDyslexic toggle
  second** (evidence says spacing carries most of the benefit; ensure b/d/p/q tiles are unmistakable).
- **English-only is a principled scope choice** — localization needs a vetted per-language lexicon +
  re-tuned frequencies + sometimes a new mechanic per script.
- **Transparent validity feedback is our "challenge rule"** — on rejection, name the authority
  instantly ("not in the ENABLE word list"). **Build zero anti-lookup** — single-player, a solver only
  spoils the player's own run.

### Lessons for Letter Ride (tagged, tied to mechanics)
- **[Designer] Re-derive tile values against ENABLE + a 9-tile rack — don't inherit Scrabble's.**
  Use a Valett-style 3-factor model + Monte Carlo over 9-tile bag draws to sanity-check base `Wit` in
  `config.js` (the corpus script in doc 2 §2 is a start; extend it with combinability + word-length
  presence). Values are word-list-dependent (QI/ZA).
- **[Designer] Bag composition is the primary depth lever — undersupply cheap high-utility letters**
  (Butts's 4-S lesson). Treat S/common-vowel counts as first-class balance surface. *(Reinforces the
  scarcity pillar — note this is in tension with Stream A's "scarcity is contested by Word Play" flag;
  the author's call.)*
- **[Designer] Every rare letter must be a conditional *spike*, not dead weight** — give each a relic/
  mod outlet (the V / Q-Z lesson), or it's a brick.
- **[Designer] Cost-bearing discard keeps flow** (Model B selective-discard is right — make the refill
  cost the tension, not a free reroll). **Each committed word should be self-revealing** (Typeshift).
- **[Designer] Sawtooth the target ramp + gentle onboarding.** Open question: does permadeath already
  supply enough "valley" to keep the ramp monotonic? — playtest feel call.
- **[Designer] Stakes = our Wordle-variant lever** (cheap, high-ROI replay).
- **[UX] "Three reads" hierarchy** (rack/word loudest, scoring math quieter, relic rules quietest);
  let tap-to-build teach itself. **Surface bag composition / remaining tiles** (turns scarcity into a
  known-scope decision).
- **[UX] Daily-seed mode is near-free** (`rng.js` supports it) — build local personal-best/streak;
  **SKIP the viral social grid + cross-device login** (mass-acquisition machinery + streak-anxiety,
  irrelevant to a personal prototype).
- **[Designer] Refuse monetization dark patterns wholesale** (already excluded by the currency rule).

**Strongest reusable sources:** the Physics Virtuosi 9-tile Monte Carlo (directly applicable to tile
tuning), the Valett 3-factor model, the arXiv dark-patterns study, the LocalThunk/Balatro interview.
