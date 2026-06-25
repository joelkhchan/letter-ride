# Letter Ride — Front-of-Game UX & IA redesign (design doc)

**Status (2026-06-25):** DESIGN ONLY, not yet implemented. Author has approved the direction
(split the merged meta screen; add a light theme + toggle) and asked for this doc before any build.
Grounded in the existing research: design spec (`2026-06-20-letter-ride-design.md` §3, §9),
UX/design research (`2026-06-23-letter-ride-ux-design-assets-research.md`), genre research
(`2026-06-22-letter-ride-genre-research.md`), achievements/meta design
(`2026-06-25-letter-ride-achievements-meta-design.md`), brand identity (`2026-06-24-...`).

This is a **reskin/IA layer**: no game-rule changes. Logic modules are untouched; the work is in
`ui.js`, `main.js` routing, `style.css`, and `settings.js`.

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
§9, §11), so the fix is UI/routing only.

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

`main.js` gains a distinct `view` for run-setup (e.g. `'setup'`) separate from `'meta'` (the
meta-shop). `onNewRun` routes to `'setup'`; `onOpenMetaShop` routes to `'meta'`. They no longer
share a screen.

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

### 3.3 Meta Shop (new — split out of `renderMeta`)
Purpose: spend Meta on persistent unlocks. Same offers as today, but **organized into sections**
instead of one flat list. Sections map to the offer types already produced by
`metaShopOffers()` in `meta.js`:
- **Relics** (`unlockRelic`)
- **Tile-mods** (`unlockMod`)
- **Bags** (`unlockDeck`)
- **Stakes** (`unlockStake`)
- **Loadout** (`loadout`)

Each section is a labeled group; within it, offers are cards (name · desc · cost), disabled when
`meta.meta < cost`. Order by *what it does*, not by price (achievements/meta design §5.4: lead with
the thing, cost secondary). This is a render-only change to `renderMeta`'s offer block; the
`metaShopOffers` data is unchanged. Meta balance shown at top with the engraved Meta seal.
Back arrow to the menu. (The current "Stats" button here is redundant with the Achievements
lifetime-stats panel — remove it; stats live on the Achievements screen.)

### 3.4 Settings (`renderSettings`) — expand + organize
Group into sections; add the documented options. The UX research enumerates the target set
(animation-speed, reduce-motion, audio, text size, color-independence).
- **Audio**: Sound effects toggle (exists). (Music was removed per author; no music row.)
- **Motion**: Reduced motion (exists), Fast scoring (exists).
- **Display**: **Theme — Dark / Light** (new, see §4), **Text size — Normal / Large** (new).
- **Accessibility note**: color-independence ships by default (redundant glyph + label coding, a
  brand rule), so no separate "colorblind mode" toggle is needed (docs prefer this for a personal
  build).
- **Run**: Abandon current run (exists, when a run is active).
- Back arrow to the menu.
Persist new prefs via `settings.js` (same pattern as `reducedMotion`/`fastScoring`).

### 3.5 Achievements (`renderAchievements`) — keep structure, add badges
The screen is **already well-structured** (merged from the achievements session): bucketed sections
(Getting Started / Ranks / Mastery / Build Diversity / Discovery), three-state rows
(locked / ready-to-collect / collected) with Collect buttons, a stake×deck bounty grid, and a
lifetime-stats panel. It matches the achievements/meta spec. What it lacks is the **visual**:
- **Badges**: give each achievement an engraved aged-gold **seal** (reuse the Tier-A seal system
  from `icons.js`), dimmed/locked when not yet earned, full-color when ready/collected. A per-bucket
  emblem is a cheaper alternative if per-achievement art is too much.
- **Progress bars**: replace the bare "3/5" text with a goal-gradient bar (achievements/meta §5.4)
  for countable achievements.
This is a polish pass on a good structure, not a rebuild.

## 4. Light theme + toggle (the brand-touching item)

The author has approved adding a light/day theme. **This is more than a token swap** and is the
largest item, so it is sequenced last.

