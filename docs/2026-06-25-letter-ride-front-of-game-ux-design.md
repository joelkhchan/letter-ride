# Letter Ride — Front-of-Game UX & IA redesign (design doc)

**Status (2026-06-25, rev. 2 after spec-review):** DESIGN ONLY, not yet implemented.
Author approved the direction (split the merged meta screen; add a light theme). This revision
acts on a two-reviewer spec-review: the **light theme is carved out as a separate, bounded Phase B**
so the IA fix (Phase A) ships independently; the full routing change, the orphaned picker state, the
rank-ladder reconciliation, a verification plan, and several nits are now addressed inline.
Grounded in the existing research: design spec (`2026-06-20-letter-ride-design.md` §3, §9),
UX/design research (`2026-06-23-letter-ride-ux-design-assets-research.md`), genre research
(`2026-06-22-letter-ride-genre-research.md`), achievements/meta design
(`2026-06-25-letter-ride-achievements-meta-design.md`), brand identity (`2026-06-24-...`).

This is a **reskin/IA layer**: no game-rule changes. Logic modules are untouched; the work is in
`ui.js`, `main.js` routing, `style.css`, and `settings.js`. (Verification plan in §6.)

---

## 1. Problem

One screen (`renderMeta`) does three jobs at once:
- **run setup** (deck picker + stake picker + Start Run),
- the **meta-shop** (a flat list of "Unlock X: desc · cost" buttons), and
- it is the destination for **both** "New Run" and "Meta Shop" on the main menu.

The docs show this was a deliberate v2 shortcut ("the title screen *is* the meta-shop", design
spec §9), not an accident. It produces every front-of-game complaint: New Run and Meta Shop land
on the same screen; the meta-shop reads as a long undifferentiated list; run setup and persistent
spending are tangled. MetaState and RunState are **already cleanly separated in data** (design spec
§9, §11; `meta.js` owns a separately-persisted, separately-versioned MetaState), so the fix is
UI/routing only.

## 2. Target information architecture

Flat, full-screen state stack (the convention the docs adopt: Balatro-style, NOT a Slay-the-Spire
spatial map). The Main Menu is the hub; each feature is its own pushed screen with a back arrow.

```
Main Menu
├─ Resume Run        → (in-run)
├─ New Run           → Run Setup screen        → (in-run)
├─ Meta Shop         → Meta Shop screen
├─ Achievements      → Achievements screen
└─ Settings          → Settings screen
```

`main.js` gains a distinct `view` for run setup (e.g. `'setup'`) separate from `'meta'` (the
meta-shop). **All current `view = 'meta'` assignments must be re-pointed, not just the two menu
handlers** — there are three today:
1. `onNewRun` (menu) → route to `'setup'`.
2. `onOpenMetaShop` (menu) → route to `'meta'` (now a pure Meta Shop).
3. **The abandon-run handler** (`main.js`, after clearing the saved run) → currently lands on the
   merged screen; re-point to **`'menu'`** (the new hub), since the Meta Shop is no longer a
   sensible post-abandon landing.

Also audit `endRun` and any post-run-completion transition: today they go to `'meta'` (which showed
Start-Run + shop). Decide their new landing (Main Menu hub, or directly Run Setup for fast restart)
and set it explicitly. The "zero-friction restart" convention (genre research) argues for a quick
path back into a new run, so a "Play again" affordance on the run-end/meta screen is worth keeping.

## 3. Screen specs

### 3.1 Main Menu (`renderMenu`) — minor
Already a real hub (title, tagline, 5 nav buttons with line icons, Meta total, achievements badge).
Keep as-is. Only change: "New Run" now routes to the new Run Setup screen.

### 3.2 Run Setup (new — split out of `renderMeta`)
Purpose: choose how *this run* starts, then commit. Deliberately light (genre research: invest
choice in the shop beat, not setup).
- **Bag (deck) picker**: the unlocked decks, each a card with name + description. Active state uses
  `--gold` (today it uses a hardcoded `outline:2px solid #333`, off-palette — fix).
- **Stake picker**: the unlocked stakes, name + (brief) difficulty/pay note.
- **Seed entry** (optional, small text field): the UX research flags run-seed entry as a cheap,
  on-brand skill/community feature.
- **Start Run** (primary commit button).
- Back arrow (top-left) to the menu. No meta-shop offers here.

