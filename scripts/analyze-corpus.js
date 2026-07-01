// scripts/analyze-corpus.js — ENABLE corpus + starting-bag analysis. Read-only, no assertions.
// Run: npm run analyze:corpus   (uses the real ENABLE list + CONFIG; prints findings tables)
//
// Answers concrete design/tuning questions that desk research can't:
//   1. Word-length distribution (informs LENGTH_BONUS_PER_LETTER + whether a soft cap matters)
//   2. Letter frequency vs TILE_VALUES (flags mispriced letters)
//   3. First/last-letter frequency (informs Anchor / Fresh Start / start-or-end relics)
//   4. Pattern coverage (sizes the pattern-relic design space: common-but-reliable vs rare-but-special)
//   5. Dead-rack rate + vowel-count distribution from the REAL STARTING_BAG (tests the vowel-floor idea)
//   6. Best no-relic score per 9-rack vs the target curve (Tier-0 sanity)
//   7. Degenerate high-value short words (len 3–4) that could spike short-word builds
// Deterministic: rack sampling uses the seeded RNG in src/rng.js (no Math.random).
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { makeRng, shuffle } from '../src/rng.js';
import { buildMysteryBag } from '../src/bag.js';

const RAW = readFileSync(new URL('../assets/enable1.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const tv = CONFIG.TILE_VALUES;
const MINLEN = CONFIG.MIN_WORD_LEN, RACK = CONFIG.RACK_SIZE, LB = CONFIG.LENGTH_BONUS_PER_LETTER;
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const ALL = RAW.map(w => w.toUpperCase());
// Rack-relevant subset: a 9-tile rack can only form words of length [MINLEN, RACK].
const PLAYABLE = ALL.filter(w => w.length >= MINLEN && w.length <= RACK);

const baseScore = (w) => { let s = 0; for (const c of w) s += (tv[c] || 0); return s; };
const lenBonus = (n) => Math.max(0, n - 3) * LB;
const pct = (n, d) => d ? (100 * n / d).toFixed(1) + '%' : '0%';
const fmt = (n) => n.toLocaleString('en-US');

function canForm(word, counts) {
  const need = {};
  for (const ch of word) { need[ch] = (need[ch] || 0) + 1; if (need[ch] > (counts[ch] || 0)) return false; }
  return true;
}
function quantiles(sorted, qs) { return qs.map(q => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]); }

console.log(`\n=== Letter Ride — ENABLE Corpus & Starting-Bag Analysis ===`);
console.log(`Word list: ${fmt(ALL.length)} words. Rack-formable (len ${MINLEN}–${RACK}): ${fmt(PLAYABLE.length)}.\n`);

// ── 1. Word-length distribution ───────────────────────────────────────────────
console.log(`── 1. Word-length distribution (full list) ──`);
const lenHist = {};
for (const w of ALL) lenHist[w.length] = (lenHist[w.length] || 0) + 1;
const maxLen = Math.max(...Object.keys(lenHist).map(Number));
let cumPlayable = 0;
console.log(`len | count    | share   | (≤RACK cumulative)`);
for (let L = MINLEN; L <= Math.min(maxLen, 15); L++) {
  const c = lenHist[L] || 0;
  if (L <= RACK) cumPlayable += c;
  const bar = '#'.repeat(Math.round(40 * c / ALL.length));
  const cum = L <= RACK ? `  ${pct(cumPlayable, PLAYABLE.length)} of formable` : '';
  console.log(`${String(L).padStart(3)} | ${fmt(c).padStart(8)} | ${pct(c, ALL.length).padStart(6)} | ${bar}${cum}`);
}
const over9 = ALL.filter(w => w.length > RACK).length;
console.log(`Words longer than the rack (unreachable, len >${RACK}): ${fmt(over9)} (${pct(over9, ALL.length)} of list)\n`);

// ── 2. Letter frequency vs TILE_VALUES ────────────────────────────────────────
console.log(`── 2. Letter frequency (in rack-formable words) vs assigned TILE_VALUES ──`);
const occ = Object.fromEntries(ALPHABET.map(c => [c, 0]));           // total occurrences
const inWord = Object.fromEntries(ALPHABET.map(c => [c, 0]));        // words containing letter
let totalLetters = 0;
for (const w of PLAYABLE) {
  const seen = new Set();
  for (const c of w) { occ[c]++; totalLetters++; seen.add(c); }
  for (const c of seen) inWord[c]++;
}
const byFreq = [...ALPHABET].sort((a, b) => occ[b] - occ[a]);
const freqRank = Object.fromEntries(byFreq.map((c, i) => [c, i + 1]));
// value rank: cheapest letters first (1 pt) → highest rank number
const byVal = [...ALPHABET].sort((a, b) => (tv[a] || 0) - (tv[b] || 0));
const valRank = Object.fromEntries(byVal.map((c, i) => [c, i + 1]));
console.log(`ltr | value | occ%   | freqRank | valRank | flag`);
for (const c of byFreq) {
  const occShare = pct(occ[c], totalLetters);
  // Flag: a letter that's frequent (freqRank low) but valued high, or rare but valued low (mispriced).
  const fr = freqRank[c], vr = valRank[c];
  let flag = '';
  if (fr <= 8 && (tv[c] || 0) >= 3) flag = '⚠️ common but pricey';
  if (fr >= 19 && (tv[c] || 0) <= 1) flag = '⚠️ rare but cheap';
  console.log(`  ${c} |   ${String(tv[c]).padStart(3)} | ${occShare.padStart(6)} | ${String(fr).padStart(8)} | ${String(vr).padStart(7)} | ${flag}`);
}
console.log(`(freqRank 1 = most frequent; valRank 1 = cheapest. Scrabble-style pricing wants freqRank≈valRank.)\n`);

// ── 3. First / last-letter frequency ──────────────────────────────────────────
console.log(`── 3. First & last letter frequency (informs Anchor / Fresh Start / start-or-end relics) ──`);
const firstC = Object.fromEntries(ALPHABET.map(c => [c, 0]));
const lastC = Object.fromEntries(ALPHABET.map(c => [c, 0]));
let vowelStart = 0, sEnd = 0;
for (const w of PLAYABLE) {
  firstC[w[0]]++; lastC[w[w.length - 1]]++;
  if (VOWELS.has(w[0])) vowelStart++;
  if (w[w.length - 1] === 'S') sEnd++;
}
const topFirst = [...ALPHABET].sort((a, b) => firstC[b] - firstC[a]).slice(0, 6);
const topLast = [...ALPHABET].sort((a, b) => lastC[b] - lastC[a]).slice(0, 6);
console.log(`Top starting letters: ${topFirst.map(c => `${c} ${pct(firstC[c], PLAYABLE.length)}`).join('  ')}`);
console.log(`Top ending letters:   ${topLast.map(c => `${c} ${pct(lastC[c], PLAYABLE.length)}`).join('  ')}`);
console.log(`Words starting with a vowel: ${pct(vowelStart, PLAYABLE.length)}  |  ending in S (plural proxy): ${pct(sEnd, PLAYABLE.length)}\n`);

// ── 4. Pattern coverage (pattern-relic design space) ──────────────────────────
console.log(`── 4. Pattern coverage over rack-formable words (relic predicate hit-rates) ──`);
const hasAdjDouble = (w) => { for (let i = 1; i < w.length; i++) if (w[i] === w[i - 1]) return true; return false; };
const hasRare = (w) => /[JQXZ]/.test(w);
const hasDigraph = (w) => /TH|QU|CH|SH/.test(w);
const isPalindrome = (w) => w === [...w].reverse().join('');
const vowelCount = (w) => { let n = 0; for (const c of w) if (VOWELS.has(c)) n++; return n; };
const patterns = {
  'doubled letter (adjacent)': hasAdjDouble,
  'rare letter (J/Q/X/Z)': hasRare,
  'digraph (TH/QU/CH/SH)': hasDigraph,
  '≥3 vowels (vowel-heavy)': (w) => vowelCount(w) >= 3,
  'starts with vowel': (w) => VOWELS.has(w[0]),
  'ends in S': (w) => w[w.length - 1] === 'S',
  'palindrome': isPalindrome,
};
console.log(`predicate                     | words match | share`);
for (const [name, fn] of Object.entries(patterns)) {
  let n = 0; for (const w of PLAYABLE) if (fn(w)) n++;
  console.log(`${name.padEnd(29)} | ${fmt(n).padStart(11)} | ${pct(n, PLAYABLE.length)}`);
}
console.log(`(High share → reliable but cheap to satisfy; low share → rare, justifies a bigger payoff.)\n`);

// ── 5. Dead-rack rate + vowel distribution from the REAL STARTING_BAG ──────────
const N = 1000;
console.log(`── 5. Dead-rack & rack-quality from STARTING_BAG (${N} seeded ${RACK}-tile draws) ──`);
const bag = CONFIG.STARTING_BAG;
let dead = 0;
const vowelCounts = [];      // vowels per rack
const formableCounts = [];   // # distinct formable words per rack
const bestScores = [];       // best single-word score (base + length bonus, NO relics)
const bestLens = [];
for (let i = 0; i < N; i++) {
  const rack = shuffle([...bag], makeRng(7000 + i)).slice(0, RACK);
  const counts = {}; let v = 0;
  for (const l of rack) { counts[l] = (counts[l] || 0) + 1; if (VOWELS.has(l)) v++; }
  vowelCounts.push(v);
  let formable = 0, best = 0, bestLen = 0;
  for (const w of PLAYABLE) {
    if (!canForm(w, counts)) continue;
    formable++;
    const s = baseScore(w) + lenBonus(w.length);
    if (s > best) { best = s; bestLen = w.length; }
  }
  formableCounts.push(formable);
  bestScores.push(best);
  bestLens.push(bestLen);
  if (formable === 0) dead++;
}
const vHist = {}; for (const v of vowelCounts) vHist[v] = (vHist[v] || 0) + 1;
const bsSorted = [...bestScores].sort((a, b) => a - b);
const fcSorted = [...formableCounts].sort((a, b) => a - b);
const [p10, p50, p90] = quantiles(bsSorted, [0.1, 0.5, 0.9]);
const mean = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length;
console.log(`Dead racks (no valid 3+ word): ${dead}/${N} = ${pct(dead, N)}`);
console.log(`Formable words per rack: min ${fcSorted[0]}, median ${fcSorted[Math.floor(N / 2)]}, max ${fcSorted[N - 1]}`);
console.log(`Best no-relic word score per rack: p10 ${p10}, median ${p50}, p90 ${p90}, max ${bsSorted[N - 1]} (mean ${mean(bestScores).toFixed(1)})`);
console.log(`Avg best-word length: ${mean(bestLens).toFixed(2)}`);
console.log(`Vowel-count distribution per ${RACK}-tile rack (bag is ${bag.filter(l => VOWELS.has(l)).length}/${bag.length} = ${pct(bag.filter(l => VOWELS.has(l)).length, bag.length)} vowels):`);
const lowV = vowelCounts.filter(v => v < 2).length, hiV = vowelCounts.filter(v => v > 5).length;
for (let v = 0; v <= Math.max(...vowelCounts); v++) {
  const c = vHist[v] || 0;
  console.log(`  ${v} vowels: ${'#'.repeat(Math.round(40 * c / N))} (${c}, ${pct(c, N)})`);
}
console.log(`Racks with <2 vowels: ${pct(lowV, N)}  |  >5 vowels: ${pct(hiV, N)}  (evidence for/against a vowel floor/ceiling)\n`);

// ── 5b. Dead-rack rate across ALL decks (wild-aware) ──────────────────────────
// Wilds ('*') act as blanks: a word is formable if the letter deficit ≤ number of wilds.
function canFormWithWilds(word, counts, wilds) {
  let deficit = 0;
  const need = {};
  for (const ch of word) { need[ch] = (need[ch] || 0) + 1; }
  for (const ch in need) deficit += Math.max(0, need[ch] - (counts[ch] || 0));
  return deficit <= wilds;
}
console.log(`── 5b. Dead-rack rate per deck (${N} seeded ${RACK}-tile draws each, wild-aware) ──`);
console.log(`deck        | size | vowels | wilds | dead-rack% | median formable | <2 vowels%`);
for (const [id, deck] of Object.entries(CONFIG.DECKS)) {
  // Dynamic (Mystery) decks vary per run — sample ONE seeded roll so the row is honest (size varies).
  const def = deck.dynamic === 'mystery'
    ? buildMysteryBag(CONFIG.MYSTERY, makeRng(9000))
    : (deck.startingBag || CONFIG.STARTING_BAG);
  const nWild = def.filter(l => l === '*').length;
  const nVowel = def.filter(l => VOWELS.has(l)).length;
  let deadN = 0, lowVN = 0;
  const forms = [];
  for (let i = 0; i < N; i++) {
    const rack = shuffle([...def], makeRng(9000 + i)).slice(0, RACK);
    const counts = {}; let v = 0, w = 0;
    for (const l of rack) { if (l === '*') { w++; continue; } counts[l] = (counts[l] || 0) + 1; if (VOWELS.has(l)) v++; }
    if (v < 2) lowVN++;
    let f = 0;
    for (const word of PLAYABLE) { if (canFormWithWilds(word, counts, w)) { f++; } }
    forms.push(f);
    if (f === 0) deadN++;
  }
  forms.sort((a, b) => a - b);
  console.log(`${id.padEnd(11)} | ${String(def.length).padStart(4)} | ${String(nVowel).padStart(6)} | ${String(nWild).padStart(5)} | ${pct(deadN, N).padStart(10)} | ${String(forms[Math.floor(N / 2)]).padStart(15)} | ${pct(lowVN, N).padStart(9)}`);
}
console.log(`(A thinned mid-run bag is smaller than these starting bags — dead-rack risk rises as the bag shrinks; re-check via the sim with purchases.)\n`);

// ── 6. Best no-relic score vs the target curve ────────────────────────────────
console.log(`── 6. No-relic earning power vs the round target curve ──`);
console.log(`PLAYS_PER_ROUND=${CONFIG.PLAYS_PER_ROUND}. Rough ceiling = median best-word × plays (ignores tile consumption & relics).`);
const roughRound = p50 * CONFIG.PLAYS_PER_ROUND;
console.log(`Median best word ${p50} × ${CONFIG.PLAYS_PER_ROUND} plays ≈ ${roughRound} per round (no relics, no shop).`);
console.log(`TIER0_TARGETS:  ${CONFIG.TIER0_TARGETS.join(', ')}`);
console.log(`ROUND_TARGETS:  ${CONFIG.ROUND_TARGETS.join(', ')}`);
const t0ok = CONFIG.TIER0_TARGETS.filter(t => t <= roughRound).length;
console.log(`→ A no-relic base bag's rough ceiling clears ~${t0ok}/${CONFIG.TIER0_TARGETS.length} Tier-0 rounds and the first ${CONFIG.ROUND_TARGETS.filter(t => t <= roughRound).length}/${CONFIG.ROUND_TARGETS.length} real rounds before any shop scaling.\n`);

// ── 7. Degenerate high-value short words (len 3–4) ─────────────────────────────
console.log(`── 7. Highest-base-value short words (len 3–4, no length bonus) — short-build spike check ──`);
const shorts = PLAYABLE.filter(w => w.length <= 4)
  .map(w => ({ w, s: baseScore(w) }))
  .sort((a, b) => b.s - a.s)
  .slice(0, 20);
console.log(shorts.map(x => `${x.w}(${x.s})`).join('  '));
const short3 = PLAYABLE.filter(w => w.length === 3);
const short3scored = short3.map(baseScore).sort((a, b) => b - a);
console.log(`\n3-letter words: ${fmt(short3.length)}. Base-score p50 ${short3scored[Math.floor(short3.length / 2)]}, p90 ${short3scored[Math.floor(short3.length * 0.1)]}, max ${short3scored[0]}.`);
console.log(`(A Short&Sweet ×3 build multiplies these — watch the top tail for degenerate spikes.)\n`);

console.log(`=== end ===\n`);
