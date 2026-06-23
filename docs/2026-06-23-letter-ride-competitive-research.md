# Letter Ride — Competitive & Design Research

**Date:** 2026-06-23 · **Type:** Research synthesis (informative, not a spec change)
**Status:** Reference. Findings here may inform a future spec revision; the spec is **not** yet updated.
**Method:** 6 parallel research subagents (Beyond Words systems; Beyond Words reception; the broader
word-roguelike landscape; roguelike-deckbuilder design principles; word-game-specific design
challenges; Spellatro deep dive). All claims cited inline; unconfirmed items flagged.

> **Why this doc exists.** We asked whether a Scrabble-like roguelite already exists (yes — many),
> then dug into the closest one (Beyond Words) and the wider genre to learn what to do — and what
> *not* to do. This is institutional context: read before any design/tuning decision. Mechanics and
> lessons only — we do **not** copy any competitor's code, art, or text.

---

## 0. TL;DR — the things that matter most

1. **The design is genre-validated but not novel.** Every Letter Ride pillar (bag of instance-tiles,
   +Mult/×Mult split, relic shop, enchant/thin economy, boss-style modifiers) is now *table stakes*
   across 8+ shipped games. A Krafton exec was pitched ~250 roguelike deckbuilders in 12 months;
   publishers are avoiding the genre in 2026. Commercially the mechanics earn **zero credit** — but
   as a personal prototype that's irrelevant. The fun is in **tuning and feel**, not the systems.
2. **The genre's #1 failure mode is "luck not skill."** Beyond Words' top criticism, near-universal:
   difficulty spikes (500 → six-figure targets), shop RNG, and **boss modifiers that silently
   invalidate the build with no warning**. The devs patched the curve post-launch. → This is now a
   Letter Ride **non-negotiable design rule** (skill levers to beat luck, while keeping luck fun).
3. **Scoring-order correction.** The spec/CLAUDE.md said the engine uses "Balatro order: sum all
   +Mult, then apply all ×Mult." **Balatro does not work that way** — it's a strict left-to-right
   running total where joker *position* changes the score. Letter Ride's phase-ordered,
   position-independent engine is a *good simplification* — just mislabeled. **Now under active
   exploration: reintroduce tile/relic position as a skill lever** (the author likes it).
4. **Closest live competitor is Spellatro** (ships ~2026, same window), on the *exact* short-word-
   with-mods thesis. Watch it. (§5.)
5. **Differentiators that survive scrutiny:** (a) mobile-native tap-to-build, **no grid** — nobody
   ships the spatial-board variant on mobile because grids are bad on phones; (b) a **well-tuned,
   generous Meta layer** — the genre's most consistent *criticism* is stingy/shallow/absent meta.

---

## 1. Beyond Words — systems teardown

**What it is:** Scrabble-style roguelike deckbuilder, MindFuel (ex-GoldenEye/TimeSplitters) / PQube,
~$15, console + PC (not mobile), April 2026. OpenCritic 80, ~87% positive on Steam. Crucially
**board-grid based** — tiles placed on a persistent Scrabble board — which is where the designs most
diverge from Letter Ride's grid-less rack.

| System | How it works | Maps to Letter Ride |
|---|---|---|
| **Structure** | Run = 9 stages, every 3rd a boss (3 bosses/run), then Endless. ~5 plays/stage, 7-tile rack from a bag. Branching roadmap of ~40 unlockable boards. | Linear 8-round run is simpler/snackier |
| **Scoring** | `base (red) × multiplier (blue)`; base = length + Scrabble values + bonuses (+100 for using all 7 tiles). "Plus" vs "Multiply" mods. | = Wit × Mult |
| **Order of ops** | **Positional / left-to-right** — a ×2 before vs after a score tile = 200 vs 100. | LR enforces phase order regardless — cleaner, fewer footguns (but see §4 position-lever) |
| **Word leveling** | Boosters permanently raise base+mult for *all words of length N* (Balatro planet-card analogue). | A non-relic scaling axis LR lacks |
| **Modifiers (300+)** | Power Cards (max 5, = jokers), Booster Cards (consumables), Perks (passive), Stickers (tile mods: +25 base / +4 mult / ×1.5 / retrigger). | Stickers ≈ tile-mods, with concrete tuning numbers to benchmark against |
| **Special tiles** | Bomb (clears board space), Virus (grows + spreads then dies), Coin (earns currency when scored), Zero (trap/weapon), Stone (obstacle). | Coin-tile + Virus-decay are stealable; Bomb is board-specific |
| **Economy** | Coin shop end-of-stage: power cards, boosters, extra bag tiles, stickers, duplicate/destroy tiles. | ≈ the 7-offer shop, near 1:1 |
| **Bosses (30–40)** | Rule-twists: word-length lock, negative-score tile, time limit, disable discarding, forced power card. 3rd boss "almost impossible," but you only need boss 1 to advance. | LR's deferred boss rounds, already built by them |
| **Meta** | **Boards = decks** (varying starting letters/rules) + content unlocks gated by **achievements/trophies (130)**. **No spendable meta-currency. No difficulty-stake ladder.** Seeded runs, time-attack, negative "flipside" mode. | LR's planned Meta currency + stakes is a *differentiator* |

