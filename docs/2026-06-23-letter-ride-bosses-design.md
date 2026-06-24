# Letter Ride — Run Structure (Passages) + Bosses (Phase 2, sub-project 1)

**Date:** 2026-06-23 · **Status:** lean design, decisions locked with the author. Replaces the flat 8-round run with a tiered **Passage** structure (the Phase 2 "run texture" goal) and adds archetype-antagonist bosses on the warp-effect vocabulary from the systems bible (disable / cap / tax / lock). Magnitudes are tunable starting points; the author tunes the curve via play.

## 1. The run structure (locked naming)

A run is **4 Passages**. Each Passage is three ascending encounters:

| Encounter | Role | Target (provisional, tunable) |
|---|---|---|
| **Word** | base | base |
| **Phrase** | bigger | ~1.5× base |
| **Sentence** | **boss** | ~2.2× base + a boss warp |

So **4 Passages × 3 encounters = 12 encounters**, with a boss on each **Sentence** (4 bosses, one per Passage). The pun is intended: the boss "passes a **Sentence**" on you (its rule-warp). "Passage" is the group; "Word → Phrase → Sentence" is the ascending trio.

(Length is the one tunable structural knob: `CONFIG.PASSAGES = 4`. Dropping to 3 gives a 9-encounter run; the author was open to ~8-12.)

## 2. Run model (minimal engine churn)

Keep the existing internal **round index** (now 0..11) as the encounter counter; **derive** Passage + tier + boss-ness from it, and **display** the Passage names. No rename of `roundIndex`/`nextRound`/etc.

- `passageOf(i) = Math.floor(i / 3) + 1` (1..4)
- `tierOf(i) = ['Word','Phrase','Sentence'][i % 3]`
- `isBoss(i) = i % 3 === 2` (the Sentence encounter)
- `run.target` = the encounter's target (from a 12-entry tiered, escalating ladder; see §6).

`CONFIG.ROUND_TARGETS` becomes the 12-entry tiered ladder (still a flat array the engine indexes by round index — minimal change). Shop after **every** encounter (as today), so the engine gets 12 shop visits to scale.

## 3. Boss data model

New pure module `src/bosses.js` (DOM-free, like relics.js): a `BOSSES` map + `ALL_BOSS_IDS` + a pure `applyBossToScore(scored, boss)` helper.

```
{ id, name, desc, warp: { verb, ...params } }
```
`verb` ∈ `disable | cap | tax | lock` (the four locked bible verbs). `desc` is player-facing (concise, no emoji).

## 4. The four warp verbs and how each integrates (scoring.js stays LOCKED)

`scoreWord` already takes `tileValues` as an injected param and returns `{ points, mult, score }`. Warps integrate at the `playWord` / encounter-setup layer, never inside `scoring.js`:

| Verb | Example boss | Where | Mechanism (no scoring.js change) |
|---|---|---|---|
| **disable** | The Mute: vowels score 0 | scoring-time | `playWord` passes a **modified `tileValues`** to `scoreWord` (disabled letters zeroed). Pure DI. |
| **cap** | The Ceiling: ×Mult ≤ 4 | scoring-time | `playWord` clamps `scored.mult` after `scoreWord`, recomputes `score = points × cappedMult`. |
| **tax** | The Toll: −15 Points/word | scoring-time | `playWord`: `score = max(0, scored.score − tax)` after `scoreWord`. |
| **lock** | The Vise: no discards | setup | encounter entry sets `discardsLeft = 0` (or `playsLeft −= 1`) on a boss encounter. |

`applyBossToScore(scored, boss)` (pure) handles cap+tax; disable is a `tileValues` transform; lock is encounter-setup. **scoring.js is not modified.**

## 5. Starter boss roster (4, one per verb, each an archetype-antagonist)

Tunable magnitudes; concise, non-religious, emoji-free copy:

- **The Mute** (`disable`, vowels): "Vowels score 0." Hits vowel-heavy + everyone's base.
- **The Ceiling** (`cap`, mult 4): "Mult is capped at x4." Hits the ×Mult scaling engines (snowballs, Hone-×Mult, short-word).
- **The Toll** (`tax`, 15): "Each word scores 15 fewer Points." Hits short-word / many-small-words lines. (Renamed from The Tithe.)
- **The Vise** (`lock`, no-discard): "No discards this round." Hits drought-prone bags (lean/rareRich).

One boss per Passage's Sentence (4 Passages → these 4). Roster grows later.

## 6. Targets (provisional tiered ladder, tunable)

A 12-entry escalating, tiered `ROUND_TARGETS`. Starting shape (Word/Phrase/Sentence per Passage; Sentence ~2.2× the Word, base escalating ~2.5×/Passage). Provisional — the author tunes via play + the harness:

```
P1:  40   60   90      (Word Phrase Sentence)
P2:  120  175  260
P3:  340  480  700
P4:  950  1300 1800
```

The engine (snowballs + Hone-×Mult) is what lets a committed build ride this exponential shape; a skilled human rides steeper than the bot.

## 7. Boss selection (deterministic)

On entering a Sentence encounter, pick a boss from the roster using `run.rng` (seeded → reproducible), no repeat within a run (4 sentences, 4 bosses → each once, order shuffled by seed). Store `run.boss` (id) for the active encounter; clear it on non-Sentence encounters.

## 8. Legibility (binding rule)

The boss + its warp shows as a **banner at the start of the Sentence encounter, before any play**: name + desc (e.g. "The Ceiling — Mult is capped at x4"). No surprise warps. The Passage/tier label ("Passage 2 · Phrase") shows on every encounter.

## 9. Persistence

Serialize the active `run.boss` (and any per-encounter warp state); bump the save schema (4 → 5). Old saves drop gracefully (loader guard, as before).

## 10. Harness

`simulateRun` applies the active boss on Sentence encounters (same `applyBossToScore` + tileValues / setup hooks) and drives the 12-encounter structure, so the eval harness measures runs **with** the new structure + bosses. Add a report line (win-rate, where runs end by Passage). Reports only; does not tune.

## 11. Out of scope (later Phase 2 sub-projects)

Node variety (pick-a-node map) and events are separate sub-projects after bosses land + are playtested. This sub-project delivers the tiered Passage structure + bosses on the existing linear flow.

## Decisions (locked)

| # | Decision | Value |
|---|---|---|
| B1 | Structure | 4 Passages × (Word, Phrase, Sentence) = 12 encounters; `CONFIG.PASSAGES` tunable |
| B2 | Boss placement | every Sentence (3rd encounter of each Passage) → 4 bosses |
| B3 | Naming | Passage / Word / Phrase / Sentence (Sentence = boss, pun intended) |
| B4 | Verb integration | disable=tileValues DI; cap/tax=playWord post-process; lock=setup. scoring.js untouched |
| B5 | Roster | The Mute / The Ceiling / The Toll / The Vise (one per verb) |
| B6 | Selection | seeded, no repeat within a run |
| B7 | Legibility | boss banner at Sentence start, before play; Passage/tier label on every encounter |
| B8 | Persistence | `run.boss` serialized, schema 4→5 |
