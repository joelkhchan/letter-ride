# Letter Ride — UX, Design & Asset Research

**Date:** 2026-06-23 · **Type:** Research synthesis (informative — for future design/UX/art work).
**Companion docs:** the three `2026-06-23-letter-ride-{competitive-research,empirical-findings,research-appendix}.md`.

> **Scope.** UX & game design for word/letter roguelite/likes on **web + app** (adapted to the fact
> that Letter Ride plays *differently* — tap-to-build, no grid), plus **free, commercially-licensable
> assets** (art/fonts/music/SFX) since commercialization is being kept open. Mechanics/lessons only;
> all asset picks are vetted for commercial use with license + attribution flagged.
>
> **Stream status (dispatched 2026-06-23):**
> - ✅ **1. UX & interaction design** — complete (below).
> - ✅ **2. Visual art direction & game feel** — complete (below).
> - ✅ **3. Open-source visual assets (commercial-safe)** — complete (below).
> - ✅ **4. Open-source audio assets (commercial-safe)** — complete (below).
> **All four streams complete.**

---

## 1. UX & interaction design

Mapped to Letter Ride's specifics (tap-to-build, no grid, 9-tile rack, one-handed portrait, Capacitor +
vanilla JS). Evidence (HIG/Material/WCAG specs, field studies, primary reviews) vs design-extrapolation
flagged. "Transfer flags" note where a competitor pattern breaks against our constraints.

### Screen flow & IA
- **Copy Balatro's flat, linear, full-screen state stack — NOT Slay the Spire's spatial map** (we're
  no-grid/linear; a map is IA we don't need). A **fixed, visible run shape** (finite rounds + a
  shown rising-target schedule) makes "where am I" free.