**Engineer notes:** their sticker numbers (+25 base, +4 mult, ×1.5, +1 retrigger) are a useful
balance reference for enchant values. Their positional scoring is the footgun LR currently avoids.
"Word leveling" is a clean optional scaling axis (Tier 4+ territory — needs author sign-off).

Sources: [Steam](https://store.steampowered.com/app/3823370/Beyond_Words/) ·
[TheXboxHub](https://www.thexboxhub.com/beyond-words-review/) ·
[EGW](https://egw.news/gaming/news/34011/beyond-words-review-Ox6MH296f) ·
[Steam community guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3711288957) ·
[Gaming Outsider](https://thegamingoutsider.com/2026/04/07/beyond-words-switch-2-review/mszymanski/) ·
[Thinky Games](https://thinkygames.com/games/beyond-words/) · [PQube](https://pqube.co.uk/games/beyond-words/)

---

## 2. Beyond Words — reception & what to do differently

**Verdict spread:** OpenCritic 80 (87% recommend), Metacritic PC 73 / Switch 83, Steam ~87% positive.
Genuinely liked; held back by luck-vs-skill imbalance, spiky difficulty, no-counterplay bosses, and
flat presentation. *Several complaints are board/controller-specific and don't transfer to a touch,
grid-less game — flagged below.*

**Praised (learn from):** the core fusion is addictive; modifiers (not vocabulary) drive success and
reviewers *liked* that short-word power cards exist (validates the soul); permissive dictionary
(slang/swears score) was a delight; board/deck variety > Balatro; "felt smarter than poker hands."

**Criticized — prioritized "do differently" list:**

**P0 (most pain, maps onto our design):**
1. **[Designer] Boss/round modifiers must be legible AND counterable in advance.** BW's worst
   failure: hidden boss rules retroactively kill the build you spent the run assembling ("waiting
   for the run to die"). Show the constraint *before* the player commits the round's strategy/shop;
   never disable an entire archetype with no warning.
2. **[Designer] Tame the curve, reduce run-to-run variance.** 500 → six-figure jumps + shop RNG
   meant skilled play still lost. Tune so a skilled line clears with the **median** shop draw, not
   the lucky tail. (`config.js`-only tuning is the right lever.) The BW devs had to patch this; we
   can design it right pre-playtest.
3. **[UX] Make scoring fully legible — show the math.** Players "don't know why they scored what
   they did." This is also the pillar's payoff — if players can't see the mod fire, the skill
   expression is invisible. (Reveal-sequence design in §6.)
4. **[Engineer/UX] Trustworthy dictionary.** Rejecting semi-obscure valid words broke trust ("reads
   like a bug"). ENABLE is good; give instant, clear rejection feedback.

**P1:**
5. **[Designer] Kill dead cards and runaway cards.** BW had both "worthless" relics and
   "win-the-run-alone" ones. Reward *combinations* over single bombs.
6. **[UX] Make the payoff feel explosive.** Flat SFX / slow animations made big scores
   unsatisfying — a complaint even in positive reviews. Cheap juice, high ROI.
7. **[Designer] Front-load a readable synergy** so the fantasy lands before difficulty does (BW took
   ~3 hrs to "click").
8. **[Designer] Default to untimed.** Timed levels were a recurring bounce reason for the chill-word-
   game audience — exactly our audience (personal, phone, relaxed).
9. **[Designer] Avoid the "copies Balatro's homework" read** — lean into tap-to-build, instance-
   tiles, the bag economy; don't 1:1 port jokers — do *word-specific* things poker can't
   (prefix/suffix, vowel/consonant, length-bands).

**Doesn't transfer:** controller/board-navigation friction, board-space crunch — grid/console
problems a touch, grid-less rack sidesteps. Only kernel: don't let destructive inputs misfire; don't
let the player get mechanically stuck.

Sources: [OpenCritic](https://opencritic.com/game/20348/beyond-words/reviews) ·
[Metacritic](https://www.metacritic.com/game/beyond-words/) ·
[Jump Dash Roll 6/10](https://www.jumpdashroll.com/article/beyond-words-review) ·
[Nintendo Life 8/10](https://www.nintendolife.com/reviews/switch-eshop/beyond-words) ·
[WayTooManyGames 7.5](https://waytoomany.games/2026/04/08/review-beyond-words/) ·
[The Geekly Grind 8](https://www.thegeeklygrind.com/all-posts/beyond-words-review) ·
[Cat with Monocle 4/5](https://catwithmonocle.com/news/2026/04/13/beyond-words-review/) ·
[Steam reviews](https://store.steampowered.com/app/3823370/Beyond_Words/)

> **Confidence:** verdicts are well-corroborated. The "no-counterplay boss" and "dictionary rejects
> valid words" complaints lean on Steam/Reddit user consensus (strong sentiment, not single-author
> fact).

---

## 3. The broader landscape & white space

**Saturated (table stakes — no differentiation credit):** Scrabble letter values · word-length
multipliers · ~10-round runs vs rising targets · a joker/relic shop · tiles-as-buffable-instances ·
boss modifiers. All present in every game.
[PC Gamer survey](https://www.pcgamer.com/games/roguelike/i-spent-2025-digging-through-all-the-word-game-roguelikes-flooding-steam-to-see-if-any-could-capture-balatros-magic-here-are-the-highly-scientific-results/) ·
[GamesRadar — genre fatigue](https://www.gamesradar.com/games/roguelike/subnautica-2-exec-is-tired-of-balatro-likes-says-devs-pitched-maybe-250-roguelike-deckbuilders-in-the-last-12-months/)

**Closest comparables, ranked by relevance to Letter Ride:**
- **Spellatro** (~2026, PC) — *the single closest competitor.* Bag-draw, ≤6-letter words, stackable
  passives rewarding word *shape* over vocabulary. Same thesis, same window. Deep dive in §5.
- **Letterlike** (mobile-first, #1 Google Play paid word game) — truest *form-factor* comparable. Tap
  tiles, "challenge tiles" (self-imposed escalating constraints — a fresh, stealable loop).
  **Criticism: meta too stingy (~1 unlock / 2 hrs).** Avoid that pace.
  [tapsmart](https://www.tapsmart.com/games/letterlike-review/)
- **Wordlike** (iOS+Android) — tap tiles, conditional "Knick-Knacks." **Criticism: "lacks
  personality."** Theme is cheap differentiation. [App Store](https://apps.apple.com/us/app/wordlike-word-roguelike/id6738364965)
- **Wordatro** — typographic enchantment (bold/italic/underline tiles) = a legible, cheap way to
  render mods on a phone. Applies to the deferred "scrabble-bag styling" note.
  [Steam](https://store.steampowered.com/app/3140120/Wordatro/)
- **Word Play** (GMTK) — input universality (tap/drag/type/controller), 150+ perks. Proves
  modifiers-over-vocabulary, but *some found its modifiers under-exciting* — numbers alone don't
  carry it, synergy depth does. [gmtk.substack](https://gmtk.substack.com/p/how-i-made-word-play)
- **OMG Words** — roguelike-ifies the actual board; PC Gamer's favorite. Most divergent hook — but
  **nobody ships it on mobile** (grids are fiddly on touch). [higherplaingames](https://higherplaingames.com/pc/omg-words-review/)
- Also: **Cursed Words**, **Birdigo** (strong migration theme), **Words Can Kill** — all explicitly
  "tactics over vocabulary."
- **Babble Royale** — cautionary tale: multiplayer-only + cosmetic-only meta = fragile, now
  effectively dead. Solo + persistent-Meta is the durable choice. [biggieblog](https://biggieblog.com/memorializing-babble-royale/)

**White-space opportunities [all Designer]:**
1. **Own "engine discipline" as a feature** — no competitor *markets* a formally enforced phase
   order. Surface it legibly in the score animation. (Note: this is in tension with the
   position-lever exploration in §4 — pick one and lean in.)
2. **Mobile-native spatial/pattern scoring without a board** — capture board-like satisfaction via
   adjacency/word-shape mods (first=last letter, palindromes, ascending values). The praised OMG
   Words hook, made mobile.
3. **Generous, legible Meta** — the genre's most consistent weakness; win on a well-tuned
   three-currency economy.
4. **A memorable theme** — "Letter Ride" implies a journey/route motif; the pure-mechanical clones
   skip identity.
5. **Player-authored constraints as a scoring engine** (Letterlike's challenge tiles) — fits the
   bag/mod system, rewards mastery over vocabulary.
6. **Typographic tile-mod language** (Wordatro) — render mods without icon clutter on a small screen.

---

## 4. Roguelike-deckbuilder principles to port (+ the scoring correction)

**⚠️ The correction.** Balatro is **not** "sum +Mult then ×Mult." It's a strict **left-to-right
running total** — verified across 4 sources. Worked example (base 40×4, a +4 Mult joker and a ×2
joker):
- +Mult left of ×Mult: `40 × ((4+4)×2) = 640`
- ×Mult left of +Mult: `40 × ((4×2)+4) = 480`

Joker *position* is a real skill lever in Balatro. Letter Ride's engine (sum all +Mult into
`(1+ΣaddMult)`, then apply all ×Mult, acquisition-order-independent) is a *deliberate, sound
simplification*. **DECISION DIRECTION (2026-06-23): the author likes position as a skill lever** — so
reintroducing tile/relic ordering as a player-controlled lever is now on the table (not yet specced).
This serves the skill-vs-luck principle: ordering is pure skill, no RNG. Within a single category
order is irrelevant (`+4,+8` = `+8,+4`); the lever only bites when an ×Mult sits before a +Mult.
Sources: [Balatro Activation Sequence](https://balatrogame.fandom.com/wiki/Guide:_Activation_Sequence) ·
[Destructoid](https://www.destructoid.com/how-to-order-jokers-in-balatro/) ·
[balatrowiki Score](https://balatrowiki.org/w/Score)

**Principles to port:**
- **[Designer — scoring] ×Mult is the late-game wincon; +Wit/+Mult is early.** Linear can't beat
  exponential targets — force a build *arc* from additive to multiplicative engines.
  [Guide: Scaling](https://balatrowiki.org/w/Guide:_Scaling)
- **[Designer — relics] Deliberate role taxonomy** (flat +Wit, flat +Mult, conditional ×Mult,
  scaling/snowball, ×Mult wincon, economy, retrigger, copy/engine). LocalThunk's two failure modes:
  a relic that's *dominant* (cannibalizes adjacent strategies) or *filler* (never picked). **Favor
  decision-changing relics** (StS Snecko Eye / Runic Pyramid warp *how you play*) over flat stat
  sticks — relics that change *which words you want to spell*.
  [Rogueliker interview](https://rogueliker.com/balatro-interview/) ·
  [StS Relics](https://slaythespire.wiki.gg/wiki/Relics)
- **[Designer — inventory] Reference scale:** Balatro 150 jokers (61/64/20/5 by rarity), StS 166
  relics across 8 tiers. Plan rarity tiers; LR needs far fewer.
- **[Designer — curve] ~2.2×/round exponential, front-loaded steeper, Small/Big/Boss rhythm**
  (Balatro 300→50k over 8 antes). **Mix "raise the wall" rounds with "break your engine" bosses** to
  reward flexible bags over one-trick builds. [Blinds & Antes](https://balatrowiki.org/w/Blinds_and_Antes)
- **[Designer — economy] Interest with a cap** (Balatro: $1/$5 held, capped $5 → ~$25 natural save
  threshold) creates hoard-vs-spend. Escalating reroll (resets per shop) + never-resetting thin cost
  (StS: first removal is the best buy). **Let the curve weaponize the economy** — targets must
  outgrow rewards so you're forced to convert Coins to power on schedule.
  [Money](https://balatrowiki.org/w/Money) · [StS Gold](https://slaythespire.wiki.gg/wiki/Gold)
- **[Designer — thinning] Balatro model, not StS:** thin/enchant/transform to make *target
  words/patterns statistically likely*, not just "draw my combo." Adding a tile dilutes your
  enchanted ones — the enchant-vs-dilute tension is exactly right.
  [Deck Manipulation](https://balatrowiki.org/w/Guide:_Deck_Manipulation)
- **[Designer — meta] Gate variety and difficulty, NOT power.** Balatro starts every run with a
  standard deck; unlocks add decks/jokers/stakes. StS Ascension is pure challenge ladder, zero
  compensating power. Persistent stat boosts (Hades-style) trivialize unless gated behind
  player-chosen difficulty. **The loadout category is the trap already flagged — keep it small.**
  [Balatro Wikipedia](https://en.wikipedia.org/wiki/Balatro) · [StS Ascension](https://slaythespire.wiki.gg/wiki/Ascension)
- **[Designer — retention] Short runs + instant restart + fast new-relic cadence.** Aim well under
  Balatro's ~40 min for a phone game.

**[Engineer] architecture (validates existing rules):**
- **Modifiers = data returning typed deltas** (`{chips, mult, x_mult, dollars}`); the engine applies
  them — modifiers never mutate score. Exactly the `scoreWord` plan.
  [SMODS Calculate-Functions](https://github.com/Steamodded/smods/wiki/Calculate-Functions)
- **One `context` object, many small handlers branching on phase**; the engine owns fold order —
  never let evaluation order emerge from how relics are stored. (Balatro's modding community reworked
  this layer — "Better Calc" — confirming ordering is the bug-prone part.)
- **Namespace a separate seeded RNG stream per concern** (draw, shop, enchant rolls) so adding a
  random call in one system can't desync another. Highest-leverage determinism decision.
  [Seed](https://balatrowiki.org/w/Seed)
- **Guard score precision at arithmetic AND display layers** — Balatro's "naneinf" bug: NaN poisons
  `score >= target`, making late antes unbeatable. Keep scores representable; integer-hash seeds.
  [Naneinf](https://balatrowiki.org/w/Naneinf)
- **Pure functions + injected state, fresh per test** — Balatro's global `G` is the cautionary
  counter-example; the DI'd dictionary/tileValues + pure `scoreWord` is the corrective.

---

## 5. Spellatro — deep dive (closest live competitor)

**What it is:** free-to-play roguelike word game, "Balatro meets Scrabble," by solo dev **Ian
Campbell** (Bootdisk Revolution; day job: Lead Designer at Drinkbox). Free demo on itch.io; Steam
(app 3785350) targets **free-to-play 2026, Windows-only, single-player**.
[Steam](https://store.steampowered.com/app/3785350/Spellatro/) ·
[Adventure Gamers explainer](https://adventuregamers.com/article/spellatro-explained) ·
[dev blog](https://bootdiskrevolution.com/2021Blog/?p=2440)

> **Source-quality warning:** Spellatro has a *thin* public footprint — nearly all mechanical detail
> traces to one explainer + the Steam/itch pages + the dev blog. There's essentially no organic
> community discussion, and search engines repeatedly **conflate it with Beyond Words, Word Play, and
> Wordatro** — those games' details have been stripped out here. Many specifics below are
> **UNCONFIRMED** (flagged); re-verify at their 2026 launch.

**Core loop:** beat a rising score target each level using limited word **submits**. L1 target = 80
pts, ≤3 submits (curve beyond L1 unconfirmed). Standout hook: **efficiency-tiered rewards** — clear in
≤3 words → offered passives; ≤2 → more/buffed rewards; **1-word clear → reroll the reward draft**.
~10–12 bosses apply **curses**; 3 difficulty modes; demo = 7 stages. **Losing restarts the set, but
every failed run unlocks a passive — failure = meta-progress.**

**The ≤6-letter cap (CONFIRMED, and central):** max word length is 6. The dev's early build allowed
~20-letter hands / 15-letter words and found it *"overwhelming and paralyzing and not fun"* — cut it
on playtester feedback. Consequence: value must come from **modifiers, not length or vocabulary** —
the mechanism that makes short-word builds viable. (Hand/rack size itself is **UNCONFIRMED** — the
"7 tiles" floating around is the Scrabble default, not confirmed for Spellatro.)

**Scoring:** two channels, Balatro-style — flat **+points** and **+multiplier**; each letter has a
Scrabble base value. Named magnitudes: `6S` = +80 pts (6+ letters); `4M` = +10 mult (≤4 letters);
`A/A` = +1 mult (starts/ends with A); `Support` = +2 mult. **Order of operations is UNCONFIRMED** —
*and notably, every attested mult effect is ADDITIVE (+1/+2/+10); no true ×Mult is confirmed to
exist.* If mult bonuses are all additive, phase-vs-positional ordering is moot (addition commutes),
which likely explains why no preview discusses it.

**Passives/buffs:** 100+ passives, **6 active at once**. Two object types: **passives** (persistent
joker-like modifiers) and **buffs** (effects on your tiles — e.g. `Ice` = growing point bonus,
`Support` = +2 mult if held in rack at scoring; = Letter Ride's tile-mods). Every confirmed passive
triggers on a **structural property** (length bracket, first/last letter, which enchanted tiles are
present) — never on a word being rare/clever. The naming scheme (`<n>S`, `<n>M`, `X/Y`) implies whole
families. "10+ ways to upgrade letters" confirmed as a count but not enumerated.

**Bags:** 5 starting decks, unlocked by *discovering passives* (content progression, not win-streaks).
Only 2 described — **Standard** and **Timed** (lower targets but a 90s/turn clock). Other 3 unconfirmed.

**Economy — the key strategic finding:** Spellatro **deliberately has NO coin shop.** The dev
*stripped* Balatro's money/interest/items/shop for a "minimalist, straightforward" feel. Rewards come
as a **performance-gated draft** — efficiency (fewer submits) is the only "currency." No confirmed
coin currency, costs, or deck-thinning.

**Short-word viability mechanism (exactly how):** (1) `4M` +10 mult for ≤4-letter words dwarfs the few
extra base points a 6-letter word earns; (2) the length cap caps the long-word ceiling so it can't run
away; (3) length-agnostic mult (`A/A`, `Support`) stacks on short words; (4) efficiency rewards *fewer*
words, not longer ones. Net: `4M + A/A + Support` makes a short word out-score a bare 6-letter word —
**resting on +mult magnitudes being large vs single-digit base values** (no player combo confirms it
in practice yet).

### Where Spellatro and Letter Ride overlap (me-too risk)
- **[Designer]** Identical one-line pitch and identical **word-shape > vocabulary** soul (their
  length-bracket + position passives do exactly what the "short word beats long word" pillar wants —
  LR is *not* first to this).
- **[Designer]** Their `Support`/`Ice` buffs = LR's `{id, letter, mods}` enchantments under another name.
- **[Engineer]** Same additive points + additive mult scoring skeleton.
- **[UX]** Spellatro is *already* touch-optimized, so "designed for phone" alone isn't a differentiator.

### How Letter Ride differentiates from Spellatro
- **[Designer] Keep the economy Spellatro threw away.** They *cut* the shop/money/thin for minimalism;
  LR's 3-currency loop + in-run shop with **enchant/upgrade/thin** is a genuinely deeper deckbuilding
  fantasy — *bag composition as the build*, not just passive-collection. This is LR's clearest identity.
- **[Designer] True ×Mult, phase-ordered (or position-levered).** Spellatro's attested mult is
  *all additive*; no ×Mult confirmed. Genuine multiplicative relics give LR a categorically higher
  combo ceiling — a real "engine" Spellatro may lack. Make exponential builds a visible hook.
- **[Designer] Don't necessarily copy the 6-letter cap.** They solve vocabulary-dominance bluntly with
  a hard cap; LR solves it via relics/mods making short words competitive — so LR can allow long words
  *as one viable archetype among many* (the build-diversity goal). A soft incentive curve > a hard cap.
  *(But the cap also buys fast, tractable turns — if mobile turn-speed suffers, reconsider.)*
- **[Designer] Multi-archetype viability as the explicit promise** — Spellatro mostly shows short-vs-
  long; LR's "5+ co-viable strategies" is a stronger, more replayable claim. Design *and market* it.
- **[Engineer] Seeded runs / daily-challenge** as a distinctive community hook (no evidence Spellatro
  offers it).
- **[UX] Ship Android-native, for real.** Spellatro is Windows-only, no announced mobile plan — an open
  lane to be the word-roguelike that's actually *good on a phone*, not a PC game with touch bolted on.
- **[UX] Legibility edge** — their passive codes (`6S`, `4M`) are cryptic and 3/5 bags undocumented;
  LR's planned plain-language bag/relic descriptions are a concrete onboarding advantage.

**Net read:** Spellatro validates the *market* and the *word-shape-over-vocabulary soul*, but chose
**minimalism** (no economy, additive-only mult, hard length cap, PC-only). Letter Ride's defensible
identity is the opposite axis: **a deeper deckbuilding economy + a true multiplicative (and possibly
position-levered) scoring engine + multi-archetype viability, shipped native on mobile.** Differentiate
on depth and platform, not on the core pitch.

> **Highest-value UNCONFIRMED items to re-verify at Spellatro's 2026 launch:** exact hand/rack size;
> scoring order-of-operations and whether any ×Mult exists; 3 of 5 bag identities; 8 of the 10+ upgrade
> types; wishlist/review numbers.

---

## 6. Word-game-specific design (what card-roguelikes can't teach)

**Vocabulary gatekeeping → the Wordle two-list discipline.** Wordle separates ~2,315 curated
*answers* from ~12,000 accepted *guesses*. **Adopt:** validate against full ENABLE (never reject a
real word), but tune every target/price/relic against a common-word subset. This single decision does
most of the anti-gatekeeping work. [Designer/tuning, P0]
[web.ma.utexas wordlist](https://web.ma.utexas.edu/users/rusin/wordle/wordlist.html)

**Dead racks — rarer than feared.** Full enumeration of all 3.2M 7-tile Scrabble racks: only **~0.8%
unplayable**. Real frustration is "can I make a *good* word," driven by vowel balance. Known-good
ratio ~4:3 consonant:vowel; **vowel floods are worse than consonant floods.** → [Engineer, P0]
Enforce a **vowel floor of 2–3 (target 3–4) on every 9-tile draw**, optional **ceiling ~5**, via
constrained re-roll *within the bag* through the seeded RNG (doesn't open the alphabet — respects
scarcity). At 9 tiles, likely **no "any word" safety net needed.**
[Possibly Wrong enumeration](https://possiblywrong.wordpress.com/2017/12/04/probability-of-playable-racks-in-scrabble/) ·
[Scrabble letter distributions](https://en.wikipedia.org/wiki/Scrabble_letter_distributions)

**Dictionary — keep ENABLE.** Free, license-clean, ~99% of TWL coverage, excludes Collins obscurity
and proper nouns by default. Handle plurals *economically* (keep S scarce, à la Scrabble's 4/100) not
lexically. Profanity scrub optional for a personal build (one-line config, as specced).
[ENABLE vs TWL vs SOWPODS](https://www.krillkits.com/blog/enable-vs-twl-vs-sowpods)

**Touchscreen input — tap, not swipe (decisive).** Swipe-trace needs a stable adjacency grid and
treats the *path* as meaning; the rack reshuffles, isn't connected, and scores by *which instance*
fired (mods attach to instances). → [UX/Engineer, P0] Tap-to-select; tiles ≥48dp + ≥8dp gaps (9 tiles
→ probably two rows); rack + backspace + Submit in the **bottom thumb zone**, score/relics read-only
up top; **tapping moves a tile to a staging strip** (can't double-fire, natural undo); explicit
Submit. Wild-letter prompt works cleanly on tap.
[Material touch targets](https://m2.material.io/develop/web/supporting/touch-target) ·
[Thumb zone](https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/)

**Legibility — Balatro's sequential reveal is gold standard.** It "replaces a 10-page tutorial with
300ms of animation" by playing the scoring order out loud across 5 channels (card bounce, number-roll,
screen shake scaling with magnitude, particles, rising pitch). The trick: *post-hoc* sequential reveal
gives legibility while preserving suspense (no total before commit). → [UX, P1] Recommended LR
sequence: commit (tiles spring up) → base word rolls into WIT → per-tile Wit L→R (blue, rising pitch)
→ **all additive +Mult L→R (red) before any ×Mult** (teaches the `(1+ΣaddMult)` rule by demonstration)
→ ×Mult L→R (MULT *jumps*, shake escalates) → payoff (hit-pause, WIT×MULT collapses into Points).
~1.5–3s, **tap-to-fast-forward**. *(If position-as-lever ships, the reveal narrates the player's
chosen order instead — even better teaching.)*
[Balatro scoring guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3169032575) ·
[GMTK on Balatro's score-preview problem](https://gmtk.substack.com/p/balatros-cursed-design-problem)

**Accessibility (cheap, do early).** OpenDyslexic is **not** evidence-backed (dyslexia is
phonological, not visual) — opt-in toggle only, not the a11y story; what helps is **optional wider
letter spacing** (+18% reading, PNAS). **Never rely on color alone** (~8% of males colorblind) —
encode each tile mod in **3 redundant channels: icon silhouette + frame + text label (`×2`, `+5`)**,
color last. Resolves a collision: the blue-Wit/red-Mult scheme must distinguish add vs multiply by
**glyph + firing-order (`+` vs `×`), not color.** Target WCAG AA 4.5:1 (AAA 7:1 on glyphs). Consider
opt-in Hades/Celeste-style assist toggles.
[Zorzi spacing (PNAS)](https://pubmed.ncbi.nlm.nih.gov/22665803/) ·
[Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/ensure-no-essential-information-is-conveyed-by-a-fixed-colour-alone/)

**Anti-degenerate strategy — Model B already handles the big one.** Finite-bag tile *consumption*
structurally prevents word-spam (can't replay CAT without redrawing C/A/T) — exactly why Model B
(consume-and-draw) is correct. A "no repeat word" rule is **redundant and punitive — skip it.** Keep S
scarce (kills plural-S abuse); score by letters-used/length not word count; add per-round constraint
rounds (min length, mandatory tile, rising max-length — cheap in config).

**Replay/variety:** themed starting bags as "decks" (vowel-heavy / rare-letter / short-stack) with
**player-facing descriptions** (the existing MEMORY note is right — decks only create variety if
readable); verb-changing relics ("vowels are wild," "palindromes double") over flat-point relics;
cumulative stake ladder for Tier 2; optional seeded daily (free with deterministic RNG).

---

## 7. Consolidated action list, mapped to tiers

**Tier 0 / Phase-0 (now):**
- [Engineer] Vowel floor 2–3 (target 3–4), optional ceiling ~5, on every 9-tile draw via constrained
  in-bag re-roll. *(Directly serves the Tier-0 gate "can you almost always form a 3+ word?")*
- [UX] Tap-to-select + staging strip + bottom thumb-zone layout + explicit Submit; tiles ≥48dp.
- [Engineer/UX] Live valid-word indicator, free undo, instant clear rejection.
- [Engineer] Namespace separate RNG streams per concern; guard score precision (no NaN/Inf in the
  `score >= target` check).
- [Docs] ✅ Scoring engine relabeled in CLAUDE.md ("phase-ordered, position-independent" — not
  "Balatro order"); position-as-lever flagged as under exploration.

**Tier 1 (core deliverable):**
- [Designer] Tune targets so a skilled line clears with the *median* shop draw (anti-"luck not
  skill"); protect **build diversity** (several viable archetypes), not short-word supremacy.
- [Designer] Relic role taxonomy; favor decision-changing relics; kill dead-and-dominant cards.
- [UX] Balatro-style sequential score reveal; tile mods in 3 redundant channels.
- [Designer] Wordle two-list tuning discipline; front-load one readable synergy; per-round constraints.
- [Designer — explore] Prototype tile/relic **position as a skill lever** (the author's interest).

**Tier 2 (meta — the differentiator):**
- [Designer] Gate variety + difficulty, not power; keep loadout small. Win on a *generous, legible*
  Meta economy (avoid Letterlike's ~1-unlock/2hrs pace).
- [Designer] **Make boss/round modifiers visible and counterable before the player commits** — the
  biggest lesson from BW's reception. Mix wall-raisers with engine-breakers.
- [Designer] Themed bags-as-decks with player-facing descriptions; cumulative stake ladder.

**Cross-cutting:** default untimed; juice the payoff; a memorable theme; opt-in accessibility toggles.

---

## 8. Confidence & caveats

- The **Balatro scoring-order correction** is the most rigorously verified finding (4 independent
  sources).
- Beyond Words' "no-counterplay boss" and "dictionary rejects valid words" complaints lean on
  Steam/Reddit user consensus (strong sentiment, not single-author fact).
- Exact numbers for several games (hand sizes, formal +/× ordering) are unconfirmed without hands-on
  play; flagged inline as UNCONFIRMED in the source agent outputs.
- Some Balatro PRNG / session-length figures are community-sourced (medium confidence). Wiki counts
  are version-specific.
- **Legal footing:** learning mechanics, rules, systems, and balance lessons is squarely legal
  (idea/expression dichotomy; *Tetris Holding v. Xio*). We do not copy code, art, names, or
  descriptive text. This is a personal, non-distributed prototype regardless.
