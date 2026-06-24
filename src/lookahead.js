// src/lookahead.js — exact bounded round-search play policy. Pure + DI. No Math.random.
import { makeRng } from './rng.js';
import { selectionFor } from './enumerate.js';
import { legalWords } from './enumerate.js';
import { scoreFor } from './sim.js';
import { playWord } from './run.js';

// Lightweight mid-round clone. Shallow-copies what playWord/discard reassign or mutate; DEEP-copies
// relicState (snowball stacks mutate in place); clones rng with state preserved. Shares immutable
// mid-round refs (config, dictionary, targets, bag, the tile objects, bossOrder). Mid-round use ONLY.
export function cloneRun(run) {
  const rng = makeRng(run.seed);
  rng.setState(run.rng.getState());
  const relicState = {};
  for (const [k, v] of Object.entries(run.relicState || {})) relicState[k] = { ...v };
  return {
    ...run,                 // copies boss, bossOrder, config, dictionary, targets, status, etc.
    rng,
    rack: [...run.rack],
    drawPile: [...run.drawPile],
    relics: [...run.relics],
    honeLevels: { ...run.honeLevels },
    tileValues: { ...run.tileValues },
    relicState,
  };
}

// Top-`branch` candidate plays for the live rack, ranked by faithful (boss+relicState-aware) score.
// memo caches legalWords by rack-letter multiset across nodes (scores are NOT memoized — they
// depend on relicState/wordsPlayedThisRound which vary even for the same rack).
function candidatePlays(run, wordList, branch, memo) {
  const letters = run.rack.map(t => t.letter);
  const key = [...letters].sort().join('');
  let words = memo.get(key);
  if (!words) { words = legalWords(letters, wordList, run.config.MIN_WORD_LEN); memo.set(key, words); }
  const scored = [];
  for (const w of words) {
    const sel = selectionFor(w, run.rack);
    if (!sel) continue;
    scored.push({ word: w, selection: sel, score: scoreFor(run, sel).score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, branch);
}

// Value of a terminal leaf: prefer clearing; then higher round total; among cleared, prefer more
// leftover plays (cheaper clear). searchValue returns the best terminal leaf reachable.
function lineValue(run) {
  const cleared = run.status === 'roundCleared' || run.status === 'won';
  return { cleared, total: run.roundTotal, playsLeft: run.playsLeft };
}
function better(a, b) {
  if (a.cleared !== b.cleared) return a.cleared ? a : b;
  if (a.cleared) return a.playsLeft >= b.playsLeft ? a : b;
  return a.total >= b.total ? a : b;
}

function searchValue(run, wordList, depth, branch, memo) {
  if (run.status === 'roundCleared' || run.status === 'won') return lineValue(run);
  if (run.status === 'lost' || depth <= 0 || run.playsLeft <= 0) return lineValue(run);
  const cands = candidatePlays(run, wordList, branch, memo);
  if (cands.length === 0) return lineValue(run);
  let best = null;
  for (const c of cands) {
    const child = cloneRun(run);
    const sel = selectionFor(c.word, child.rack); // re-derive on the clone's tiles (same ids)
    if (!sel) continue;
    playWord(child, sel);
    const v = searchValue(child, wordList, depth - 1, branch, memo);
    best = best ? better(best, v) : v;
  }
  return best || lineValue(run);
}

// Return the first move of the best line. Drop-in for choosePlay.
export function lookaheadPlay(run, wordList, { k = 4, branch = 6 } = {}) {
  const memo = new Map();
  const depth = Math.min(k, run.playsLeft);
  const cands = candidatePlays(run, wordList, branch, memo);
  if (cands.length === 0) return null;
  if (depth <= 1) return cands[0]; // no lookahead budget => greedy
  let bestMove = null, bestVal = null;
  for (const c of cands) {
    const child = cloneRun(run);
    const sel = selectionFor(c.word, child.rack);
    if (!sel) continue;
    playWord(child, sel);
    const v = searchValue(child, wordList, depth - 1, branch, memo);
    if (!bestVal || better(v, bestVal) === v) { bestVal = v; bestMove = c; }
  }
  return bestMove || cands[0];
}
