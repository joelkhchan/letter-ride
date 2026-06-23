// src/sim.js — headless full-run simulator (Phase 0b eval harness v1). Pure + DI.
// Drives the live run.js Model B loop with a "greedy best word" policy.
// v1 limits (documented): wilds ('*') treated as non-letters in enumeration; greedy single-word
// policy; no shop purchases; standard deck. Personas/purchases/wild-substitution = v2.
// No Math.random — randomness is the seeded RNG inside `run`.
import { scoreWord } from './scoring.js';
import { honeModifiers } from './archetypes.js';

function countsOf(letters) { const c = {}; for (const l of letters) c[l] = (c[l] || 0) + 1; return c; }
function canForm(word, counts) {
  const need = {};
  for (const ch of word) { need[ch] = (need[ch] || 0) + 1; if (need[ch] > (counts[ch] || 0)) return false; }
  return true;
}

export function legalWords(letters, wordList, minLen) {
  const c = countsOf(letters);
  const max = letters.length;
  return wordList.filter(w => w.length >= minLen && w.length <= max && canForm(w, c));
}

// Build a selection of REAL rack tiles for `word` (one tile per letter); null if rack can't supply it.
function selectionFor(word, rack) {
  const pool = [...rack];
  const sel = [];
  for (const ch of word) {
    const i = pool.findIndex(t => t.letter === ch);
    if (i < 0) return null;
    sel.push({ tile: pool[i], letter: ch });
    pool.splice(i, 1);
  }
  return sel;
}

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
  let best = null, bestScore = -1;
  for (const w of words) {
    const selection = selectionFor(w, run.rack);
    if (!selection) continue;
    const score = scoreWord(selection, opts).score;
    if (score > bestScore) { bestScore = score; best = { word: w, selection, score }; }
  }
  return best;
}
