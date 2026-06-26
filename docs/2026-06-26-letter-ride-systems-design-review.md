# Letter Ride — Systems Design Review: Relics, Bags, Stakes, Mods (2026-06-26)

**Design-structure review.** This is the companion to `docs/2026-06-26-letter-ride-playtest-rebalance.md`
(the empirical/balance pass). That doc answers *"are the numbers balanced and correct?"* and applied a
first tuning pass. This doc answers *"is the system design coherent, and where are the structural
gaps?"* — it proposes **design changes (new mechanics / content shape), not tuning numbers**. Where a
recommendation needs a magnitude, it is handed to the balance lane, not decided here. **No code was
changed; the author owns every call below.**

Grounded in: the spec (`2026-06-20-letter-ride-design.md`), the competitive research
(`2026-06-23-*`), a fresh catalog of the **merged** shipped content (`src/relics.js`, `tiles.js`,
`config.js`, `archetypes.js`), and the 2026-06-26 balance findings.

---

## 1. The layered philosophy — and whether it holds

The four systems are deliberately layered:

| Layer | System | Design role (per spec) |
|---|---|---|
| Substrate | **Bag** | The scarcity pillar. Letters always drawn from a `Tile[]`; composition *is* the deckbuilding. |
| Per-instance | **Tile-mods** | Why a *purchase* matters: a tile is letter + mod state. Local modifiers, fire only when their tile is played. |
| Engine | **Relics** | Build identity. Global modifiers that read the whole scoring context and define the archetype. |
| Difficulty | **Stakes** | A mastery/longevity ladder, paid in Meta bounties. Orthogonal to power. |
| Investment | **Hone** | The per-archetype "Planet-card" axis — spend $ to deterministically level your chosen build (×Mult kicker at L3+). |

Relics sit "on top" because they read everything and set build identity; bags + mods feed them
material; Hone is the deterministic scaling axis; stakes wrap the whole run.

**Verdict: the philosophy is sound and well-grounded. The *execution* has drifted in two ways:**
1. The layers are **wildly uneven in content** (relics are over-built; mods and bags are starved).
2. Two pillars are **not yet delivered**: *build diversity* (short-word, "the design's soul" per spec
   §12, is the most starved archetype) and *skill-beats-luck* (Doubled is luck-decided; the back-half
   bimodality is an acquisition-luck problem the magnitude pass can't fully close).

The good news: nothing here requires reopening the philosophy. These are gaps *within* a sound model.

---

## 2. Content-volume audit — the layers are lopsided

| System | Count | Archetype coverage |
|---|---|---|
| Relics | **26** | all 6 (uneven: see matrix) |
| Tile-mods | **5** | ~0 (4 of 5 are archetype-neutral) |
| Bags | 6 | **3 of 6** archetypes |
| Hone tracks | 6 | **6 of 6** (full parity) |
| Stakes | 3 | n/a (global difficulty) |

Per-archetype support (✓ = has dedicated content):

| Archetype | Relics | Mod | Bag | Hone | Snowball | Notes |
|---|---|---|---|---|---|---|
| Long-word | 4 | �— | ✗ | ✓ | juggernaut | over-supported; corpus also favors it |
| Rare-letter | 5 | ✗ | ✓✓ | ✓ | avalanche | well-covered (2 bags) |
| Doubled | 4 | ~resonator | ✓ | ✓ | resonance | **no skill lever** (see §3.1) |
| Vowel-heavy | 3 | ✗ | ✓ | ✓ | risingTide | freshStart is a weak fit |
| Escalation | 4 | ✗ | ✗ | ✓ | perpetual(universal) | identity diluted (`matches:()=>true`) |
| **Short-word** | **2** | ✗ | ✗ | ✓ | flywheel | **most starved — yet it's the spec's gate** |
| Chain | 2 | ✗ | ✗ | ✗ | ✗ | **orphan mechanic, no archetype identity** |

The **relic layer is over-built (26)**; the **mod layer (5, 4 of them archetype-blind) and bag layer
(half the archetypes uncovered) are under-built relative to it.** The pillar says mods are the
archetype *enablers* and the reason purchases matter — but today they barely express any archetype.

> Note: the 2026-06-23 research flagged "vowel/escalation have no ×Mult wincon." That gap has **since
> been closed** — snowball relics (`risingTide`, `perpetualEngine`) and the **Hone ×Mult kicker**
> (`honeXMult`, L3+) shipped. Every archetype now has a ×Mult path. So §4 is about *variance*, not a
> missing wincon.

---

## 3. Design gaps (structural — not numbers)

### 3.1 Doubled has no skill lever — the clearest "skill-beats-luck" violation
The balance data is unambiguous: Doubled's skill gradient is **flat** (lookahead − greedy = 0,
p=1.000). Its relics fire on a *board condition* (a doubled letter is present) that the player **cannot
manufacture** — so the outcome is decided by whether doubled-letter racks show up, not by play. This
directly violates the pillar "the player needs real levers to overcome a draw through skill."

