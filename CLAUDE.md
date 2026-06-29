# Letter Ride — Project Instructions

A single-player, turn-based **word-builder roguelike** in the Balatro mould. You build a
**bag of letter tiles** (your "deck") — tiles are *enchantable instances*, not bare letters —
draw a rack each turn, **tap tiles** to spell the best word you can, and beat a rising
**Score** target each round (`Score = Points × Mult`). Between rounds you spend **$** in a
shop on letters, enchantments, upgrades, and **relics** that warp scoring. Across runs you earn
**Meta** currency and spend it in a between-runs meta-shop (unlocks, decks, stakes, loadout).
No opponent — you play against a number, then against your own mastery. Ships as an Android APK.

## Start here

**Status (2026-06-25):** Tiers 0 to 2 are built and accepted (the spine, the in-run roguelike, the
meta loop), plus extra greenlit mechanics (retrigger, transform/destroy, chaining) and the
**Phase 4 feel layer** (the look, the pull, sound, the broadside trophy card, and a main menu).
Remaining roadmap work: **Tier 3, ship as an Android APK (Capacitor)**, gated on an author playtest
+ difficulty tuning first. Next visual work: an **engraved icon set** (see below).

Orientation docs:
1. `docs/2026-06-20-letter-ride-design.md`: the design spec (the *what* and *why*).
2. `docs/2026-06-28-letter-ride-roadmap.md`: the **current roadmap** (supersedes the old 4-tier plan +
   the 06-22 roadmap; holds the acquisition-funnel diagnosis + the forward phases A-E).
3. `docs/2026-06-24-letter-ride-brand-identity.md`: the **visual identity**, deep navy + antique
   gold + **Zilla Slab**, letterpress/print-craft (palette revised 2026-06-25 from warm cream). The
   next visual layer is an **engraved icon set** (game-icons.net, CC-BY, gold-tinted + framed), NOT
   pixel art. See the `visual-assets-decided` memory.

Still TDD and playtest-gated: build and **playtest each tier before the next**, and the author
judges feel (AI builds systems but cannot judge fun).

## Non-negotiable design rules (these prevent the design from drifting)

- **Scarcity pillar:** letters are ALWAYS drawn from a bag. Never give the player an open
  alphabet — it kills the entire economy. The bag's composition *is* the deckbuilding.
- **Tiles are instances, not strings:** a tile is `{ id, letter, mods }`. The bag holds
  `Tile[]`. This is what makes purchases (enchant/upgrade/thin) meaningful.
- **One scoring formula:** `Score = Points × Mult`. All scoring goes through `scoreWord` in
  `src/scoring.js`. The engine *currently* sums all `+Mult` into `(1 + ΣaddMult)`, then applies
  **all** `×Mult` — a **position-independent phase order** enforced by the engine, not by relic
  ordering. **Correction (2026-06-23):** this is *not* how Balatro actually scores — Balatro is a
  strict left-to-right running total where joker *position* changes the result; our model is a
  deliberate simplification (verified in the competitive research). **Under active exploration,
  NOT yet locked into the spec:** reintroducing tile/relic *position* as a skill lever (the author
  likes it). See `docs/2026-06-23-letter-ride-competitive-research.md`. (Term note: **Points** is
  the additive base — formerly "Wit"/"chips"; **Score** is the round result it produces.)
- **Three currencies, no others:** **Score** (the in-round total vs target), **$** (in-run
  shop; internal field still `coins`), **Meta** (persistent, between-runs meta-shop). No hint/XP/energy currencies.
- **Relics + tile-mods are the skill expression**, not vocabulary. Success comes from building a
  letter economy + modifier engine, NOT from knowing big words. **Build diversity is the goal:**
  multiple strategies — short-word stacks, long words, rare letters, vowels, patterns — must all
  be *viable*. A clever short word with the right modifiers should be *competitive* with a long
  word (longer words still carry their own bonuses); short words need **not** strictly out-score
  long ones. When tuning, protect viable-build diversity, not a single archetype's supremacy.
- **Skill must be able to beat luck — but luck stays fun:** the genre's #1 failure mode (per the
  competitive research) is runs decided by pure RNG. The player needs real levers — bag-shaping,
  selective discard/reroll, hand management, mod placement — to overcome a bad draw through skill.
  Never let pure chance decide a run. *But* preserve the joy of chance: surprising draws and lucky
  combos should still delight. Tune toward "a skilled line clears the **median** draw," not the
  lucky tail, and make boss/round modifiers legible *before* the player commits.
- **Tier discipline:** Tiers 0 to 2 are built; **Tier 3 (the Capacitor/Android APK) is the last
  roadmap tier**, gated on an author playtest + tuning first. Do NOT build the spec's "Deferred
  wishlist" (Tier 4+): leveled alphabet/letter XP; **achievements** (when built they should pay
  **Meta**, see the `achievements-future` memory); variable word length; a branching run map; true
  part-of-speech synergies. **Bosses are built** (the Sentence rounds, `bosses.js`), so they are no
  longer deferred. If you think a deferred feature is needed, STOP and ask.

## Architecture & conventions

- **Vanilla JS, ES modules, no build step, no framework.** HTML5 + CSS. Matches the sibling
  Pawkeet Slots project's hand-rolled style.
- **Logic vs. UI split is strict.** All game *rules* live in pure, DOM-free modules
  (`rng`, `dictionary`, `tiles`, `bag`, `word`, `patterns`, `scoring`, `relics`, `shop`, `run`,
  `meta`, `bosses`, `archetypes`, `events`, `telemetry`, `storage`) and are unit-tested headless.
  The **UI/feel layer** is browser-only and verified manually (never unit-tested): `ui.js`/`main.js`
  (render + tap-to-build, no rules), plus `audio.js` (Web Audio SFX, synthesized, no files),
  `broadside.js` (the canvas trophy card), and `settings.js` (UI prefs). CSS is token-driven in
  `style.css` (the whole palette is the `:root` block).
- **Dependency injection:** `dictionary` and `tileValues` are passed *into* functions, never
  imported as globals inside logic modules. This is what keeps them testable.
- **Determinism:** all randomness flows through the seeded RNG in `src/rng.js`. **No
  `Math.random()` in game logic** (only acceptable for picking a UI-level run seed in `main.js`).
- **`config.js` holds every tunable number and no logic.** Balancing = editing config.

## Testing

- `npm test` runs `node --test` (Node's built-in runner — no test framework dependency).
- Every logic module gets a `test/<module>.test.js`. Tests inject tiny fixtures (a 3-word
  dictionary, a 3-tile bag) — never the full 170k word list.
- UI is verified manually (`npm run serve`, open on desktop + phone). Don't try to unit-test the DOM.

## Setup notes

- The dictionary (`assets/enable1.txt`, ENABLE word list) is downloaded in Task 0 of the plan,
  not committed pre-emptively. If missing: `curl -L -o assets/enable1.txt https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt`
- This is a **personal prototype for the author to play**, not a commercial release. Optimize
  for "fun on my phone, fast," not for store-readiness, onboarding, or broad device testing.

## Working agreement (from the author's global preferences)

- Conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`). Frequent, small commits — one per plan step.
- Do only what's asked; when a design choice is ambiguous or you'd diverge from the plan/spec, STOP and ask.
- Commit/push only when asked. (Task 0 initializes the git repo; per-task commits are part of the plan's TDD rhythm.)
- The hard part of this genre (relic/letter balance, vocabulary-gatekeeping) needs the
  author's playtesting — AI can build the systems but cannot judge whether they're fun. Surface
  tuning questions; don't silently pick "balanced" numbers and claim it's done.
