# Letter Ride 🎲🔤

A single-player **word-builder roguelike** for the phone — *Balatro, but with words.*

Build a **bag of letter tiles** — tiles are enchantable instances, not bare letters — draw a
rack each turn, tap tiles to spell the highest-scoring word you can, and beat a rising
**Points** target every round (`Points = Wit × Mult`). Between rounds, spend **Coins** in a shop
on letters, enchantments, upgrades, and **relics** that bend the scoring rules. Across runs you
earn **Meta** currency to unlock content, decks, difficulty stakes, and loadout boosts. The fun
isn't knowing big words — it's building a letter economy and a modifier engine that makes even
short words explode. Ships as an Android app via Capacitor.

*("Letter Ride" = "let 'er ride" — a gambler's push-your-luck call.)*

## Status

🟡 **Design complete (v2), not yet built.** No game code exists yet — the next step is executing
the implementation plan. The repo currently contains only design docs. The design spans four
playtest-gated tiers: spine → in-run roguelike → meta-progression → Android (Capacitor) build.

## Where things are

| File | What it is |
|---|---|
| `docs/2026-06-20-letter-ride-design.md` | The spec — what the game is and why each decision was made |
| `docs/2026-06-20-letter-ride-plan.md` | The implementation plan — build it task-by-task, Tier 0 first |
| `CLAUDE.md` | Instructions/guardrails for building with Claude (read before coding) |

## How to start building (in a fresh Claude Code session, from this folder)

1. Claude reads `CLAUDE.md`, then the spec, then the plan.
2. Execute the plan **one task at a time**, TDD-style (failing test → implement → pass → commit).
3. **Tier 0 first**, then stop at the 🛑 gate and playtest before building Tier 1.

Suggested opening prompt for the new session:
> "Read CLAUDE.md and docs/2026-06-20-letter-ride-plan.md, then implement Task 0 and Task 1."

## Running it (once Task 0+ are done)

```bash
npm test        # run the headless logic tests (node --test)
npm run serve   # serve the page; open the local URL on your phone (same Wi-Fi)
```

## The one rule that matters most

**Letters are always drawn from a bag you build — never an open alphabet.** That scarcity is
the whole game. (See `CLAUDE.md` for the rest.)
