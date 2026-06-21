# Letter Ride — Project Instructions

A single-player, turn-based **word-builder roguelike** in the Balatro mould. You build a
**bag of letter tiles** (your "deck") — tiles are *enchantable instances*, not bare letters —
draw a rack each turn, **tap tiles** to spell the best word you can, and beat a rising
**Points** target each round (`Points = Wit × Mult`). Between rounds you spend **Coins** in a
shop on letters, enchantments, upgrades, and **relics** that warp scoring. Across runs you earn
**Meta** currency and spend it in a between-runs meta-shop (unlocks, decks, stakes, loadout).
No opponent — you play against a number, then against your own mastery. Ships as an Android APK.

## Start here

1. Read `docs/2026-06-20-letter-ride-design.md` (the design spec — the *what* and *why*).
2. Read `docs/2026-06-20-letter-ride-plan.md` (the 4-tier **roadmap** — the overview + 🛑 gates).
3. **Build Tier 0 from the executable plan `docs/2026-06-21-letter-ride-tier0-plan.md`** — the
   source of truth for Tier 0 (full task-by-task code). Tiers 1–3 get their own executable plans
   authored just-in-time after each gate; the roadmap is the high-level map.
4. Execute **in order**, one task at a time, TDD-style. Build and **playtest each tier before the
   next** (Tier 0 → 1 → 2 → 3).

## Non-negotiable design rules (these prevent the design from drifting)

- **Scarcity pillar:** letters are ALWAYS drawn from a bag. Never give the player an open
  alphabet — it kills the entire economy. The bag's composition *is* the deckbuilding.
- **Tiles are instances, not strings:** a tile is `{ id, letter, mods }`. The bag holds
  `Tile[]`. This is what makes purchases (enchant/upgrade/thin) meaningful.
- **One scoring formula, phase-ordered:** `Points = Wit × Mult`. The engine sums all `+Mult`
  into `(1 + ΣaddMult)`, then applies **all** `×Mult` — regardless of acquisition order
  (Balatro order, enforced by the engine, not by relic ordering). All scoring goes through
  `scoreWord` in `src/scoring.js`. (Term note: "Wit" is the additive base, formerly "chips".)
- **Three currencies, no others:** **Points** (in-round score vs target), **Coins** (in-run
  shop), **Meta** (persistent, between-runs meta-shop). No hint/XP/energy currencies.
- **Relics + tile-mods are the skill expression**, not vocabulary. A clever *short* word with
  the right modifiers must be able to out-score a long word without them. When tuning, protect this.
- **Tier discipline:** meta-progression (Tier 2) and the Capacitor/Android build (Tier 3) ARE
  in scope now — but built **last**, each only after the previous tier is playtested as fun.
  Do NOT build anything from the spec's "Deferred wishlist" (Tier 4+: leveled alphabet/letter
  XP, achievements, variable word length, branching map, boss rounds, true part-of-speech
  synergies). If you think a deferred feature is needed, STOP and ask.

## Architecture & conventions

- **Vanilla JS, ES modules, no build step, no framework.** HTML5 + CSS. Matches the sibling
  Pawkeet Slots project's hand-rolled style.
- **Logic vs. UI split is strict.** All game *rules* live in pure, DOM-free modules
  (`rng`, `dictionary`, `tiles`, `bag`, `word`, `patterns`, `scoring`, `relics`, `shop`, `run`,
  `meta`, `storage`) and are unit-tested headless. `ui.js`/`main.js` only render state and emit
  user actions (incl. tap-to-build) — no rules in the UI.
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
