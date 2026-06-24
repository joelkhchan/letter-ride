# Letter Ride — Phase 4: Letterpress Reskin (execution design)

**Date:** 2026-06-24 · **Status:** design, pre-build. The Phase 4 "feel, identity & visuals" pass,
executing the **decided** letterpress identity from
[the brand doc](2026-06-24-letter-ride-brand-identity.md). Author chose the **full reskin** (look +
pull + sound + broadside). This is the staff-designer execution roadmap; each sub-project then gets
its own focused design -> plan -> SDD build, like Phase 3.

**This changes NO game rules.** Scoring, bag, tiles, relics, run flow are untouched. Phase 4 is a
render/feel layer over `ui.js` / `style.css` / `main.js` + a few new presentation-only modules.
The brand doc already locked the identity (palette, type, tiles-as-sorts, the pull, voice); this doc
is the *how we build it*, not a re-litigation of *what*.

## 1. Architecture + constraints

- **Vanilla JS/CSS, no build step, no framework** (unchanged). The reskin is CSS + DOM + Canvas +
  Web Audio, layered on the existing structure.
- **The CSS is already token-based** (`:root` custom properties: `--accent`, `--surface`, `--text`,
  radii, + a dark-mode block). The Look sub-project mostly **re-themes these tokens** + swaps fonts +
  adds texture, so most screens inherit the new identity for free.
- **Logic/UI split holds:** no rules module is touched. New presentation modules only
  (e.g. `src/audio.js`, `src/broadside.js`). Animation lives in `ui.js`/CSS.
- **Android/Capacitor target = offline:** assets must be **self-hosted** (no runtime CDN). Fonts ship
  as committed `woff2`; sound is **synthesized in Web Audio** (no audio files needed); texture is
  **CSS-procedural** (gradients + inner-shadow deboss, no image files). This keeps the APK self-
  contained and the repo asset-light.
- **Accessibility (brand rule):** every tile-mod reads in **redundant channels** (glyph weight/style
  + frame + a text label), never color alone.

## 2. Sub-projects (build order = feel-ROI, one at a time)

### SP1 — The Look (the identity at a glance)
Re-theme the token palette to the **print-shop** set (ink black, cream paper, lead-type grey, one or
two spot inks: a deep red + an ochre/teal). Typography becomes the hero: a bold **woodtype/poster**
display face for the score + headers, a clean **slab/serif** for body. **Tiles render as type-sorts**
(a lead/wood sort with the letter on its face: deboss, bevel, grain) instead of rounded buttons.
**Mods become typographic** (bold / italic / foiled / spot-inked / ornamented) with a frame + label
for accessibility. Add pressed-paper grain + a letterpress deboss (CSS inner shadow), printer's rules
+ fleurons as dividers. Fold in the **systems-rename copy** from the brand doc (Passage / sorts /
composing stick / the line you pull / impression / the run), author-owned, no em dashes.
*Decisions for its design doc:* exact OFL faces (see §3 font question); how literal the sort
rendering goes; which screens get texture vs. stay clean for legibility.

### SP2 — The Pull (the payoff moment)
The commit -> score animation, the single highest-impact juice: on submit, the sorts lock into the
chase, the **platen comes down (CHUNK)**, the impression inks up, **+Mult ornaments lay in left to
right**, then the **xMult run multiplies** and the big woodtype number **rolls up** with a deboss
shimmer; the printed line lifts off on a **hit-pause**. **Tap-to-fast-forward** (respect the player's
time). Also the **boss-reveal** beat (the smudge/deadline/editor/censor enters in-fiction). Built as
a CSS/JS animation sequence driven by the existing `scoreWord` breakdown (which already itemizes
points / +Mult / xMult parts), with a reduced-motion fallback.
*Decisions for its design doc:* animation timing/curve; how the breakdown maps to the staged reveal;
skip/settings handling.

### SP3 — Sound (warm, tactile, cheap)
A small **Web Audio** SFX set, synthesized in-code (no files): press **chunk**, paper rustle, ink
roller, a tile *click* on tap, a coin/cash-out chime, a boss sting. A **mute toggle** persisted in
localStorage; respects a silent default until toggled if that feels better on a phone. Optional warm
ambient loop deferred (the brand doc's "quiet jazz" is a nice-to-have, and a synth loop is iffy; a
committed music file is a later asset call).
*Decisions for its design doc:* synth recipes per SFX; mute default; whether music is in or deferred.

### SP4 — The Broadside (the shareable artifact)
Each finished run renders as a **broadside / colophon**: the best line set in beautiful type, the
Passage completed, the score, and a printer's-mark rank (**Apprentice -> Journeyman -> Master
Printer**). Rendered to a **Canvas** so it can be **saved/shared as an image** (the genre's missing
Wordle-grid equivalent, and the brand doc's named discovery lever). Built from run-end state; pure
presentation.
*Decisions for its design doc:* canvas layout/typography; rank thresholds; save vs. Web Share API on
Android; what stats appear.

## 3. Asset strategy

- **Fonts (the one real asset):** self-hosted OFL `woff2` — a woodtype/poster display face + a
  slab/serif body face, loaded via `@font-face` in `style.css`, with a **system-serif fallback** so
  the layout works before/without them. **Open question (§5):** the exact faces + who downloads the
  `woff2` files (I can recommend specific OFL faces; the files need committing, like the ENABLE
  dictionary was). SP1 can ship a system-serif first cut and drop in the real faces when available.
- **Texture/deboss:** CSS-procedural (layered gradients, `box-shadow`/`text-shadow` inner-shadow
  deboss, `filter`). No image files.
- **Sound:** Web Audio synthesis (no files).
- **Ornaments/icons:** OFL fleuron/dingbat glyphs (a font) or a few inline SVGs; only if needed.

## 4. Copy + voice

Dry, literate, a little sly (a typesetter's wit), per the brand voice. The systems-rename table from
the brand doc maps onto existing UI strings (Run -> Passage already done; Bag -> type case; Tiles ->
sorts; Shop -> foundry; etc.). **Copy is author-owned**; I draft, you approve. **No em dashes** in any
player-facing string (house rule, doubly apt for a typography game).

## 5. Open question (surfaces at SP1)

**Fonts.** The look hinges on type. Options: (a) I recommend specific free OFL faces and you download
the `woff2` files into `assets/fonts/` (like the dictionary); (b) I build SP1 on strong system-serif
+ heavy-weight stand-ins now and we drop the real faces in later; (c) you already have faces in mind.
Not blocking the SP1 design doc, but it shapes the look's ceiling. I will raise it concretely with face
recommendations when SP1 starts.

## 6. Sequencing + gates

Build SP1 -> SP2 -> SP3 -> SP4, each its own design -> plan -> SDD build -> browser smoke, with the
**author judging feel** at each (the part AI cannot judge). Logic stays frozen; `npm test` stays
green throughout (the reskin should not touch tested logic). After SP1 the game already "looks like
its own thing"; SP2 makes it *feel* good; SP3/SP4 complete the identity + the discovery hook.

## 7. Out of scope

Onboarding/tutorial, store-readiness, broad device testing (personal prototype). A music track
(deferred asset call). Any rules/balance change (that is the deferred playtest + tuning, separate).

## 8. Exit gate

It feels good to touch on a phone and is recognizably **its own thing**: the letterpress look reads
instantly, the pull makes a good play satisfying, sound lands tactile, and a finished run prints a
share-worthy broadside. Author judges feel.
