// src/sim.js — headless full-run simulator (Phase 0b eval harness v1+v2). Pure + DI.
// Exports (v1):
//   legalWords  — filter a word-list to what a letter-set can form
//   bestPlay    — pick the highest-scoring legal word from the live rack
//   simulateRun — drive one full run (newRun/playWord/discard/nextRound) with a greedy policy
// Exports (v2):
//   pickTargetOffer    — pure: pick the best advancing offer from run.shop, or null
//   buildPurchasePolicy — factory: returns a shop(run) fn that buys/rerolls toward targets
//   noShop             — v1 default (no-op policy)
// Exports (v2 discard policies):
//   smartDiscard   — heuristic: sort rack by tileValue descending, discard rarest floor(n/2).
//                    Keeps common/cheap half (vowels + common consonants), dumps rare clog.
//                    NOT optimal — a real player could do better — but more realistic than dump-all.
//   dumpAllDiscard — original behavior: discard the entire rack (kept for A/B comparison)
// Exports (v2 aggregation):
//   percentile — p-th percentile (0–100) of a numeric array (linear interpolation)
//   summarizePersona — aggregate simulateRun results → { n, winRate, roundReached, deadRackRate }
// Exports (v2 personas):
//   PERSONAS  — array of { id, name, bagId, targetRelicIds, targetHoneId }, one per archetype
//   runPersona — run simulateRun for each seed, aggregate → summarizePersona summary
// v1 limits (documented): wilds ('*') treated as non-letters in enumeration; greedy single-word
// policy; no shop purchases; standard deck. Personas/purchases/wild-substitution = v2.
// No Math.random — randomness is the seeded RNG inside `run`.
import { scoreWord } from './scoring.js';
import { honeModifiers } from './archetypes.js';
import { newRun, playWord, discard, nextRound } from './run.js';
import { generateShop, purchase } from './shop.js';
import { legalWords, selectionFor } from './enumerate.js';

export { legalWords };   // sim.js historically re-exported legalWords; keep that surface

// Reconstruct the scoring options playWord will use, so we can rank candidate words faithfully.
function scoringOpts(run) {
  return {
    tileValues: run.tileValues,
    lengthBonusPerLetter: run.config.LENGTH_BONUS_PER_LETTER,
    relics: [...run.relics, ...honeModifiers(run.honeLevels)],
    context: {
      wordsPlayedThisRound: run.wordsPlayedThisRound,
      enablers: run.relics.filter(r => r.enabler).map(r => r.enabler),
    },
  };
}

export function bestPlay(run, wordList) {
  const words = legalWords(run.rack.map(t => t.letter), wordList, run.config.MIN_WORD_LEN);
  const opts = scoringOpts(run);
  let best = null, bestScore = -Infinity;
  for (const w of words) {
    const selection = selectionFor(w, run.rack);
    if (!selection) continue;
    const score = scoreWord(selection, opts).score;
    if (score > bestScore) { bestScore = score; best = { word: w, selection, score }; }
  }
  return best;
}

// ── v2: pluggable purchase policy ────────────────────────────────────────────

// Pure: choose the best advancing offer from run.shop, or null.
// Priority: an affordable, un-owned target relic; then the target hone. Keeps coins >= reserve.
export function pickTargetOffer(run, { targetRelicIds = [], targetHoneId = null, reserve = 0 }) {
  const offers = (run.shop && run.shop.offers) || [];
  const owned = new Set(run.relics.map(r => r.id));
  const affordable = (o) => run.coins - o.cost >= reserve;
  const relic = offers.find(o => o.type === 'buyRelic' && targetRelicIds.includes(o.relicId) && !owned.has(o.relicId) && affordable(o));
  if (relic) return relic;
  const hone = offers.find(o => o.type === 'hone' && o.archetypeId === targetHoneId && affordable(o));
  if (hone) return hone;
  return null;
}

// Factory: returns a shop(run) function that drives generate→buy→reroll toward targets,
// bounded by maxRerolls + reserve, then clears run.shop. Mirrors UI regen-after-buy behaviour.
export function buildPurchasePolicy({ targetRelicIds = [], targetHoneId = null, reserve = 0, maxRerolls = 3, pool = {} } = {}) {
  const opts = { targetRelicIds, targetHoneId, reserve };
  return function shopPolicy(run) {
    run.shop = generateShop(run, run.rng, pool);
    let rerolls = 0;
    for (;;) {
      const offer = pickTargetOffer(run, opts);
      if (offer) { purchase(run, offer); run.shop = generateShop(run, run.rng, pool); continue; }
      const rc = run.shop.rerollCost;
      if (rerolls < maxRerolls && run.coins - rc >= reserve) {
        run.coins -= rc; rerolls += 1; run.shop = generateShop(run, run.rng, pool); continue;
      }
      break;
    }
    run.shop = null;
  };
}

