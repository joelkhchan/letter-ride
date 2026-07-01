// src/sim-events.js — harness v4 Stage 3: model the between-round node choice (Shop XOR Event) for the
// full-run sims. The game offers a Shop OR one Event after each cleared encounter; the base sims always
// shopped. This adds a persona-aware node policy (chooseNode) + an EV resolver (resolveEventEV).
//
// Resolution philosophy (author-owned, per the 2026-07-01 harness decision):
//   - Deterministic-effect events (The Blank / Redaction / Wordsmith / Ink Merchant) apply their REAL
//     effect via events.js — no fudge.
//   - The push-your-luck (The Press) and Wordle (The Proof) events resolve by EXPECTED VALUE, NOT by a
//     bot playing them out. The Proof's solve-probability + guess-count are DOCUMENTED CONSTANTS below
//     (EVENT_EV) so they're one-line tunable; they are estimates, not a solver.
//
// Randomness: EV rolls use a dedicated seeded stream (never run.rng) so they can't desync bag/shop draws.
// The deterministic-effect events call into events.js, which uses run.rng — acceptable, since events-on
// is a distinct scenario from events-off (we are measuring its effect, not preserving baseline draws).
import { EVENTS, applyEventOption, pressStart, pressDraw, pressBank } from './events.js';
import { RELICS, ALL_RELIC_IDS } from './relics.js';
import { wordleCoins } from './wordle.js';
import { makeRng } from './rng.js';

// TUNE: the EV model's assumptions for the two "played" events. These are estimates the author owns.
export const EVENT_EV = {
  wordleSolveProb: 0.85,   // chance the EV model treats a common-word Wordle (The Proof) as solved
  wordleAvgGuesses: 4,     // guesses used on a solve → reward = wordleCoins(avgGuesses)
  pressDraws: 3,           // The Press: conservative "draw N then bank" stop rule
};

// A dedicated seeded stream for EV rolls (distinct constant; varies per round; never consumes run.rng).
const nodeRng = (run) => makeRng((run.seed ^ 0x51ed270b ^ (run.roundIndex || 0)) >>> 0);

// The n rarest (highest-value) non-wild bag tile ids — Redaction's "thin the clog" target.
function rarestTileIds(run, n) {
  return [...run.bag.tiles]
    .filter(t => t.letter !== '*')
    .sort((a, b) => (run.tileValues[b.letter] || 0) - (run.tileValues[a.letter] || 0))
    .slice(0, n)
    .map(t => t.id);
}

// Persona-aware node policy: given the offered event (run.nodeEventId, set by offerNode), decide whether
// to TAKE the event (true) or SHOP (false). Documented, simple, tunable — a "player who engages events".
export function chooseNode(run, persona = {}) {
  const id = run.nodeEventId;
  if (!id) return false;                                              // no event offered → shop
  const owned = new Set(run.relics.map(r => r.id));
  const wantsRelics = (persona.targetRelicIds || []).some(r => !owned.has(r)) || run.relics.length < 4;
  switch (id) {
    case 'wordsmith':   return !!persona.targetHoneId;                // a free Refine level = strong for hone builds
    case 'inkMerchant': return run.coins >= 5 && wantsRelics;         // a random relic for $5 (cheaper than the shop's $8)
    case 'theProof':    return true;                                  // free EV attempt (relic or speed-scaled $)
    case 'theBlank':    return true;                                  // free wild + thin (offer already gated by canOffer)
    case 'redaction':   return true;                                  // free bag-thin
    case 'thePress':    return persona.archetype === null;            // raw-$ gamble: only the coin engine (Economy) values it most
    default:            return false;
  }
}

// Resolve the offered event by expected value / real effect (see philosophy above). Mutates run.
export function resolveEventEV(run, persona = {}, cfg = EVENT_EV) {
  const id = run.nodeEventId;
  if (!EVENTS[id]) return;
  const rng = nodeRng(run);

  if (id === 'theProof') {
    // EV auto-resolve (no solver): solved w.p. cfg.wordleSolveProb. On solve, take a relic if the persona
    // still wants one (prefer an unowned target), else speed-scaled coins.
    if (rng() <= cfg.wordleSolveProb) {
      const owned = new Set(run.relics.map(r => r.id));
      const targets = (persona.targetRelicIds || []).filter(r => !owned.has(r) && RELICS[r]);
      const anyPool = ALL_RELIC_IDS.filter(r => !owned.has(r));
      if (targets.length) run.relics.push(RELICS[targets[Math.floor(rng() * targets.length)]]);
      else if (anyPool.length && (persona.targetRelicIds || []).length) run.relics.push(RELICS[anyPool[Math.floor(rng() * anyPool.length)]]);
      else run.coins += wordleCoins(cfg.wordleAvgGuesses, run.config.WORDLE);
    }
    return;
  }

  if (id === 'thePress') {
    // Conservative push-your-luck: draw cfg.pressDraws times then bank (busts zero the pot). Uses run.rng
    // via the real state machine — a simple honest play, not an EV closed form.
    pressStart(run);
    for (let i = 0; i < cfg.pressDraws; i++) pressDraw(run);
    pressBank(run);
    return;
  }

  if (id === 'wordsmith') { applyEventOption(run, id, 0, { archetypeId: persona.targetHoneId || persona.archetype }); return; }
  if (id === 'redaction') { applyEventOption(run, id, 0, { tileIds: rarestTileIds(run, 2) }); return; }
  applyEventOption(run, id, 0);   // theBlank / inkMerchant: single auto option, no opts needed
}
