// src/proof.js — pure logic for "The Proof", the word-deduction event. No DOM, no globals.
// All randomness for target selection flows through a caller-supplied seeded RNG.

// Score a guess against the target. Returns one status per position:
//   'hit'     right letter, right spot
//   'present' letter is in the word, wrong spot
//   'miss'    letter not in the word (or no unmatched instance remains)
// Duplicate letters are handled the standard way: each target letter can satisfy one tile.
export function scoreGuess(guess, target) {
  const g = String(guess).toLowerCase();
  const t = String(target).toLowerCase();
  const res = new Array(g.length).fill('miss');
  const counts = {};
  for (const c of t) counts[c] = (counts[c] || 0) + 1;
  // Pass 1: exact hits consume a count first (so duplicates resolve correctly).
  for (let i = 0; i < g.length; i++) {
    if (g[i] === t[i]) { res[i] = 'hit'; counts[g[i]]--; }
  }
  // Pass 2: present only if an unmatched instance of the letter remains.
  for (let i = 0; i < g.length; i++) {
    if (res[i] === 'hit') continue;
    if (counts[g[i]] > 0) { res[i] = 'present'; counts[g[i]]--; }
  }
  return res;
}

export function isSolved(statuses) {
  return statuses.length > 0 && statuses.every(s => s === 'hit');
}

// Coins offered for a solve, scaling with how FEW guesses were used. Player may take this $ OR a
// relic instead (the relic is flat; the $ rewards speed). Magnitudes from CONFIG.PROOF.
export function proofCoins(guessesUsed, cfg) {
  const max = cfg.maxGuesses;
  const saved = Math.max(0, max - guessesUsed);
  return cfg.coinsBase + cfg.coinsPerGuessSaved * saved;
}

// Pick a target word from the answer pool using a seeded RNG (deterministic per run/encounter).
export function pickTarget(answers, rng) {
  if (!answers || answers.length === 0) return null;
  return answers[Math.floor(rng() * answers.length)];
}
