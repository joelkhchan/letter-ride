# Letter Ride — Brand & Visual Identity

**Date:** 2026-06-24 · **Type:** Brand/identity reference (informative, not a spec change)
**Status:** Decided. Captures the theme, name, and visual direction agreed in the 2026-06-24
branding discussion. This is the durable record of the *identity*; it does not change game systems
and does not authorize implementation work. Reskin/execution is a future roadmap item.

**Revision (2026-06-25, during the Phase 4 reskin).** The *palette and type* in §5/§11 were
re-explored in a live theme gallery and revised. The locked look is now **deep navy (`#0d182e`)
+ antique gold (`#d9b25a`)** with warm-ivory type, set in **Zilla Slab** throughout: a darker
"evening" register rather than the warm-cream daytime palette first sketched below. The
*identity* is unchanged (letterpress / print-craft, word-first, luck as seasoning); only the
swatches and the display face moved (Rye and Fredoka were tried and dropped). Shipped source of
truth: `src/style.css` (its `:root` tokens are the whole palette). Locked "for now," pending
more playtesting.

> **Why this doc exists.** We started from a commercial-viability question, worked through what
> would differentiate Letter Ride in a saturated genre, and landed on a coherent brand. This is the
> reference so the decisions don't get re-litigated. Companion reading:
> `docs/2026-06-23-letter-ride-competitive-research.md` (the market/differentiation evidence) and
> `docs/2026-06-23-letter-ride-ux-design-assets-research.md` (the free/asset pipeline).

---

## 0. TL;DR — the decisions locked

1. **Title stays: Letter Ride.** Fun, easy to say, and the "let 'er ride" wink adds wit. It also
   dodges all three genre naming traps (no "Word", no `-like`, no `-atro`). A title need not be
   thematically literal (cf. Balatro); fun + memorable + distinctive beats descriptive.
2. **Theme: a word game with a luck streak.** Words and word-craft lead; luck is the seasoning, not
   the headline. This matches the design pillar "skill must beat luck."
3. **Visual identity: letterpress / print-craft.** The aesthetic *is* the craft of setting beautiful
   words. Warm, literate, tactile. This is not paint bolted on — it's already latent in the run
   structure (**Passage** built from **Word → Phrase → Sentence** tiers).
4. **Differentiate from Balatro via style, not a rival world.** Avoid Balatro's costume (standard
   playing cards, poker chips, felt, CRT/vaporwave shader). Do NOT add a literal setting (riverboat,
   carnival, train, library) — that's a redundant third layer on top of words + luck.
5. **Built with AI + free/OSS assets.** Letterpress is a tight, defined visual language, so it comes
   out cohesive almost by default from a type + texture + free-icon pipeline.

---

## 1. Commercial context — why the brand matters

From the competitive research: the word-roguelike-deckbuilder genre is saturated and
publisher-fatigued in 2026. The *mechanics* earn zero differentiation credit (all table stakes). The
field's most consistent weakness is **weak theme/personality** ("flat presentation", "lacks
personality" recur in competitor reviews). Therefore:

- **Theme/personality is the cheapest real differentiation available**, and it's unclaimed.
- A strong identity attacks the **discovery** gate (being seen/clicked), which is otherwise the
  hardest gate for a solo project with no marketing spend.