**State note (don't treat the split as pure markup):** the deck/stake selection lives in
module-level mutables `selectedDeckId` / `selectedStakeId` in `ui.js`, and `renderMeta` re-invokes
itself on every picker click, with a reset-to-defaults step inside Start Run. The extracted
`renderSetup` must own that state, the click→re-render pattern, and the reset-on-Start logic.
Prefer threading the selection through explicitly (rather than module globals) now that two screens
read it (the setup screen and the run it launches).

### 3.3 Meta Shop (new — split out of `renderMeta`)
Purpose: spend Meta on persistent unlocks. Same offers as today, but **organized into sections**
instead of one flat list. Sections map to the offer types `metaShopOffers()` in `meta.js` already
produces:
- **Relics** (`unlockRelic`)
- **Tile-mods** (`unlockMod`)
- **Bags** (`unlockDeck`)
- **Stakes** (`unlockStake`)
- **Loadout** (`loadout`)

Each section is a labeled group; within it, offers are cards (name · desc · cost), disabled when
`meta.meta < cost`. Order within a section by *what it does*, not by price (in the spirit of the
achievements/meta design's "lead with the thing, cost secondary" principle for the achievements
screen — applied here by analogy, not as a direct prescription). This is a render-only change to
`renderMeta`'s offer block; the `metaShopOffers` data is unchanged. Meta balance shown at top with
the engraved Meta seal. Back arrow to the menu. (Remove the redundant "Stats" button currently on
this screen — it opens the balance-stats overlay; lifetime stats already live on the Achievements
screen.)

### 3.4 Settings (`renderSettings`) — expand + organize
Group into sections; add the documented options. The UX research enumerates the target set
(animation-speed, reduce-motion, audio, text size, color-independence).
- **Audio**: Sound effects toggle (exists). (Music was removed per author; no music row.)
- **Motion**: Reduced motion (exists), Fast scoring (exists).
- **Display**: **Text size — Normal / Large** (new). *(The dark/light Theme control is built in
  Phase B, §8 — not added here, so we never ship a toggle for a theme that doesn't exist yet.)*
- **Accessibility note**: color-independence ships by default (redundant glyph + label coding, a
  brand rule), so no separate "colorblind mode" toggle is needed.
- **Run**: Abandon current run (exists, when a run is active).
- Back arrow to the menu.
Persist new prefs via `settings.js` (same pattern as `reducedMotion`/`fastScoring`).

### 3.5 Achievements (`renderAchievements`) — keep structure, add badges
The screen is **already well-structured** (merged from the achievements session): bucketed sections
(Getting Started / Ranks / Mastery / Build Diversity / Discovery), three-state rows
(locked / ready-to-collect / collected) with Collect buttons, a stake×deck bounty grid, and a
lifetime-stats panel. What it lacks is the **visual**:
- **Badges**: give each achievement an engraved aged-gold **seal** (reuse the Tier-A seal system in
  `icons.js`), dimmed/locked when unearned, full-color when ready/collected. A per-bucket emblem is
  a cheaper alternative if per-achievement art is too much (OPEN, §10).
- **Progress bars**: replace the bare "3/5" text with a goal-gradient bar for the countable
  achievements.
Polish on a good structure, not a rebuild.

## 4. Navigation
- **Back arrow**: one consistent **top-left back arrow** on every pushed screen (Run Setup, Meta
  Shop, Achievements, Settings), replacing the inconsistent text controls ("Back" vs "Main Menu").
  Keep labeled buttons only for *commits* (Start Run, Abandon Run). Style to the letterpress
  identity (a Tabler `arrow-left` line icon consistent with the Tier-B UI set, or a printer's-mark
  glyph).
- **Android hardware/gesture back** (Capacitor APK, Tier 3): wire the platform back button to the
  same "pop to previous screen" handler.
- **Transitions** (optional, later): the UX research specs ≤300ms, skippable, shared-axis for the
  menu↔setup↔shop↔run journey, behind a `document.startViewTransition` capability guard with a CSS
  fallback, gated by `prefers-reduced-motion`. Nice-to-have, not required for the IA split.

## 5. Smaller fixes (fold in where touched)
- Run-setup active-state outline uses hardcoded `#333` → use `--gold` (token-driven, on-brand).
- Remove the redundant "Stats" button on the meta screen (stats live on Achievements).
- **Rank-ladder reconciliation (this is a data change, not a copy tweak).** Two different ladders
  exist on different axes: the Broadside's 3-tier *run-result* label `Apprentice → Journeyman →
  Master Printer` (`broadside.js`) and the 5-tier *lifetime* ladder `Novice / Apprentice /
  Journeyman / Expert / Artisan` (`config.js` LEVELS), which share the words "Apprentice"/
  "Journeyman" with different meanings. The `rewardOverride` keys in `config.js` (`reachApprentice`
  …) are coupled to the 5-tier names. So the fix is: (a) decide whether the Broadside should reuse
  the lifetime names at all (they measure different things — run outcome vs lifetime progression),
  and (b) if names change, update the coupled `rewardOverride` keys and any achievement IDs that
  reference `reach<Name>`. Branding owns the final names.

## 6. Verification plan
The UI/feel layer (`ui.js`/`main.js`/`settings.js` consumers) is not unit-tested by project
convention; it is verified by a browser smoke pass. Concretely:
- **Unit-test what is logic-shaped:** the new `settings.js` prefs (`textSize`, and in Phase B
  `theme`) are plain get/set with defaults — add a `test/settings.test.js` case (defaults, set,
  toggle/round-trip) even though the consumers aren't tested.
- **Browser smoke after each step:** run the dev server and walk Menu → Run Setup → Start Run →
  (in-run) → round clear → Meta Shop → Achievements → Settings → back, watching the console for
  errors. The **routing change is the highest-risk untested piece** (three re-pointed `view`
  assignments), so smoke it after step A1 specifically.
- `npm test` stays green throughout (logic untouched).

## 7. Phase A — the IA / UX fix (ships as a unit, independent of the light theme)
Order, each ≈ one commit, gated by the author:
- **A1. IA split + organized Meta Shop:** new Run Setup `view` + screen, sectioned Meta Shop screen,
  all three `view='meta'` routes re-pointed (§2), `#333`→gold, remove the Stats button. Fixes the
  root cause and issues 1–3.
- **A2. Back arrow + Settings expansion:** consistent top-left back arrow across pushed screens
  (+ Android hardware-back); Settings grouped into Audio/Motion/Display/Run with text-size added
  (no Theme row yet).
- **A3. Achievement badges + progress bars:** engraved seals + goal-gradient bars on the existing
  screen.
- **A4. Rank-ladder reconciliation** (§5) — small but coupled; do it deliberately.

Phase A touches no brand-locked decisions and is fully reversible per commit.

## 8. Phase B — Light theme + toggle (SEPARATE, DEFERRED, bounded effort)
Carved out of Phase A per the spec-review: it is a different problem (a brand-surface change), it
**reopens the LOCKED palette** (a prior brand decision), and it is the highest-blast-radius item
(touches every component's CSS). Do **not** start it until the author schedules it; Phase A ships
without it.

- **Reversibility / default:** **dark stays the default and the only fully-audited theme.** Light
  ships strictly behind the toggle and can be dropped without touching dark. No half-finished light
  pass becomes the default.
- **Brand record:** reopening the palette supersedes the "palette LOCKED / don't reopen" decision.
  A Phase B task is to update `2026-06-24-letter-ride-brand-identity.md` and the
  `brand-identity-decided` memory so the durable record reflects the sanctioned reopening (prevents
  future re-litigation / two sources of truth).
- **Token set:** add a `[data-theme="light"]` block overriding the `:root` palette with a warm
  "daytime print-shop" set (the original brand sketch was a warm-cream daytime palette, so a light
  variant is on-brand history). Exact values dialed via a **theme gallery** with the author (as the
  dark palette was), not guessed here.
- **Component audit (the real work) + acceptance criteria:** several components assume a *dark
  ground* and each needs a light-theme rule. "Done" = every item below re-checked on the light
  ground and signed off by the author, with text/value contrast meeting the UX research's ≥4.5:1
  bar:
  - engraved **seals** (navy disc + gold glyph — needs a light-ground variant),
  - **modded tiles** (inked-navy slug — inverts on a cream rack),
  - **boss / chain banners** (dark maroon / teal backgrounds),
  - the **HUD**, `#coins` coin glyph, and the **wild-star** tint,
  - any other element with a hardcoded dark color outside `:root`.
- **Toggle + persistence:** a Display setting modeled as a **tri-state** `theme: 'dark' | 'light' |
  'system'` (default `'system'` = follow `prefers-color-scheme`; an explicit pick persists). A
  boolean cannot represent "first load follows OS, then honor the explicit choice," and `settings.js`
  merges defaults with no absent/present signal — so the tri-state is required. Sets
  `document.documentElement.dataset.theme`.

## 9. Out of scope / deferred
- No game-rule, scoring, relic, or balance changes.
- No new meta content (same offers, reorganized).
- View Transitions animation polish is optional (after the IA split lands).
- Achievements logic is unchanged (the merge already shipped it); this is presentation only.

## 10. Decisions made + open questions
- DECIDED: build a real light theme + dark/light toggle — but as **Phase B, decoupled** from the
  Phase A IA fix (reopens the locked palette, author's call; dark stays default).
- DECIDED: write this doc first; implement only after author review.
- OPEN: exact light-theme palette values (Phase B; via a gallery, like the dark palette).
- OPEN: per-achievement seal badges vs per-bucket emblems (effort vs richness).
- OPEN: post-run-completion landing (Main Menu hub vs straight into Run Setup for fast restart).
- OPEN: meta-shop name (keep "Meta Shop" vs a themed name like "The Foundry"). Minor.