- **Token set**: add a `[data-theme="light"]` block that overrides the `:root` palette tokens with
  a warm "daytime print-shop" set (the original brand sketch was a warm-cream daytime palette, so a
  light variant is on-brand history). Starting direction (to be dialed via a theme gallery like the
  dark palette was): paper ground `#f3ecd9`, sunk panel `#e7dcc1`, ink `#2a2012` (sepia-dark),
  rule `#cdbd97`, gold deepened to `#8a6a18` for text contrast on cream, navy + coral + teal kept
  as spot inks. Exact values TBD by the author.
- **Component audit (the real work)**: several components assume a *dark ground* and must be
  re-checked on light: the engraved **seals** (navy disc + gold glyph — would read heavy on cream;
  may need a light-ground seal variant), **modded tiles** (inked-navy slug — on a cream rack it
  inverts the contrast logic), the **boss/chain banners** (dark maroon/teal), the HUD, and the
  `#coins`/wild-star tints. Each needs a light-theme rule. This is why the palette was "locked":
  the component system was built dark-first. Budget for a per-component pass, not just a `:root`
  swap.
- **Toggle + persistence**: a Display setting (Dark / Light) stored in `settings.js`; sets
  `document.documentElement.dataset.theme`. Default to the OS preference via
  `prefers-color-scheme` on first load, then honor the explicit choice.

## 5. Navigation

- **Back arrow**: one consistent **top-left back arrow** on every pushed screen (Run Setup, Meta
  Shop, Achievements, Settings), replacing the inconsistent text controls ("Back" vs "Main Menu").
  Keep labeled buttons only for *commits* (Start Run, Abandon Run). Style the arrow to the
  letterpress identity (a printer's-mark / fleuron-style glyph, or a Tabler `arrow-left` line icon
  consistent with the Tier-B UI set).
- **Android hardware/gesture back** (for the Capacitor APK, Tier 3): wire the platform back button
  to the same "pop to previous screen" handler so Android users get the expected affordance.
- **Transitions** (optional, later): the UX research specs ≤300ms, skippable, shared-axis for the
  menu↔setup↔shop↔run journey, behind a `document.startViewTransition` capability guard with a CSS
  fallback, gated by `prefers-reduced-motion`. Nice-to-have polish, not required for the IA split.

## 6. Smaller fixes (fold in where touched)
- Run-setup active-state outline uses hardcoded `#333` → use `--gold` (token-driven, on-brand).
- Remove the redundant "Stats" button on the meta screen (stats live on Achievements).
- Reconcile rank ladders: the Broadside says "Apprentice → Journeyman → Master Printer"; the
  lifetime-level system uses a different ladder. Pick one (branding owns it).

## 7. Out of scope / deferred
- No game-rule, scoring, relic, or balance changes.
- No new meta content (same offers, reorganized).
- View Transitions animation polish is optional (after the IA split lands).
- Achievements logic is unchanged (the merge already shipped it); this is presentation only.

## 8. Implementation order (each ≈ one commit, gated by the author)
1. **IA split + organized Meta Shop**: new Run Setup screen + sectioned Meta Shop screen + routing
   (`main.js` `view`), fixes the root cause and issues 1–3. Includes the `#333`→gold and Stats-button
   fixes.
2. **Back arrow + Settings expansion**: consistent top-left back arrow across pushed screens;
   Settings grouped into Audio/Motion/Display/Run with text-size added.
3. **Achievement badges + progress bars**: engraved seals + goal-gradient bars on the existing
   screen.
4. **Light theme + toggle**: the token set + the per-component audit + the Display toggle. Largest;
   dial the light palette via a theme gallery with the author.

## 9. Decisions made + open questions
- DECIDED: build a real light theme + dark/light toggle (reopens the locked palette, author's call).
- DECIDED: write this doc first; implement only after author review.
- OPEN: exact light-theme palette values (propose a gallery, like the dark palette).
- OPEN: per-achievement seal badges vs per-bucket emblems (effort vs richness).
- OPEN: meta-shop name (keep "Meta Shop" vs a themed name like "The Foundry"). Minor.
