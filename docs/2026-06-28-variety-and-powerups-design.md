# Letter Ride — Variety & Power-ups Design (2026-06-28)

Converged from the 2026-06-28 design chat. **Goal:** more variety + new power-ups, rooted in
Letter Ride's word/letter identity (inspired by Balatro's *philosophy* — scaling engines, several
viable builds, levers that beat bad luck, satisfying combos — NOT its poker mechanics).

**Guardrails (from CLAUDE.md):** formability (racks stay solvable — verify dead-rack% via
`analyze:corpus`); build diversity (several co-viable archetypes); skill-beats-luck (levers to
overcome a bad draw); **scarcity lives in the HAND** (the limited rack you draw), so the bag can be
rich. Author owns final magnitudes + judges feel; new relics need engraved icons.

## 1. Bigger, richer initial bag (foundational — do first)
- **~48-52 tiles** (≈2× the current ~26). Common letters (vowels, E/T/R/S/N) stay plentiful; add
  more mid-frequency letters + a few **spice (high-value) tiles**.
- **Spice:** extra K/V/W/Y + a 2nd J/Q/X/Z so rares surface a bit more — tuned so racks stay solvable.
- **Per-deck identity:** lean each starter deck into a distinct letter feel (Standard = balanced-
  richer; Rare Cache = rares/wilds; Echo = doubled letters; Lean = few high-value).
- Build: propose a concrete `config.js` composition, verify dead-rack% via `analyze:corpus`, author
  signs off the numbers. (New tile *types* — wild/gem — are vein C below, not the base bag.)

## 2. Multi-tile enchant ("imprint") — shop offer
- New shop offer: **"Enchant 2 tiles with [mod]"** — spread an existing tile-mod onto 2-3 chosen
  tiles. Reuses the mod system + the tile-picker (like Redaction). Cost ≈ 1.6× a single enchant;
  maybe a pricier 3-tile variant. Author decides tile count + whether the mod is fixed or chosen.

## 3. Existing power-ups vs genuine gaps (do NOT re-do what exists)
The relic/mod/upgrade set is already rich; most "veins" are largely covered:
- **Word shapes:** length (Lengthy / Long Haul / Juggernaut), doubled (Double Trouble / Echo Chamber
  / Resonance / Loose Doubles), rare (Rare Hoarder / Surge / Avalanche / Reprint), vowel (Vowel Bonus
  / Rising Tide / Fresh Start), short (Short & Sweet / Pithy / Flywheel), combo+chain (Combo Counter /
  Momentum / Chain Reaction / Through-Line). Well covered.
- **Letter manipulation:** Upgrade (value), Recast (change a letter), Enchant, Transfer mods, Thin.
- **Hand:** Wide Margins / Tight Leading (size), discard, reroll, Overtime (+play).

**Genuine gaps (non-duplicative, the only things worth adding):**
- The **bag's draw variety** itself — no power-up touches it (that's §1, the core want).
- **Multi-tile enchant** — the shop enchants only ONE tile today (that's §2, approved).
- *Optional small handful, only if wanted:* affix (`-ING`/`-ED`) + digraph (`QU`/`TH`) relics (the one
  shape-family missing); **peek / swap-one-tile** draw levers (discard+reroll exist, but not these);
  **letter mastery** (a letter that grows with play, vs one-time Upgrade); a **new-word novelty** bonus.

**Scope:** focus on the **bag** (the real variety fix) + the **tarot**. New power-ups are an OPTIONAL
small set filling the gaps above — we add a handful at most; we do NOT re-do the system.

## Build order
1. Bag rework (foundational, the core variety fix). 2. Multi-tile enchant offer (contained, reuses
mods). 3. (Optional, later) a few gap-filler power-ups. Each: TDD the logic, tune magnitudes (author
owns), playtest feel.