**Design fix (a mechanic, not a number): give the player agency over the doubled condition.** Options:
- A **Resonator-style mod that *duplicates*** its letter (adds a copy to the rack or makes the tile
  count twice) — turning "wait for a double" into "engineer a double."
- A **"bank a tile" / replay mechanic** so a saved letter can be paired.
- Lean on `looseDoubles` (any repeat counts) **plus** a bag/mod that *stacks* one letter so repeats are
  reliably draftable.

The principle: Doubled's condition should be **draftable like the others'**, so skill (building toward
it) compounds. This is the single highest-value design fix — it converts a luck-decided archetype into
a skill-expressible one. (Magnitude → balance lane once the mechanic exists.)

### 3.2 Short-word is "the design's soul" and the most under-resourced
Spec §12 makes short-word the explicit Tier-1 gate: *a clever short word with the right stack must
reach ≥80% of the median long-word play and clear round 5* — and says if it can't, that's a **design
failure to surface, not paper over.** Reality: **2 relics, 0 mods, 0 bag.** The balance bot can't
express it at all (greedy never *chooses* a short word — a measurement artifact, so its true strength
is **unknown**), but structurally it is starved: nothing leans the bag short, no mod rewards short.

**Design fix:** resource it so the author can fairly playtest it — a **short-word bag** (fewer,
higher-value tiles that make ≤3-letter plays attractive), a **short-word mod**, and possibly a third
relic. Only then is "is short-word competitive?" an honest playtest question rather than a content gap.

### 3.3 The tile-mod layer is thin and archetype-blind
5 mods, and 4 (`polished`, `catalyst`, `anchor`, `reprint`) are archetype-neutral flat/positional/
retrigger effects. The pillar frames mods as **the archetype enablers** and the answer to "why does
buying a tile matter" — but they currently express almost no build identity, and the **5:1 relic:mod
ratio** means the per-instance layer is doing little of the deckbuilding work the spec assigns it.

**Design fix:** add **archetype-flavored mods** (e.g. a vowel mod, a rare mod, a long/short mod) so the
per-tile layer participates in build identity and purchases carry archetype intent. This also rebalances
the lopsided ratio without inflating the already-large relic pool.

### 3.4 Bags cover only half the archetypes — and the bag-modifier question
3 of 6 archetypes have a dedicated bag; **short-word, long-word, and escalation have none.** Two paths
(this resolves the parked "bag-modifier" question):
- **(a) Hand-author more bags** — one per uncovered archetype. Simple, but doesn't scale and bloats the
  bag list.
- **(b) Bag-modifiers** — a small base-bag set × *modifier twists* (vowel-rich, rare-rich, doubled-rich,
  lean, short-friendly…) applied as meta-unlocks. **Scales combinatorially** (the StS-ascension /
  Balatro deck×stake matrix), composes with the bounty grid (more cells), and lets every archetype get a
  lean without N hand-authored bags. **Recommendation: bag-modifiers** as the bag-coverage solution.

### 3.5 Chain is an orphan mechanic
`chainReaction` + `throughLine` exist and the engine tracks `chainLength`, but **chain is not a named
archetype** — no Hone track, no bag, no mod. A player can't *invest* in chain. **Decide:** either
**fold the two chain relics into Escalation** (chain *is* within-round escalation) or **promote chain to
a full 7th archetype** (give it a Hone track + a bag + a mod). Leaving it half-built is the worst option.
Recommendation: fold into Escalation unless you want a distinct "combo-chain" identity.

