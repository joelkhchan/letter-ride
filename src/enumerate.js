// src/enumerate.js — single source of word-enumeration. Pure + DI. No Math.random.
// Wild-aware: a '*' tile substitutes for any one missing letter (greedy exact-match first).

export function countsOf(letters) {
  const c = {};
  for (const l of letters) c[l] = (c[l] || 0) + 1;
  return c;
}

export function canForm(word, counts) {
  const have = { ...counts };
  let wilds = have['*'] || 0;
  for (const ch of word) {
    if ((have[ch] || 0) > 0) have[ch] -= 1;
    else if (wilds > 0) wilds -= 1;
    else return false;
  }
  return true;
}

export function legalWords(letters, wordList, minLen) {
  const c = countsOf(letters);
  const max = letters.length;
  return wordList.filter(w => w.length >= minLen && w.length <= max && canForm(w, c));
}

// Build a selection of REAL rack tiles for `word` (one tile per letter); null if rack can't supply it.
// Wild tiles ('*') are resolved to the missing letter they substitute for.
export function selectionFor(word, rack) {
  const pool = [...rack];
  const sel = [];
  for (const ch of word) {
    let i = pool.findIndex(t => t.letter === ch);
    if (i < 0) i = pool.findIndex(t => t.letter === '*');   // fall back to a wild
    if (i < 0) return null;
    sel.push({ tile: pool[i], letter: ch });                 // chosen letter, even if tile is a wild
    pool.splice(i, 1);
  }
  return sel;
}
