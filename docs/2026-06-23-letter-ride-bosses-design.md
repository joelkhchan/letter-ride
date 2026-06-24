# Letter Ride — Boss Rounds (Phase 2, sub-project 1)

**Date:** 2026-06-23 · **Status:** lean design for the first Phase 2 sub-project: archetype-antagonist boss rounds, built on the systems-bible warp-effect vocabulary (disable / cap / tax / lock). Bosses are the headline "substantial" want.

**Design goal:** periodic boss rounds whose rule-warp attacks the player's committed build, forcing a pivot or a counter. The warp is **legible before the player commits** (shown at round start). Magnitudes are tunable starting points.

## 1. Boss data model

A boss is data (no logic in the boss object beyond a pure predicate-free descriptor):

```
{ id, name, desc, warp: { verb, ...params } }
```

- `verb` is one of the four locked bible verbs: `disable | cap | tax | lock`.
- `desc` is player-facing (concise, no emoji), shown before the round.

Lives in a new `src/bosses.js` (pure, DOM-free, like relics.js): a `BOSSES` map + `ALL_BOSS_IDS` + a pure `applyBossToScore(scored, boss)` helper for the scoring-time verbs.

## 2. The four warp verbs and how each integrates (scoring.js stays LOCKED)

`scoreWord` already takes `tileValues` as an injected param and returns `{ points, mult, score }`. So warps integrate at the `playWord`/round-setup layer, never inside `scoring.js`:

| Verb | Example | Where it applies | Mechanism (no scoring.js change) |
|---|---|---|---|
| **disable** | "vowels score 0" | scoring-time | `playWord` passes a **modified `tileValues`** to `scoreWord` (the disabled letters zeroed). Pure DI. |
| **cap** | "×Mult capped at ×4" | scoring-time | `playWord` clamps `scored.mult` after `scoreWord`, recomputes `score = points × cappedMult`. |
| **tax** | "-15 Points per word" | scoring-time | `playWord` applies `score = max(0, scored.score - tax)` after `scoreWord`. |
| **lock** | "no discards this round" / "-1 play" | round-setup | `nextRound`/round-entry sets `discardsLeft = 0` or `playsLeft -= 1` on a boss round. |

`applyBossToScore(scored, boss)` (pure) handles cap+tax and returns the adjusted score; disable is a `tileValues` transform; lock is a round-setup tweak. **scoring.js is not modified.**

## 3. Which rounds are bosses

**🔷 DECISION (recommended): rounds 4 and 8** of the 8-round run (a mid-run boss + a final boss). Keeps most rounds as the baseline so bosses feel like spikes, not the norm. Configurable via `CONFIG.BOSS_ROUNDS = [4, 8]` (1-based) so it is a one-line tune later. (Balatro's small/big/boss rhythm is the inspiration; we keep it light for v1.)

## 4. Boss selection (deterministic)

On entering a boss round, pick a boss from `BOSSES` using `run.rng` (seeded → reproducible). The chosen boss id is stored on the run (`run.boss`) and cleared on a non-boss round. Avoid repeating the same boss within a run if more than one is available.

## 5. Starter roster (4 bosses, one per verb, each an archetype-antagonist)

Tunable magnitudes; concise descs:

- **The Mute** (`disable`, vowels): "Vowels score 0 this round." Antagonizes vowel-heavy + hurts everyone's base.
- **The Ceiling** (`cap`, mult 4): "Mult is capped at x4 this round." Antagonizes the xMult scaling engines (snowballs, Hone-xMult, short-word).
- **The Tithe** (`tax`, 15): "Each word scores 15 fewer Points." Antagonizes short-word / many-small-words lines.
- **The Vise** (`lock`, no-discard): "No discards this round." Antagonizes drought-prone bags (lean/rareRich) by removing the escape lever.

(Roster grows later; four is enough to prove the system + cover the four verbs.)

## 6. Legibility (a binding design rule)

The boss + its warp is shown at the **start of a boss round, before any play** (a banner in the run view): name + desc. The player sees "The Ceiling: Mult capped at x4" before committing tiles. No surprise warps.

## 7. Persistence

`run.boss` (the active boss id, or null) is serialized; bump the save schema 3 → 4 (old saves drop gracefully, as before).

## 8. Harness

`simulateRun` applies the active boss on boss rounds (same `applyBossToScore` + tileValues/round-setup hooks) so the eval harness measures runs **with** bosses. Add a small report line (win-rate on bossed runs vs not) so the author can see the bosses' bite. The harness REPORTS; it does not tune.

## 9. Out of scope (later Phase 2 sub-projects)

Node variety (pick-a-node map) and events are **separate** sub-projects after bosses land + are playtested. This sub-project bolts boss rounds onto the existing linear round flow (minimal, high-value first increment).

## Decisions (one-pass)

| # | Decision | Recommendation |
|---|---|---|
| B1 | Boss rounds | 4 and 8 (config `BOSS_ROUNDS`) |
| B2 | Verb integration | disable=tileValues DI; cap/tax=playWord post-process; lock=round-setup. scoring.js untouched |
| B3 | Selection | seeded pick from roster, no repeat within a run |
| B4 | Starter roster | The Mute / The Ceiling / The Tithe / The Vise (one per verb) |
| B5 | Legibility | boss banner shown at boss-round start, before play |
| B6 | Persistence | `run.boss` serialized, schema 3->4 |
