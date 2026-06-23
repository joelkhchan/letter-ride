// src/sim.js — headless full-run simulator (Phase 0b eval harness v1). Pure + DI.
// Exports:
//   legalWords  — filter a word-list to what a letter-set can form
//   bestPlay    — pick the highest-scoring legal word from the live rack
//   simulateRun — drive one full run (newRun/playWord/discard/nextRound) with a greedy policy
// v1 limits (documented): wilds ('*') treated as non-letters in enumeration; greedy single-word
// policy; no shop purchases; standard deck. Personas/purchases/wild-substitution = v2.
// No Math.random — randomness is the seeded RNG inside `run`.
import { scoreWord } from './scoring.js';
import { honeModifiers } from './archetypes.js';
import { newRun, playWord, discard, nextRound } from './run.js';

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
  let best = null, bestScore = -Infinity;
  for (const w of words) {
    const selection = selectionFor(w, run.rack);
    if (!selection) continue;
    const score = scoreWord(selection, opts).score;
    if (score > bestScore) { bestScore = score; best = { word: w, selection, score }; }
  }
  return best;
}

// Drive one full run with the greedy "best word" policy. Deterministic given seed.
export function simulateRun({ config, dictionary, words, seed, deck = null, cap = 1000 }) {
  const run = newRun({ config, dictionary, seed, deck });
  let iter = 0;
  while (run.status === 'playing' && iter < cap) {
    iter++;
    const play = bestPlay(run, words);
    if (play) {
      playWord(run, play.selection);
    } else if (run.discardsLeft > 0 && run.rack.length > 0) {
      discard(run, run.rack.map(t => ({ tile: t, letter: t.letter })));   // dump the hand, redraw
    } else {
      break;   // unactionable: no word and no discard (engine dead-hand usually sets 'lost' first)
    }
    if (run.status === 'roundCleared') nextRound(run);
  }
  // If we exited via break with the run still nominally 'playing', the hand is unactionable → loss.
  if (run.status === 'playing') run.status = 'lost';
  return {
    won: run.status === 'won',
    status: run.status,
    roundReached: run.roundIndex + 1,   // 1-based; equals ROUND_TARGETS.length on a win
    hitCap: iter >= cap,
  };
}