- **Persistent three-zone layout:** sticky top status (round#, target, live Wit×Mult, Coins) · center
  info · bottom interaction. **Mode-switch via background tint** (boss-modifier round, shop), not modal
  pop-ups — keeps the snackable flow. *(One sticky div in vanilla JS.)*
- Beat the cohort's weak spots: surface **Meta gains explicitly on the game-over screen** ("earned X,
  unlocked Y") — Wordlike/Letterlike are dinged for opaque/weak meta.

### Onboarding (teach the roguelike layer, NOT spelling)
- Spelling is pre-loaded (more universal than Balatro's poker) → **spend the whole onboarding budget on
  the bag economy / mods / relics / the formula**, which is exactly where the genre gets dinged.
- **Teach causality by animating it** (each modifier fires with its contribution visible) — "players
  intuitively understand synergies without tooltips." **Progressive disclosure via the Meta unlock
  path** (first run shows few simple mods). **Guarantee a playable opening rack for early runs only**
  (e.g. ≥2 vowels) — kills the cheapest unfair loss; consistent with "no *permanent* vowel floor."

### Tap-to-build ergonomics (numbers transfer directly as CSS px/dp)
- Touch targets: **Material 48×48dp min, ≥8dp gaps**; Apple 44pt; WCAG floor 24px (floor, not comfort).
  If 9 tiles force narrow visuals, **keep the full hit area via padding** (visual < hit area).
- **Thumb zone:** ~75% thumb-driven, ~49% one-handed → rack + staging + Submit/Backspace/Clear in the
  **bottom ~60%**; read-only info up top (inverse of grid-Scrabble apps).
- **Tap-into-ordered-staging-row, tap-staged-tile-to-remove** is the validated low-risk pattern (drag
  only if playtesting demands). **Undo over confirmation** — Backspace/Clear instant + reversible
  (tiles return to rack); only **Submit** is the deliberate commit (debounce it).
- Web specifics: `pointerdown/up` + `touch-action: manipulation` to kill the 300ms delay + synthetic
  double-fire. **Anti-pattern:** Scrabble GO's sparkle/clutter overload — keep staging/scoring quiet.

### Score-reveal & feedback
- **THE #1 documented genre complaint to pre-solve: scoring animations get too slow, and they COMPOUND
  with more triggers** — exactly our stacked-modifier endgame. **v1 requirements: (1) tap-to-skip to
  final total, (2) an animation-speed setting / auto-speed-up so reveal time does NOT scale linearly
  with relic count.** Use a CountUp-style rolling counter (trivial vanilla JS).
- The juice stack (element pulse → rolling digits → shake → particles → rising pitch) IS the value
  proposition, but **favor per-element pulse + rolling running-total over maximal FX on a small WebView
  screen**; center the reveal (thumb-adjacent), not in occludable corners.

### Shop & meta-shop
- **Fixed, named slots** (not a reflowing random grid): e.g. 2 relic / 2 tile-service / 1 buy-tile /
  reroll / thin-sell. **Escalating-but-CHEAP reroll, reset each shop, price on the button**
  (config-tunable) — too-expensive reroll is a documented failure that violates skill-beats-luck.
- **Enchant-target flow (our core unsolved interaction):** buy the *service* → open a **bag-overview
  modal** → tap one tile → confirm. **Two-step tap, NO drag.** Affordability greying + persistent Coin
  header + sell=floor(buy/2) badge. Gate **thinning as premium** (scarcer/pricier than adding).
- Meta-shop: reuse in-run interactions; spend on a *specific named* unlock with clear locked/unlocked
  state. Borrow consistency + targeted-purchase only — **NOT** bundle/urgency/loyalty mechanics.

### Modifier/relic legibility
- **"Show, don't document" — animate which modifier fired**, in **PHASE ORDER** (additive phase, then a
  visually distinct ×Mult phase) since our engine is position-independent — the animation should teach
  *our* formula. **StS-style keyword glossary** (~10 keywords: Wit, Mult, ×Mult, Enchant, Thin, mod
  names — one canonical inspectable definition each). **Color + icon double-coding** (color=rarity,
  glyph=role: "+" add-Wit, "×" mult). **Ship NO hidden mod behavior.** Plan **relic-row overflow** now
  (icon row → scrollable "+N" inspect list).

### Web vs native-app delivery (Capacitor + PWA, vanilla JS)
- **One codebase → PWA + APK** (Capacitor supports both). Playtest the instantly-updating browser build;
  cut APKs less often. **DOM rendering is fine — no Phaser/canvas/WebGL needed** (turn-based, no render
  loop; the perf lever is *touch responsiveness*, not framerate).
- `viewport-fit=cover` + `env(safe-area-inset-*)` (wrapped in `max()`); **`100svh`** to avoid the 100vh
  bug; portrait lock via `AndroidManifest` (declarative, honors no-build-step) + web-manifest
  `orientation`. **Autosave `{version, state, seed}` to localStorage on `visibilitychange:hidden`**,
  auto-resume on launch. Fully offline = no network error states (preserve as a correctness property).

### Readability / states / accessibility
- **Contrast:** tile letters are load-bearing text — large, bold, ≥4.5:1 against the fill; mod-color
  fills are decoration. Tiles ≥48px (one-handed 9-tile rack = the rage-tap zone).
- **Empty/error states explain why + give the next step:** can't-make-a-word → surface the
  discard/reroll lever (the skill-vs-luck affordance), not a dead end; invalid word → inline shake +
  "Not in dictionary," never a modal.
- **THE accessibility landmine: never encode info by color alone — our tile mods ARE color-coded** (the
  exact failure this rule targets). Give every mod a **redundant non-color cue** (corner glyph ★/+,
  frame style, text tag); blue/orange is the safest two-hue base. Settings: reduce-motion
  (`prefers-reduced-motion` + override), **animation-speed**, sound/music/haptics, colorblind, text
  size, **run-seed entry** (cheap skill feature), restart/abandon. **Skip screen-reader support** for a
  personal prototype — invest the effort in color-independence + target size + reduce-motion instead.

### Recommendations (prioritized)
**P0 — decide/build before more content:**
1. **[Designer/Engineer] Resolve tap-to-build vs tap-to-inspect, and inspect vs buy** — the biggest
   touch-specific risk. Long-press inspect (`pointerdown` + ~500ms + `navigator.vibrate`) or a toggled
   inspect-mode; inspect reversible, never a commit; same discipline in the shop (first tap inspects,
   Buy commits). *(No hover on touch, and tap already builds the word — you can't overload tap.)*
2. **[Engineer] Ship tap-to-skip + animation-speed control with the first scoring animation** (the
   best-documented genre complaint; compounds with stacked mods).
3. **[Engineer] Viewport + safe-area + portrait-lock + autosave-on-hidden + auto-resume.**
4. **[Designer] Never color-alone for tile mods** — redundant glyph/shape/text from day one (hard to
   retrofit).

**P1 — core legibility & flow:** animated phase-ordered scoring reveal (teaches the formula) · persistent
three-zone layout · fixed named shop slots + affordability greying + cheap escalating reroll +
two-step-tap enchant picker + premium thinning · StS keyword glossary + terse mod text with live number.

**P2 — onboarding & polish:** teach the roguelike layer not spelling (Meta-gated complexity; guaranteed
opening rack early only) · explicit Meta payoff on game-over · relic-overflow scroll list · settings ·
keep scoring area visually quiet (avoid the Scrabble GO clutter trap).

**Does NOT transfer:** StS spatial map (we're linear); Balatro hover tooltips (→ long-press); HTML5
drag-to-target for enchanting (unreliable in mobile WebViews → two-step tap); Phaser/canvas perf
guidance (DOM, turn-based); Snap monetization; heavy shake/particles (small screen → pulse + counter);
`beforeinstallprompt` (Chromium-only; APK is primary).

## 2. Visual art direction & game feel

All recommendations are vanilla-JS/CSS/HTML5-feasible (no framework, no build step). Evidence vs
designer-opinion flagged; specific timing/intensity numbers are playtest starting points, not certified.

### The renderer is the deciding constraint
**Letter Ride is turn-based with no render loop → DOM/CSS is the right renderer, NOT canvas/WebGL/Phaser.**
DOM divs get GPU acceleration "for free"; for a mostly-static UI (9-tile rack + shop + relic row) keeping
it in the DOM can *improve* perf. Canvas is "shockingly slow on underpowered mobile CPUs" and needs
per-frame redraw. → Bias toward styles that render as styled divs/text. (Use one `<canvas>` *only* for
the particle burst — see perf below.)

### Art style
- **Recommended:** flat/vector base + **neo-skeuomorphic tiles** (flat face + CSS bevel + lift-on-tap
  shadow = affordance without clutter, the documented UX sweet spot) + **restrained** neon/board-game
  accents (glow only on score/mult pops + relic activations, never body text). **Cohesion beats
  fidelity** (Vampire Survivors lesson). **Avoid authentic CRT pixel-art** — it "wants" canvas/shaders
  and fights the stack; *evoke* retro with a pixel/display font + chunky borders instead.
- **One-handed read:** rack + play action in the **bottom-center third**, read-only target + relics up
  top (Hoober: ~49% one-handed, ~75% thumb-driven; bottom-center is the comfortable zone).

### Juice / game feel — the keystone is the sequential scoring tally
For a `Points × Mult` game, **the sequential left-to-right scoring tally is THE feel moment** — it turns
an instant multiply into an escalating event. Spend the most juice budget there; scale intensity to
event size (a word ≠ a boss clear). Per-technique, all transform/opacity:
- **Screenshake:** rAF decaying random `translate3d` on a wrapper (decay = impact; a looping keyframe
  reads as "UI vibrating"). **Tile bounce:** CSS scale keyframe, `transform-origin: bottom center`,
  squash-stretch at 25–50% amplitude. **Number roll:** rAF + `easeOutQuad` (decelerate into final);
  odometer only for the grand total. **Particle burst:** ONE overlay `<canvas>`, 50–100 particles
  (>200 drops frames on mobile), pooled, gravity+alpha, DPR-scaled. **Anticipation hold:** 150–300ms
  before payoff (never delay input ack, only the reveal). **Hit-pause:** 40–90ms freeze + 1-frame flash
  right before the ×Mult. **Audio-pitch escalation:** Web Audio `playbackRate = 2**(semitones/12)` rising
  per tally step (cap it); `ctx.resume()` on first tap (mobile autoplay gate).
- Gate shake/particles behind `prefers-reduced-motion` + allow a **second-tap fast-forward** (ties to
  the §1 P0 animation-speed requirement). *Reveal order can be dramatic/sequential even though our math
  is position-independent — and is the prerequisite for "position as skill" being learnable if pursued.*

### Color
- **60-30-10** role-based palette (also an accessibility construction method). **Dual-axis encoding,
  colorblind-safe:** Wit = blue `#0072B2`, Mult = orange `#E69F00` (Okabe-Ito; safer than Balatro's
  blue/red, keeps cool-base/warm-multiplier intuition). **WCAG 1.4.1 (Level A): never color alone** —
  always pair each number with its **operator glyph (`+`/`×`) + fixed position + chips-then-mult
  animation order** so the axis reads in grayscale. Avoid red/green for meaning (~6% deuteranopia).
- **Contrast:** AA 4.5:1 normal / 3:1 large; for constantly-read scoring numbers render as large text
  and aim **AAA-large 4.5:1** for outdoor-glare headroom; verify every color-on-real-background pair.

### Typography
- **Tile glyph legibility is critical** (single letters, no word context to disambiguate). Pick a face
  where b/d/p/q, I/l/1, O/0 genuinely differ. **Atkinson Hyperlegible** is purpose-built for this and
  free (OFL) → recommended for tile glyphs; **Inter** for UI/numbers (screen-optimized, tabular figures
  so digits don't shift layout). Uppercase tiles dodge b/d/p/q but worsen I/l/1 + O/0.
- **OpenDyslexic: do NOT default to it** — the strongest controlled study found it *didn't help and
  worsened* reading; the British Dyslexia Association recommends mainstream sans-serifs. Offer it as an
  optional toggle (players *prefer* it) but rely on generic legibility (x-height, open apertures,
  spacing, disambiguated letterforms).
- **On-tile layout:** big centered hero glyph; point value small in a consistent corner (tabular
  figures); ≤3 mod badges as high-contrast chips + a "+N" overflow chip.

### Visual hierarchy & transitions
- **Three reads:** ≤3 type sizes; hierarchy from scale + value/saturation contrast (not hue) +
  proximity/whitespace + position. Validate with the **blur/squint test**. First reads — rack: target
  vs current Wit×Mult; shop: items + Coins; meta: currency + headline unlock.
- **Transitions ≤300ms** (Material vocabulary: container-transform for item→detail, shared-axis for the
  round→shop→round journey, fade-through for unrelated). **The round→shop loop repeats dozens of times/
  run — keep it ≤300ms and skippable.** Response must *begin within 100ms* of a tap (causality). Plain
  CSS transition/keyframes as baseline; **View Transitions API behind an `if (!document.startViewTransition)`
  guard** (needs Chromium 111+; degrades to instant swap on older WebViews). Honor `prefers-reduced-motion`.

### Performance (mobile web / Capacitor)
- **Animate ONLY `transform` + `opacity`** (compositor-only, GPU, off main thread) — never
  top/left/width/height/margin. **Cache all tile geometry up front; write-only during the scoring
  sequence** (no `getBoundingClientRect()` mid-loop = no layout thrash). **`will-change` toggled
  just-in-time** around the sequence, removed after — never permanent on many tiles (texture-memory
  blowout on mid-range Android; high Mult = many simultaneous nodes). **Use CSS/WAAPI (not rAF) for
  tile/number/shake** so they survive a busy main thread while scoring computes; **rAF only for the
  canvas particle sim**. Budget ~10ms/frame. **Profile the real WebView via `chrome://inspect`**, not
  desktop Chrome (Capacitor "should not expect parity with desktop Chrome").

### Recommendations (condensed)
- **[Art]** flat/vector + neo-skeuomorphic tiles + restrained neon; Wit-blue/Mult-orange (Okabe-Ito) +
  `+`/`×` glyphs + position + animation order; never color-alone; Atkinson Hyperlegible tiles + Inter UI.
- **[UX]** thumb-zone bottom third; three reads + blur test; transitions ≤300ms & skippable; the
  sequential scoring tally is the keystone feel moment.
- **[Engineer, vanilla JS]** transform/opacity only; cache geometry then write-only; one pooled
  `<canvas>` for particles (not DOM nodes); just-in-time `will-change`; CSS/WAAPI for tile/number/shake,
  rAF for particles; View Transitions behind a capability guard; profile on-device.
- **Realistic on mid-range Android:** the DOM/CSS transform+opacity approach is well within budget; the
  only disciplined spots are the high-Mult particle burst (single pooled canvas) and `will-change` hygiene.

**Evidence flags:** strong = thumb-zone study, WCAG specs, NN/g timing limits, OpenDyslexic-harm study,
the rendering pipeline. Weak/heuristic = DOM-vs-canvas perf (dev experience, not benchmarked), the
"23%"/"80-20" figures (no traceable source), exact Balatro hex values (second-hand; the blue/red
*mapping* is solid, the hexes aren't).

## 3. Open-source visual assets (commercial-safe)

Every license verified against the source's own license/FAQ/LICENSE page (2026-06-23). Tags:
**[safe-CC0]** (no attribution) · **[safe-attribution-required]** · **[verify]** (read the page in a
browser first — automated fetch blocked).

### Recommended starter kit (all commercial-safe, minimal attribution burden)
| Need | Pick | License | Attribution | Tag |
|---|---|---|---|---|
| **UI kit** (buttons/panels/cards) | **Kenney UI Pack** | CC0 1.0 | none | [safe-CC0] |
| **Tile/letter display font** | **Fredoka** (rounded, chunky) — or **Luckiest Guy** for punch | OFL 1.1 / Apache 2.0 | ship license file in a credits screen; no in-game credit | [safe] |
| **UI font** | **Inter** (or **Nunito** to match Fredoka) | OFL 1.1 | ship license file | [safe] |
| **UI icons** (shop/currency/nav) | **Tabler** (largest MIT set) or **Lucide** | MIT / ISC | keep LICENSE in source | [safe-CC0-equivalent] |
| **Relic/mod/thematic icons** | **Game-icons.net** (~4,000 game icons — best fit for the "skill expression" layer) | **CC-BY 3.0** | **required** — per-artist credit in a credits screen | [safe-attribution-required] |
| **Backgrounds** | **hand-authored CSS gradients / SVG patterns** (primary) + Kenney as fallback | none / CC0 | none | [safe-CC0] |
| **Particles / score juice** | **Kenney Particle Pack** (~80 VFX sprites) | CC0 1.0 | none | [safe-CC0] |

**The one attribution worth taking:** Game-icons.net (CC-BY 3.0) is the single best source for
relic/mod icons — the cost is one credits screen listing the artists whose icons you ship (track them
as you go). Everything else is CC0/OFL/MIT with zero in-game attribution. **Net compliance footprint:**
one "Licenses" screen with (a) OFL/Apache font texts, (b) MIT/ISC icon notices, (c) per-artist
Game-icons attribution. Self-authored CSS/SVG backgrounds + Kenney particles add nothing.

### Source tables (condensed)
- **Sprites/UI/particles/fonts — Kenney.nl** = CC0, the backbone. [safe-CC0]
- **Icons:** Tabler (MIT, ~5,800), Lucide (ISC, ~1,500), Heroicons/Feather (MIT) — all [safe-CC0-equivalent], retain notice. **Game-icons.net** (CC-BY 3.0, attribution required). **SVGRepo** = mixed per-icon [verify].
- **Fonts:** Google Fonts (mostly OFL 1.1, some Apache 2.0 — commercial + app-embed OK, ship `OFL.txt`), The League of Moveable Type (all OFL). Verified picks: Luckiest Guy (Apache), Fredoka/Bungee/Inter/Nunito (OFL), **Titan One (OFL — Reserved Font Name "Titan": rename if you modify glyphs)**. OFL rules: commercial YES, bundle in app YES (ship license + notice), can't sell the font alone, can't reuse a Reserved Font Name on a modified version.
- **OpenGameArt / itch.io / CraftPix** = **MIXED per-asset/per-pack [verify]** — "no license shown" ≠ free; prefer the CC0 filters; CraftPix bars reselling source files.
- **Backgrounds:** hand-author CSS/SVG (you own it) is the best fit for a no-framework game. SVGBackgrounds.com (**free tier requires attribution** [verify]), Haikei [verify], Unsplash/Pexels photos [safe] but rarely fit a vector word game.

### Pitfalls / DO-NOT-USE
1. **CC-BY-NC — hard NO** (monetized game = commercial). 2. **CC-BY-ND — trap** (recolor/resize/sprite-sheet = derivatives, disallowed). 3. **"Free for personal use" fonts — NOT commercial-safe** (use OFL/Apache instead). 4. **GPL on code-bound assets — viral copyleft** (can force your codebase to GPL). 5. **CC-BY-SA — share-alike clashes with a closed game.** 6. **Google Image "free to use" is NOT a license.** 7. **AI-generated assets — copyright gray area** (document provenance, get sign-off).

### Vetting checklist (per asset, each release) — keep a `CREDITS.md` / licenses screen
Identify exact license + version · find authoritative text on the source's own page (no text → don't
use) · confirm commercial allowed (reject NC / "personal use") · capture attribution wording + where
it must appear · reject ND if modifying, avoid SA/GPL for proprietary · no real-world trademarks/
mascots · document AI provenance · screenshot the license page (name/URL/date) + keep the LICENSE file
· one provenance row per asset (source, license, commercial, attribution, modified, date, proof).

**Verify-in-browser-before-ship** (automated fetch blocked): SVGBackgrounds free-tier attribution
wording, Haikei export-license tier, SVGRepo per-icon licensing — only relevant if chosen over the
safe picks above.

**Key sources:** [Kenney](https://kenney.nl/support) · [Game-icons about/license](https://game-icons.net/about.html) · [Tabler LICENSE](https://github.com/tabler/tabler-icons/blob/main/LICENSE) · [Google Fonts FAQ](https://developers.google.com/fonts/faq) · [SIL OFL FAQ](https://openfontlicense.org) · [OpenGameArt FAQ](https://opengameart.org/content/faq) · [CraftPix licenses](https://craftpix.net/file-licenses/) · [CC licenses](https://creativecommons.org/licenses/)

## 4. Open-source audio assets (commercial-safe)

**Bottom line:** for a game that *may* commercialize, the safest path is (1) **procedurally generate**
all UI/tile/score blips with **jfxr / ChipTone / jsfxr** (CC0, you own the output, tiny files, fits
the vanilla-JS retro feel, zero attribution), and (2) source music loops from **Pixabay Music** (or
**Kenney**/**Sonniss**) — commercial OK, no attribution. Use **CC-BY** sources (Incompetech, CC-BY
Freesound) only if you'll maintain an accurate credits screen. **Avoid** subscription libraries
(Epidemic/Artlist), YouTube Audio Library standard tracks, and **Mixkit *music* in a game**.

### Music sources
| Source | License | Commercial? | Attribution? | Tag |
|---|---|---|---|---|
| **Pixabay Music** | Pixabay Content License | ✅ | ❌ (don't repackage raw files) | [safe-CC0]* |
| **Kevin MacLeod / Incompetech** | CC-BY 4.0 | ✅ (incl. monetized) | ✅ required (exact wording below) | [safe-attribution-required] |
| **Kenney / Sonniss GDC bundles** | CC0 / Sonniss GDC | ✅ | ❌ | [safe-CC0] / [no-attribution] |
| OpenGameArt / Free Music Archive / ccMixter | per-asset CC | ⚠️ only CC0/BY/BY-SA | per-asset | [verify] each file |
| **Mixkit MUSIC** | Mixkit Free | ⚠️ license text bars **video-game** use | — | **[verify]/likely-NO for games** |

\* Pixabay is its *own* license (not literally CC0): commercial OK, no attribution, **but** no
redistributing a track "standalone," and embedded third-party samples may carry extra rights.

**Exact attribution wording (if used):**
- Incompetech: `"Title" by Kevin MacLeod (incompetech.com) — Licensed under Creative Commons: By Attribution 4.0` (a paid Standard License removes the requirement).
- Freesound CC-BY: `"sound" by username (freesound.org/<link>) — licensed under CC-BY 4.0`.

### SFX sources
| Source | License | Commercial? | Attribution? | Tag |
|---|---|---|---|---|
| **jfxr / ChipTone / jsfxr** (procedural) | you own output / CC0 | ✅ | ❌ | [safe-CC0] |
| **Bfxr** (procedural) | app Apache-2.0; output yours | ✅ | ❌ | [safe-CC0]* |
| **Kenney audio** | CC0 | ✅ | ❌ | [safe-CC0] |
| **Sonniss #GameAudioGDC** | Sonniss GDC | ✅ (unlimited, lifetime) | ❌ | [no-attribution] |
| **Freesound — CC0** | CC0 | ✅ | ❌ | [safe-CC0] |
| **Freesound — CC-BY** | CC-BY 4.0 | ✅ | ✅ required | [safe-attribution-required] |
| **Freesound — CC-BY-NC / Sampling+** | NC | ❌ | — | **DO NOT USE** |
| **Mixkit SFX** | Mixkit Free | ✅ (incl. games) | ❌ | [no-attribution] |
| **Zapsplat free / Gold** | Standard | ✅ | ✅ free tier (credit "ZapSplat") / ❌ paid | [attribution-required] / [paid] |

\* Bfxr output is safe by sfxr-family precedent but not stated as cleanly as jfxr/ChipTone — soft [verify].
**Freesound tip:** filter to "Approved for Free Cultural Works" → narrows to CC0 + CC-BY only (excludes NC).

### License pitfalls (DO-NOT-USE traps)
1. **"Royalty-free" ≠ free ≠ commercial-safe** — only means "no per-use royalty" (Epidemic/Artlist are royalty-free *and* paid).
2. **CC-BY-NC is not commercial-safe** — ads/IAP count as commercial. #1 Freesound/FMA trap.
3. **CC-BY-SA / GPL audio** — share-alike/copyleft is dangerous for a closed commercial game; stick to CC0/CC-BY.
4. **Subscription libraries (Epidemic/Artlist)** — clearance ends when you stop paying; unusable for a perpetually-distributed game. [subscription-only]
5. **YouTube Audio Library "standard" tracks are YouTube-only** — only its CC-BY tracks may leave YouTube (with attribution). Avoid the library for a game.
6. **Pixabay is its own license, not CC0** — no standalone redistribution; watch embedded third-party content.
7. **Mixkit music ≠ Mixkit SFX** — Mixkit's license bars *music* in video games; SFX are fine.
8. **Sample-pack "no redistribution as samples"** (Sonniss etc.) — ship sounds *inside* the game, never as a downloadable raw pack; Sonniss also bars AI/ML training on the sounds.
9. **Zapsplat free tier requires crediting "ZapSplat"** — breach if forgotten (paid Gold removes it).
10. **Per-file licenses** on OGA/FMA — verify and record the license for *every* file, not the site.
11. **Embedded third-party rights survive any wrapper license** — a recognizable sample/vocal/brand sound can still infringe.

### Vetting checklist (non-lawyer, pre-ship) — keep an `audio-licenses.csv` in the repo
Record source URL + author + exact license+version + download date · confirm commercial use *explicitly*
permitted (reject NC) · reject copyleft for a closed game · avoid subscription/platform-locked licenses ·
capture exact attribution wording → credits screen + store listing · check for embedded third-party
content · don't redistribute raw assets · save a dated copy of the license text · prefer
CC0/PD/self-generated · flag anything unsure as **VERIFY BEFORE COMMERCIAL USE** and don't ship it.

### Recommended starter set for Letter Ride
**SFX — generate procedurally (all [safe-CC0], via jfxr/ChipTone; you own the output):** tile tap/select
(short high blip <80ms) · tile place/commit (softer click) · word submit (upward chirp) · scoring tick
(one blip, pitch-shifted per tick via Web Audio `playbackRate`) · big-score/combo (layered arpeggio) ·
**×Mult rising-pitch escalation = one base blip looped with ascending `playbackRate` in code** (cheapest
way; no extra files) · coin/purchase (classic coin) · invalid-word (low descending buzz) · button click ·
win/lose stings (ascending/descending jingles). *Fallback: Kenney "Interface/UI Audio" packs (CC0).*

**Music — Pixabay Music (no attribution):** calm menu/ambient loop · low-distraction in-round bed · light
shop loop · short victory sting (or self-generate). *Attribution-OK alternative: Incompetech calm/relaxed
loops under CC-BY (budget a credits screen).*

**Posture:** all SFX self-generated or Kenney CC0 (zero attribution/risk); all music Pixabay (no
attribution) by default; maintain `audio-licenses.csv` from day one. **Never** touch: Freesound NC/Sampling+,
CC-BY-SA/GPL audio, Epidemic/Artlist, YouTube Audio Library standard tracks, or Mixkit *music* in-game.

**Key sources:** [Freesound FAQ](https://freesound.org/help/faq/) · [Pixabay license](https://pixabay.com/service/license-summary/) · [Incompetech FAQ](https://incompetech.com/music/royalty-free/faq.html) · [Kenney](https://kenney.nl/support) · [Sonniss GDC license](https://sonniss.com/gdc-bundle-license/) · [Mixkit license](https://mixkit.co/license/) · [OpenGameArt FAQ](https://opengameart.org/content/faq) · [ChipTone](https://sfbgames.itch.io/chiptone) · [jfxr](https://github.com/ttencate/jfxr) · [jsfxr](https://sfxr.me/) · [Zapsplat license](https://www.zapsplat.com/license-type/standard-license/)