### 3.6 Escalation's identity is diluted
`escalation.matches = () => true` — every word counts, so it's the universal fallback rather than a
*committed* build. **Design fix:** give it a real condition (e.g. "2+ words this round," "each word
after the first") so committing to Escalation is a choice with an identity, not the default everything
piggybacks on.

### 3.7 Achievements: the discovery bucket can't pay; Artisan may be unreachable
`curator` (use every relic) and `enchanter` (apply every mod) require breadth a focused build never
attempts → the **discovery bucket's Meta is effectively unpayable**, skewing the real Meta faucet to
onboarding/mastery/progression. **Design fix:** make discovery achievements *earnable in normal play*
(e.g. "use 5 different relics across runs," cumulative) rather than "every relic in one run." Separately,
**Artisan (60k lifetime Score) may be unreachable** for a casual line — confirm the intent is long-haul
prestige, not a grind wall.

---

## 4. The big structural call: the back-half bimodality is an *acquisition* problem, not a *magnitude* one

The balance session is tuning snowball **magnitudes** (−⅓) and relieving the curve, but reports the
spun-vs-flat bimodality is **"not closed"** (winners still overshoot 444 vs a 260 target). The currency
harness explains *why*: per-round **coin earn is flat** won-vs-lost (losers don't lose for lack of
money), and the real engine gate is **relic acquisition** — winners end with only ~1.5 relics, and ~⅓ of
coins are burned *rerolling* to find them. So the deciding variable is **"did the shop hand you your
engine pieces early?"** — which is RNG, not skill. Cutting magnitudes shrinks the overshoot but doesn't
touch the *source* of the variance.

**Structural options (the part magnitudes can't fix):**
- **(a) Shift scaling weight from RNG-found snowball relics toward player-invested Hone.** Hone already
  has the ×Mult kicker (the deterministic Planet-card axis). If **Hone is the primary scaling lever and
  snowball relics are a bonus**, then a skilled player's *deterministic* investment drives the engine —
  compressing the "find-it-early" variance at its root. **This is the key structural recommendation,**
  and it pairs with (not replaces) the balance session's magnitude work.
- **(b) Make relic acquisition more reliable** (the balance doc's own deferred lever): cheaper rerolls /
  archetype-targeted offers / a "pick 1 of 3 relics" reward node. Less luck-gated engine assembly.
- **(c) Cap/decay snowball** (the genre's standard answer to runaway combos) — structurally bounds the
  overshoot rather than hoping magnitude cuts land.
- **(d) Position-lever** — adds skill depth but is orthogonal to this variance; see §5.

**Recommendation:** (a) Hone-as-primary-scaling **+** (b) more reliable acquisition are the structural
fixes; the magnitude cuts alone won't close the bimodality because the variance lives in *acquisition*,
not *magnitude*.

---

## 5. Position-as-skill-lever (the author-liked open question)

Status (from the research + spec): Balatro *is* positional (joker order changes the score); Letter
Ride's position-independent phase-order is a **sound simplification, not a bug**; decision D9 deferred
relic-ordering for v1; `Anchor`/`Fresh Start` give an in-*word* taste of "position matters." The research
frames it as an either/or: **positional depth** vs **"engine discipline as a feature"** (the clean,
legible phase-order is itself a white-space pitch) — *pick one and lean in.*

This is a **pillar-level formula + UI change**, orthogonal to the gaps above. **Recommendation:** keep
relic-ordering deferred until the archetype/variance gaps are addressed; if you want more skill depth
sooner, **expand the in-word positional mods** (first/last/Nth-letter effects, à la Anchor) — that adds
positional skill *without* the silent-wrong-order footgun or the formula rewrite.

---

## 6. Recommendations, prioritized

Tagged **[design]** (this lane: structure/new mechanics), **[balance]** (numbers → the tuning lane),
**[author]** (a pure judgment call).

| # | Recommendation | Tag | Priority |
|---|---|---|---|
| 1 | **Give Doubled a skill lever** (manufacture-the-double mechanic, §3.1) | [design] | **High** — fixes a pillar violation |
| 2 | **Resource short-word** (bag + mod + maybe a 3rd relic, §3.2) so the spec's gate can be fairly playtested | [design] | **High** |
| 3 | **Shift scaling toward Hone vs RNG snowball** (§4a) to compress the bimodality at its root | [design]+[balance] | **High** |
| 4 | **Build out tile-mods with archetype-flavored mods** (§3.3); rebalances the 5:1 ratio | [design] | Med |
| 5 | **Resolve chain** — fold into Escalation or promote to a full archetype (§3.5) | [author]→[design] | Med |
| 6 | **Give Escalation a real condition** (§3.6) | [design] | Med |
| 7 | **Bag coverage via bag-modifiers** (§3.4) — scalable, composes with bounties | [design] | Med |
| 8 | **Rework discovery achievements to be earnable; confirm Artisan intent** (§3.7) | [design]+[author] | Low-Med |
| 9 | **Position-lever: keep deferred; expand in-word positional mods if more depth wanted** (§5) | [author] | Low |
| — | (handoffs) leader over-tuning (44–46%), relic-acquisition reliability, all magnitudes | [balance] | per balance lane |

---

## 7. Resolution of the parked questions

- **Bag-modifiers:** **recommended** as the bag-coverage solution (§3.4) — the scalable answer to "we
  only have 6 bags," and it composes with the existing bounty grid.
- **Stakes-as-content:** **still no** — keep stakes a mastery ladder paid in Meta. The real "more
  content / more reasons to replay" answer is the design gaps above (Doubled lever, short-word kit,
  archetype mods, bag-modifiers), not gating content behind difficulty.

---

## 8. What this is *not*

This doc proposes **design structure**; it does not set magnitudes, and nothing here was implemented.
Recommended next step if you want to act on any item: pick the ones you like, and each becomes either a
focused brainstorm (e.g. the Doubled skill lever — a few concrete mechanic options to choose between) or
an implementation plan, with the balance lane tuning magnitudes after the mechanic exists. The author
judges fun; these are options, not decisions.