// v1 default: no shopping.
export const noShop = () => {};

// ── v2: pluggable discard policies ───────────────────────────────────────────

// smartDiscard(run) → selection [{tile, letter}]
// Heuristic: sort the current rack by tileValues[letter] descending (rarest first),
// discard the rarest Math.max(1, floor(n/2)) tiles.  This keeps the common/cheap core
// (vowels + common consonants) and dumps the rare clog that blocks playable words.
// NOT optimal — a real player could do better — but far more realistic than dump-all.
// Deterministic: sort order is by tile value only (no Math.random).
export function smartDiscard(run) {
  const n = run.rack.length;
  const dropCount = Math.max(1, Math.floor(n / 2));
  const sorted = [...run.rack].sort((a, b) => (run.tileValues[b.letter] || 0) - (run.tileValues[a.letter] || 0));
  return sorted.slice(0, dropCount).map(t => ({ tile: t, letter: t.letter }));
}

// dumpAllDiscard(run) → selection [{tile, letter}]
// Original behavior: discard the entire rack. Kept for A/B comparison against smartDiscard.
export function dumpAllDiscard(run) {
  return run.rack.map(t => ({ tile: t, letter: t.letter }));
}

// Floor policy: pick a uniformly random legal word using run.rng (deterministic at the run level).
export function randomPlay(run, wordList) {
  const words = legalWords(run.rack.map(t => t.letter), wordList, run.config.MIN_WORD_LEN);
  const formable = words.map(w => ({ w, sel: selectionFor(w, run.rack) })).filter(x => x.sel);
  if (formable.length === 0) return null;
  const idx = Math.floor(run.rng() * formable.length);
  const { w, sel } = formable[idx];
  return { word: w, selection: sel, score: 0 };
}

// ── v1: greedy simulator ──────────────────────────────────────────────────────

// Drive one full run with the greedy "best word" policy. Deterministic given seed.
// v2: accepts an optional `policy` (default noShop) called on roundCleared before nextRound.
//     accepts an optional `discardPolicy` (default smartDiscard) called when no word is playable
//     and discards remain — smartDiscard keeps the playable core, dumps the rare clog.
//     Returns deadRacks + racksSeen: after each play/discard while still in a round,
//     samples whether the new hand has any playable word.
export function simulateRun({
  config, dictionary, words, seed, deck = null, cap = 1000,
  policy = noShop, discardPolicy = smartDiscard, agent = null,
}) {
  // Backward-compatible default agent: greedy play + the legacy discard/shop params.
  const A = agent || {
    choosePlay: (run, w) => bestPlay(run, w),
    chooseDiscard: (run) => discardPolicy(run),
    chooseShop: (run) => policy(run),
  };
  const run = newRun({ config, dictionary, seed, deck });
  let iter = 0;
  let deadRacks = 0, racksSeen = 0;
  while (run.status === 'playing' && iter < cap) {
    iter++;
    const play = A.choosePlay(run, words);
    if (play) {
      playWord(run, play.selection);
    } else if (run.discardsLeft > 0 && run.rack.length > 0) {
      discard(run, A.chooseDiscard(run));   // selective discard: keep the playable core, dump the rare clog
    } else {
      break;   // unactionable: no word and no discard (engine dead-hand usually sets 'lost' first)
    }
    // Dead-rack sampling: while still within a round (not yet cleared), check if
    // the refreshed hand has any play. Includes 'playing' and 'lost' (dead-hand).
    if (run.status !== 'roundCleared' && run.status !== 'won') {
      racksSeen += 1;
      if (!bestPlay(run, words)) deadRacks += 1;
    }
    if (run.status === 'roundCleared') { A.chooseShop(run); nextRound(run); }
  }
  // If we exited via break with the run still nominally 'playing', the hand is unactionable → loss.
  if (run.status === 'playing') run.status = 'lost';
  return {
    won: run.status === 'won',
    status: run.status,
    roundReached: run.roundIndex + 1,   // 1-based; equals ROUND_TARGETS.length on a win
    hitCap: iter >= cap,
    deadRacks,
    racksSeen,
  };
}

