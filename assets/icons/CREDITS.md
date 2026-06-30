# Icon attribution

Letter Ride's engraved relic seals use glyphs from **game-icons.net**, which is **CC BY 3.0 and
REQUIRES visible attribution** of each icon's author. This file is that attribution; it ships with
the app and is referenced from the in-game credits. Source SVGs were recolored (aged gold via CSS
mask) and reframed as seals; CC BY permits this with attribution.

Two relic marks are **original to Letter Ride** (no third-party attribution needed): Vowel Bonus
is a struck Zilla Slab "A", and Wildcard Rares (`relic-wildcardRares.svg`) is a hand-drawn star.
(The 2026-06-29 content relics + bosses were placeholder struck glyph-seals; on 2026-06-30 they were
replaced with curated engraved game-icons art, attributed in the tables below.)

## Relic glyphs — game-icons.net, CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/)

| File (`assets/icons/relics/`) | Original glyph | Author |
|---|---|---|
| `relic-rareHoarder.svg` | chest | Delapouite |
| `relic-rareSurge.svg` | cut-diamond | Lorc |
| `relic-rareAvalanche.svg` | gold-nuggets | Delapouite |
| `relic-rareReprint.svg` | post-stamp | Delapouite |
| `relic-lengthy.svg` | measure-tape | Delapouite |
| `relic-longHaul.svg` | caravan | Delapouite |
| `relic-longReach.svg` | grab | Lorc |
| `relic-juggernaut.svg` | charging-bull | Delapouite |
| `relic-doubleTrouble.svg` | gemini | Delapouite |
| `relic-echoChamber.svg` | sound-waves | Skoll |
| `relic-looseDoubles.svg` | linked-rings | Lorc |
| `relic-resonanceEngine.svg` | gong | Delapouite |
| `relic-comboCounter.svg` | histogram | Delapouite |
| `relic-momentum.svg` | sprint | Lorc |
| `relic-overtime.svg` | hourglass | Lorc |
| `relic-perpetualEngine.svg` | infinity | Various Artists (game-icons.net) |
| `relic-freshStart.svg` | sunrise | Delapouite |
| `relic-risingTide.svg` | big-wave | Lorc |
| `relic-shortAndSweet.svg` | hummingbird | Delapouite |
| `relic-flywheel.svg` | cog | Lorc |
| `relic-chainReaction.svg` | chain-lightning | Willdabeast |
| `relic-throughLine.svg` | knot | Delapouite |
| `relic-recycler.svg` | recycle | Lorc |
| `relic-pressLead.svg` | stamper | Delapouite |
| `relic-pithy.svg` | anvil | Delapouite |
| `relic-suffixPress.svg` | quill-ink | Lorc |
| `relic-ligature.svg` | bowen-knot | Delapouite |
| `relic-royaltyPress.svg` | jewel-crown | Delapouite |
| `relic-galleyProof.svg` | spectacles | Lorc |

All of the above are by their named authors, sourced from https://game-icons.net, licensed CC BY 3.0.

## Boss + Meta-currency glyphs — game-icons.net, CC BY 3.0

| File | Original glyph | Author |
|---|---|---|
| `bosses/boss-mute.svg` | silence | Lorc |
| `bosses/boss-toll.svg` | gate | Delapouite |
| `bosses/boss-vise.svg` | clamp | Delapouite |
| `bosses/boss-censor.svg` | cancel | Sbed |
| `bosses/boss-oneLiner.svg` | scroll-unfurled | Lorc |
| `ui/meta.svg` | medal | Lorc |
| `buckets/onboarding.svg` | sprout | Lorc |
| `buckets/progression.svg` | ladder | Delapouite |
| `buckets/mastery.svg` | laurel-crown | Lorc |
| `buckets/diversity.svg` | split-arrows | Delapouite |
| `buckets/discovery.svg` | compass | Lorc |
| `bags/swap-bag.svg` | swap-bag (New Run deck bags) | Lorc |

## General UI glyphs — Tabler Icons (MIT, https://github.com/tabler/tabler-icons/blob/main/LICENSE)

MIT does not require visible attribution; listed for provenance. Recolored via CSS mask (currentColor).

| File | Tabler glyph | Used for |
|---|---|---|
| `ui/coins.svg` | coins | in-run $ (HUD) |
| `ui/tools.svg` | tools | hones |
| `ui/player-play.svg` | player-play | Resume Run |
| `ui/plus.svg` | plus | New Run |
| `ui/building-store.svg` | building-store | Meta Shop |
| `ui/settings.svg` | settings | Settings |
| `ui/trophy.svg` | trophy | Achievements |
| `ui/trash.svg` | trash | Discard |
| `ui/arrows-shuffle.svg` | arrows-shuffle | Shuffle |
| `ui/refresh.svg` | refresh | Reroll |
| `ui/player-track-next.svg` | player-track-next | Continue |
| `ui/arrow-left.svg` | arrow-left | Back (pushed screens) |

`ui/wild-star.svg` is original to Letter Ride (the same hand-drawn star as Wildcard Rares), used for wild tiles. No third-party attribution needed.

> The wider exploration set (other elements, Tabler line candidates) lives in the uncommitted
> `candidates/` scratch folder used to build the comparison galleries; only the shipped relic
> glyphs above are committed and require attribution.

## Word lists (`assets/enable1.txt` + `assets/modern-words.txt`)

- **`enable1.txt`** — the **ENABLE** word list (Enhanced North American Benchmark LExicon), compiled
  by Alan Beale & M. Cooper. **Public domain** (no restriction; crediting requested). ~172.8k words,
  frozen ~2000. https://github.com/dolph/dictionary
- **`modern-words.txt`** — a 2026-06-30 supplement of ~13k modern/common words ENABLE lacks
  (email, selfie, emoji, blog, podcast, hashtag, bitcoin, vape, etc.). Derived from **SCOWL** (Spell
  Checker Oriented Word Lists) by Kevin Atkinson — a permissive list requiring only this copyright
  notice. http://wordlist.aspell.net/ . Generated as: `(SCOWL size-70 US, lowercase-only, length ≥ 3,
  must contain a vowel) − ENABLE − SCOWL's own abbreviation/contraction lists`, then a few real words
  SCOWL mis-tags as abbreviations were restored (email, app, admin, hazmat, nimby, vocab) and a few
  moderns it lacked were added (zen, wifi, wiki, vlog). No proper nouns or acronyms/abbreviations.
  SCOWL copyright: "Copyright 2000-2019 by Kevin Atkinson"; see the SCOWL readme for the full notice.
- **`wordle-answers.txt`** — ~4,400 common 5-letter words used as the hidden-word pool for "The Proof"
  (Wordle event). Derived 2026-06-30 as SCOWL size-50 (common) 5-letter lowercase words ∩ the game
  dictionary, so every target is both common and guessable. Same SCOWL attribution as above.
- **`two-letter-words.txt`** — the 107 NWL2023 (NASPA Word List) Scrabble-legal two-letter words, so
  that with `MIN_WORD_LEN: 2` every playable 2-letter word is valid. The word list itself is factual
  (not copyrightable); sourced 2026-06-30 from the published NWL2023 two-letter set. ENABLE already
  held 96 of them; this file is the authoritative full set (the merge dedupes).
