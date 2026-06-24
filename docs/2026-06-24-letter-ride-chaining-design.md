# Letter Ride — Word-Combos / Chaining (Phase 3, sub-project 3)

**Date:** 2026-06-24 · **Status:** design, pre-build. The reserved Phase 3 mechanic from the
[systems bible](2026-06-23-letter-ride-systems-bible.md) (D8: "word-combos / chaining DEFER to Phase 3,
reserve the hook"), chosen by the author 2026-06-24 as the next build. Builds on SP1 (retrigger) +
SP2 (transform/destroy). The new scoring *dimension* is consecutive-word relationships within a round.
Magnitudes/names are tunable starting points; **copy is author-owned** (letterpress voice reconciled
in Phase 4).

## 1. The core idea

A round already lets you play several words (Model B: persistent hand, consume-and-draw). **Chaining**
makes the *sequence* matter: link your words so each one continues the last, and a chain relic pays
off for the unbroken run. This is a new strategic dimension (you plan *which* word to play *when* so
your next word can continue the chain) and a new build path (the "chain build"), without disturbing
existing scoring.

**The canonical relation for v1: a letter-chain.** A word *continues the chain* when its **first
letter equals the previous word's last letter** (the classic word-chain). It is the most iconic and
skill-expressive relation: it forces real sequencing decisions and reads instantly. (Alternatives the
bible listed, shared-tile and length-ladder, are deferred; see §8.)

**Relic-gated, always-tracked.** The chain length is tracked every round for free (cheap run state),
but it only *affects score* if you own a chain relic. So chaining is an opt-in build, it does not
change existing balance, and the harness is unaffected unless the bot buys a chain relic.

## 2. The mechanic

Per round, track the current unbroken chain:
- **`run.chainLength`** — how many consecutive words (including the current one) form an unbroken
  letter-chain this round.
- **`run.lastWord`** — the minimal info the next word needs: `{ lastLetter }` of the previous word.

In `playWord`, **before scoring**, compute this word's chain length:
- first word of the round (`run.lastWord` is null) → `chainLength = 1`;
- else if this word's **first letter** equals `run.lastWord.lastLetter` → `chainLength = run.chainLength + 1` (continues);
- else → `chainLength = 1` (chain broke; this word restarts a chain of length 1).

The chain compares the **spelled letters** of the selection (`selection[0].letter` and the last
entry's `letter`). Wilds are **not spellable into words yet** (a deferred feature: `dictionary.findWord`
cannot place a wild, and the harness treats wilds as non-letters), so no special wild handling is
needed now; if wilds become spellable later, a wild played *as* a letter chains on that letter
naturally (the comparison already uses the played-as `letter`).

Pass `chainLength` into the scoring context. **After scoring**, set `run.lastWord = { lastLetter }`
(this word's last letter) and `run.chainLength = chainLength`. Reset both (`lastWord = null`,
`chainLength = 0`) at round start (`nextRound` + `newRun`).

The **chain bonus scales with links**, where links = `chainLength - 1` (the first word has no link, so
no bonus): a 3-word chain = 2 links. This makes maintaining a chain across a round an escalating combo
(the within-round analog of the snowball relics' across-run ratchet).

## 3. Engine integration (scoring.js untouched)

- **`run.js`** owns the chain state + the per-play computation (like `wordsPlayedThisRound` today),
  and adds `chainLength` to the `scoreWord` context: `context: { wordsPlayedThisRound, enablers,
  relicState, chainLength }`.
- **`scoring.js` is untouched** — it already spreads `...context` into `ctx`; chain relics read
  `ctx.chainLength`. The locked `Score = Points × Mult` phase order is unaffected (chain relics emit
  ordinary `+Points / +Mult / ×Mult` deltas).
- **No boss interaction** needed (a chain relic is an ordinary relic; cap/tax/disable apply as usual).

## 4. Content (lean: 2 relics, author-owned magnitudes)

| Working name | Effect (reads `ctx.chainLength`) | Role |
|---|---|---|
| **Chain Reaction** | `×Mult` grows with the chain: `×(1 + 0.5 × (chainLength - 1))` (3-word chain → ×2) | The chain `×Mult` wincon / build payoff |
| **Through-Line** | `+Points` per link: `+8 × (chainLength - 1)` | The additive supporting piece (early arc) |

Both register in `RELICS` / `ALL_RELIC_IDS` and flow into the shop automatically. A first word (no
link) gives a neutral `×1` / `+0`, so a chain relic is never a dead purchase but rewards commitment.
(Magnitudes are starting points; the author tunes + finalizes copy.)

## 5. Legibility (the player must see the chain)

The chain is invisible without UI, and an invisible mechanic is unplayable (the Phase 2 legibility
lesson). Add a small **chain indicator** near the rack/HUD that shows, when a chain is active
(`chainLength >= 1` and a chain relic is owned, or always when `chainLength > 1`):
- the current chain length (e.g. "Chain x3"), and
- the letter that continues it (e.g. "continue with E"), derived from `run.lastWord.lastLetter`.

Render-only (reads `run.chainLength` + `run.lastWord`); no rules in the UI. Exact placement/styling is
a build detail (mirror the boss-banner pattern).

## 6. Persistence (schema bump v5 -> v6)

`run.wordsPlayedThisRound` and `run.roundTotal` are **already serialized**, so mid-round state survives
a reload; chain state must persist too, or a mid-round reload would silently break an active chain
while combos survive. So serialize **`run.lastWord` + `run.chainLength`**, bump the schema **5 -> 6**,
and guard `!== 6` (old v5 saves drop gracefully, as designed). Add `?? null` / `?? 0` defaults on
deserialize.

## 7. Testing

`test/run.test.js` (extend): `playWord` sets `chainLength = 1` on the first word; continues
(`+1`) when the next word's first letter matches the previous last letter; resets to 1 on a break; `chainLength` resets to 0 at `nextRound`; `chainLength` is
present in the context passed to scoring (assert via a chain relic's effect end-to-end).
`test/relics.test.js`: Chain Reaction's `×Mult` and Through-Line's `+Points` scale with `chainLength`
(neutral at 1). `test/storage.test.js`: a mid-round `lastWord` + `chainLength` round-trip; v5 save
drops gracefully. Harness (`analyze:sim-v2`) re-run as a regression gate (chain tracking is harmless
to the bot; confirms no break).

## 8. Decisions

| # | Decision | Value |
|---|---|---|
| C1 | Chain relation (v1) | **Letter-chain**: this word's first letter == previous word's last letter |
| C2 | Gating | Relic-gated reward, always-tracked state (opt-in build; no balance disturbance) |
| C3 | Escalation | Bonus scales with links (`chainLength - 1`); within-round combo |
| C4 | Wild handling | None needed: chain compares spelled letters; wilds aren't spellable yet (future-proof: a played-as wild chains as its letter) |
| C5 | Engine | `run.js` tracks + passes `chainLength` in context; **scoring.js untouched** |
| C6 | Content | 2 relics: Chain Reaction (×Mult-scaling) + Through-Line (+Points); magnitudes author-owned |
| C7 | Legibility | A chain indicator (length + continue-letter) near the rack; render-only |
| C8 | Persistence | Persist `lastWord` + `chainLength`; **schema bump v5 -> v6** (graceful v5 drop) |

## 9. Out of scope (later)

Other chain relations (shared-tile, length-ladder); a chain-themed event; a chain enabler ("any shared
letter chains"); chain that persists across rounds. The Phase 4 reskin renames Chain Reaction /
Through-Line into letterpress voice.

## 10. Exit gate

A letter-chain is tracked across a round, the chain indicator shows its length + continue-letter, the
two chain relics measurably reward an unbroken chain (escalating with length), chain state survives a
save/load, tests prove the continue/break/wild/reset semantics, and the harness confirms no regression.
Author playtest then judges whether sequencing-for-the-chain is fun and tunes the magnitudes.