// ── v2: aggregation helpers ──────────────────────────────────────────────────

// Pure: compute the p-th percentile (0–100) of a numeric array.
// Sorts a copy (non-mutating). Uses linear interpolation between closest ranks.
// Empty array → 0.
export function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const index = (p / 100) * (n - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const frac = index - lower;
  return sorted[lower] * (1 - frac) + sorted[upper] * frac;
}

// ── v2: per-archetype persona descriptors ────────────────────────────────────

// PERSONAS mirrors the archetype fixture mapping in scripts/analyze-builds.js.
// Each entry: { id, name, bagId, targetRelicIds, targetHoneId }
// bagId 'standard' is resolved to config.STARTING_BAG in runPersona (DECKS.standard.startingBag is null).
export const PERSONAS = [
  { id: 'shortWord',   name: 'Short Word',   bagId: 'lean',     targetRelicIds: ['shortAndSweet', 'flywheel'],                        targetHoneId: 'shortWord'   },
  { id: 'longWord',    name: 'Long Word',    bagId: 'standard', targetRelicIds: ['lengthy', 'longHaul', 'juggernaut'],                targetHoneId: 'longWord'    },
  { id: 'rareLetter',  name: 'Rare Letter',  bagId: 'rareRich', targetRelicIds: ['rareHoarder', 'rareSurge', 'rareAvalanche'],        targetHoneId: 'rareLetter'  },
  { id: 'doubled',     name: 'Doubled',      bagId: 'doubled',  targetRelicIds: ['doubleTrouble', 'echoChamber', 'resonanceEngine'],  targetHoneId: 'doubled'     },
  { id: 'vowelHeavy',  name: 'Vowel Heavy',  bagId: 'standard', targetRelicIds: ['vowelBonus', 'freshStart', 'risingTide'],           targetHoneId: 'vowelHeavy'  },
  { id: 'escalation',  name: 'Escalation',   bagId: 'standard', targetRelicIds: ['comboCounter', 'momentum', 'perpetualEngine'],      targetHoneId: 'escalation'  },
];

// runPersona — for each seed, build the persona's deck + policy, simulateRun, then summarizePersona.
// deck: bagId === 'standard' (or config.DECKS[bagId].startingBag is null) → { startingBag: config.STARTING_BAG }
//       otherwise                                                          → config.DECKS[bagId]
// discardPolicy: optional discard function (default smartDiscard); pass dumpAllDiscard for BEFORE comparison.
// Returns the summarizePersona summary over all seeds.
export function runPersona({ config, dictionary, words, persona, seeds, pool = {}, reserve = 0, maxRerolls = 3, discardPolicy = smartDiscard }) {
  const { bagId, targetRelicIds, targetHoneId } = persona;
  // Resolve deck: 'standard' explicitly uses config.STARTING_BAG.
  // Any other bagId must be a real DECKS entry with a non-null startingBag; throw if missing.
  let deck;
  if (bagId === 'standard') {
    deck = { startingBag: config.STARTING_BAG };
  } else {
    const d = config.DECKS && config.DECKS[bagId];
    if (!d || d.startingBag == null) throw new Error(`runPersona: unknown or empty deck '${bagId}'`);
    deck = d;
  }

  const policy = buildPurchasePolicy({ targetRelicIds, targetHoneId, reserve, maxRerolls, pool });

  const results = seeds.map(seed =>
    simulateRun({ config, dictionary, words, seed, deck, policy, discardPolicy })
  );

  return summarizePersona(results);
}

// Pure: aggregate an array of simulateRun result objects into a summary.
// Returns { n, winRate, roundReached: {p10,p50,p90,mean}, deadRackRate }
export function summarizePersona(results) {
  const n = results.length;
  const wins = results.filter(r => r.won).length;
  const roundsReached = results.map(r => r.roundReached);
  const totalDeadRacks = results.reduce((sum, r) => sum + r.deadRacks, 0);
  const totalRacksSeen = results.reduce((sum, r) => sum + r.racksSeen, 0);

  return {
    n,
    winRate: wins / n,
    roundReached: {
      p10: percentile(roundsReached, 10),
      p50: percentile(roundsReached, 50),
      p90: percentile(roundsReached, 90),
      mean: roundsReached.reduce((a, b) => a + b, 0) / n,
    },
    deadRackRate: totalRacksSeen > 0 ? totalDeadRacks / totalRacksSeen : 0,
  };
}