- A **shareable artifact** (the genre's missing Wordle-grid equivalent) is the one discovery lever
  that buys distribution for free. Letterpress gives us a beautiful, near-free one (see §8).

Caveat carried forward: **theme makes the game visible and clickable; it does not make it good.**
Retention and the commercial ceiling still live in feel, depth, and balance — judged by playtesting,
not branding.

---

## 2. Competitive naming/branding landscape

Competitor names cluster into three conventions, all to be avoided:

| Convention | Examples | Signal |
|---|---|---|
| Balatro portmanteau | Spellatro, Wordatro | "I'm a Balatro clone." |
| `-like` suffix | Letterlike, Wordlike | "Generic roguelike." ("lacks personality") |
| Literal "Word(s)" | Beyond Words, Word Play, OMG Words, Cursed Words, Words Can Kill | SEO-colliding; search engines conflate them. |

**"Letter Ride" sits outside all three** — a quiet branding win. Visually, the field is flat and
undifferentiated, so a distinctive style + voice is open lane.

---

## 3. Title — Letter Ride

**Kept.** Selection criteria that matter (the author's): fun, easy to say/think, witty wordplay.

- **Surface reading:** a playful name about letters.
- **The wink:** "let 'er ride" (the push-your-luck gambling call). Subtle enough to read as playful,
  not misleading — it rewards catching it without promising a gambling game.
- **Tone note:** the wink is gambling-flavored while the game is word-craft-first. This is a *mild*
  tension, accepted, because the pun is subtle and the surface reading is theme-neutral-playful.
- Considered and rejected: craft-evocative names (Inkling, Hot Metal, Impression, Foundry, Ligature)
  read classy but not fun; punny alternatives (Letter Perfect, Ps & Qs, Typecast, Letter Rip) were
  arguable upgrades but didn't beat the incumbent on the "makes you smile" test.

---

## 4. Theme — word game with a luck streak

Two essential layers, no third:

1. **Word/letter craft (the mechanic, the hero).** Tiles, spelling, composing.
2. **Luck streak (the wink, the seasoning).** The bag-draw genuinely is chance; "let 'er ride" names
   it. Reconciled with the "skill must beat luck" pillar via the **poker framing**: a game that looks
   like luck but rewards a sharp player. The fantasy of beating the odds *is* the pillar dramatized.

**Do not add a setting** (riverboat / carnival / train / library / courier). Each is a redundant
third layer and produces the "two themes shoved together" feeling. Letterpress already supplies a
"journey" (the Passage) and a "ride" (the press *run*) without importing a world.

---

## 5. Visual identity — letterpress / print-craft

**Fantasy:** you're a hand at the press, setting words in type and pulling beautiful prints. The luck
wink survives as a lucky worn sort, a hot print *run*, the gamble of setting a longer riskier line.

- **Palette:** warm print-shop. Ink black, cream paper, lead-type grey, plus a couple of spot inks
  (a deep red, an ochre or teal). **The streak renders as ink saturation** — a low streak is a faint
  proof; a high streak is rich, over-inked, almost embossed. (Doubles as legibility: stakes felt in
  color.)
- **Typography is the hero.** Big bold woodtype (poster faces) for the score and headers; a clean
  slab/serif for body. Free OFL faces do nearly all the work. The score set in giant woodtype is the
  spectacle.
- **Texture:** pressed-paper grain, slight ink bleed, a letterpress **deboss** (type pressed into
  the page), registration marks, printer's rules and fleurons as borders/dividers.
- **Tiles = sorts (pieces of movable type).** Each tile is a lead/wood type-sort with the letter on
  its face. **Mods are typographic** — bold, italic, foiled, spot-inked, ornamented — which renders
  cleanly on a phone without icon clutter (the "typographic enchantment" idea from the asset
  research). Encode each mod in redundant channels (glyph weight/style + frame + text label), per the
  accessibility rule.

---

## 6. Voice & tone

Dry, literate, a little sly — a typesetter's wit. Copy reads smart and warm, not loud.
**No em dashes in player-facing copy** (existing house style; thematically apt for a typography game).

---

## 7. Systems, renamed (onto existing systems — a reskin layer)

The renaming maps onto what's already built; it does not change rules.

| Built system | Print-craft fiction |
|---|---|
| Run | **Passage** *(already named)* |
| Word / Phrase / Sentence tiers | composing ever-larger units *(already named)* |
| Bag | the **type case** (drawer of sorts) |
| Rack | the sorts on your **composing stick** |
| Tiles | **sorts** |
| Tile mods | bold / italic / foil / spot-ink / ornamented |
| The word you submit | the **line you pull** |
| Points (base) | the impression value |
| Mult | the **run** (a print run, and your streak) |
| Score | the **impression** |
| $ (coins) | (print-shop framing TBD; keep simple — see §11) |
| Shop | the **type foundry / supplier** |
| Relics | press tools + shop charms (brass rule, lucky fleuron, the printer's devil) |
| Bosses | **smudge** (disables a tile), the **deadline** (cap), the **editor** (length lock), **pied type** (scramble), the **censor** (bans a tile type) |
| Meta currency | your **imprint / reputation** |
| Decks (starting bags) | different **type cases / faces** (Poetry, Headline, Ledger) |

Bosses read clearly *before* the player commits (the big lesson from the competitive research) because
they're native to the fiction, not invented rule-twists.

---

## 8. The "pull" — the payoff moment

On commit: the sorts lock into the chase; the platen comes down with a satisfying **CHUNK**; the
impression inks up on paper; +Mult ornaments lay their spot colors left to right; then the ×Mult
**run** multiplies — sheets fly off the press, ink saturates, the big woodtype number rolls up with a
deboss shimmer; the printed sheet lifts off on a hit-pause, stamped like a colophon. Warm, tactile
juice (press chunk, paper, ink) — distinct from Balatro's flashy chips. Renders the research's "make
the payoff explosive" note in a warm register. Tap-to-fast-forward.

---

## 9. The shareable artifact (discovery lever)

Each finished run prints as a **broadside / colophon**: the best line set in beautiful type, the
Passage completed, the score, and a printer's-mark rank (*Apprentice → Journeyman → Master Printer*).
Typographic posters are inherently share-worthy, and this one is near-free to render (just type +
texture). This is Letter Ride's Wordle-grid equivalent and feeds the discovery wedge. **Designed in,
not free** — it's a feature to build deliberately.

---

## 10. Rating-safe boundaries

The luck wink must not tip into a gambling-content rating (cf. Balatro's temporary 18+ in Europe).

- **Lean on:** print craft, words, the streak/run, a lucky charm or two, dry wit.
- **Avoid:** slot machines, roulette, casino floors, money symbols, stacks of cash, simulated
  real-money wagering, buying randomized items with real money (no loot boxes).
- The word-first framing already keeps the gambling read subtle; keep it that way.

---

## 11. Asset plan (AI + free/OSS pipeline)

- **Type (the hero, free):** woodtype + slab/serif OFL faces.
- **Texture:** paper/ink textures (free or procedural); CSS deboss via inner shadow.
- **Ornaments:** free fleuron/dingbat fonts + game-icons.net for charms/tools.
- **Tiles:** CSS-drawn type-sorts (no bespoke art).
- **SFX:** press chunk, paper, ink roller (self-made or Pixabay/freesound).
- **Music:** warm acoustic / quiet jazz (Pixabay).
- **AI:** minimal — a logo mark, maybe boss flourishes. Letterpress's tight visual language keeps the
  set cohesive without bespoke illustration (which is where AI/free pipelines struggle).

---

## 12. Open details (not yet decided)

- **Commit-button label.** Craft read: *PULL* or *PRESS*. Luck read: *LET 'ER RIDE*. Possible hybrid:
  "let 'er ride" only on a risky long line.
- **How loud the luck wink is.** A quiet fleuron here and there, vs. lucky charms as a visible relic
  category.
- **$ / coins framing.** Keep simple; a print-shop term only if it doesn't add clutter.

---

## 13. What this does NOT change

- **No rule changes.** Scoring formula (`Score = Points × Mult`), bag/scarcity, tile-instances,
  three-currency economy — all unchanged. This is a reskin/identity layer.
- **Roadmap order intact.** Reskin execution is a future item, built when the systems are playtested
  fun, not now. Do not start implementation off this doc without an explicit go-ahead.
