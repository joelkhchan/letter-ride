// src/enumerate.js — single source of word-enumeration. Pure + DI. No Math.random.
// Wild-unaware in Wave 0 (identical to the original sim.js logic); Wave 2 adds wild support.

export function countsOf(letters) {
  const c = {};
  for (const l of letters) c[l] = (c[l] || 0) + 1;
  return c;
}

export function canForm(word, counts) {
  const need = {};
  for (const ch of word) {
    need[ch] = (need[ch] || 0) + 1;
    if (need[ch] > (counts[ch] || 0)) return false;
  }
  return true;
}

export function legalWords(letters, wordList, minLen) {
  const c = countsOf(letters);
  const max = letters.length;
  return wordList.filter(w => w.length >= minLen && w.length <= max && canForm(w, c));
}

// Build a selection of REAL rack tiles for `word` (one tile per letter); null if rack can't supply it.
export function selectionFor(word, rack) {
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
