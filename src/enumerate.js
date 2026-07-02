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

// Map A-Z / a-z to 0..25; anything else (incl. the wild '*') → -1.
function codeOf(ch) {
  const x = ch.charCodeAt(0);
  if (x >= 65 && x <= 90) return x - 65;
  if (x >= 97 && x <= 122) return x - 97;
  return -1;
}

// Per-word-list precomputed index, cached on the list object (WeakMap). Built ONCE per distinct list:
// each word becomes its length + a compact [code,count,code,count,…] of its DISTINCT letters. This turns
// legalWords into an allocation-free scan (no per-word object spread → no GC churn), the eval hot path.
const indexCache = new WeakMap();
function wordIndex(wordList) {
  let idx = indexCache.get(wordList);
  if (idx) return idx;
  const n = wordList.length;
  const lengths = new Uint8Array(n);
  const needs = new Array(n);
  const tmp = new Uint8Array(26);
  for (let i = 0; i < n; i++) {
    const w = wordList[i];
    lengths[i] = w.length;
    let distinct = 0;
    for (let j = 0; j < w.length; j++) {
      const code = codeOf(w[j]);
      if (code < 0) continue;
      if (tmp[code] === 0) distinct++;
      tmp[code]++;
    }
    const pairs = new Uint8Array(distinct * 2);
    let p = 0;
    for (let c = 0; c < 26; c++) if (tmp[c]) { pairs[p++] = c; pairs[p++] = tmp[c]; tmp[c] = 0; }
    needs[i] = pairs;
  }
  idx = { lengths, needs, words: wordList };
  indexCache.set(wordList, idx);
  return idx;
}

export function legalWords(letters, wordList, minLen) {
  const { lengths, needs, words } = wordIndex(wordList);
  const rack = new Uint8Array(26);       // one allocation per call (not per word)
  let wilds = 0;
  const max = letters.length;
  for (const l of letters) {
    if (l === '*') { wilds++; continue; }
    const code = codeOf(l);
    if (code >= 0) rack[code]++;
  }
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const len = lengths[i];
    if (len < minLen || len > max) continue;
    const pairs = needs[i];
    let deficit = 0, ok = true;
    for (let k = 0; k < pairs.length; k += 2) {
      const short = pairs[k + 1] - rack[pairs[k]];
      if (short > 0) { deficit += short; if (deficit > wilds) { ok = false; break; } }
    }
    if (ok) out.push(words[i]);
  }
  return out;
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
