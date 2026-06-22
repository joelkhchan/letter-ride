// scripts/analyze-builds.js — measures short-word vs long-word competitiveness.
// Run: npm run analyze   (uses the real ENABLE list + CONFIG; prints a summary, no assertions)
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { makeRng, shuffle } from '../src/rng.js';
import { makeDictionary } from '../src/dictionary.js';
import { scoreWord } from '../src/scoring.js';
import { RELICS } from '../src/relics.js';
import { getMod } from '../src/tiles.js';

const words = readFileSync(new URL('../assets/enable1.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const dict = makeDictionary(words);
const byLen = words.filter(w => w.length >= CONFIG.MIN_WORD_LEN).map(w => w.toUpperCase());

function canForm(word, counts) {
  const need = {};
  for (const ch of word) { need[ch] = (need[ch] || 0) + 1; if (need[ch] > (counts[ch] || 0)) return false; }
  return true;
}
function rackCounts(rack) { const c = {}; for (const l of rack) c[l] = (c[l] || 0) + 1; return c; }
function selOf(word) { return [...word].map(ch => ({ tile: { id: 't', letter: ch, mods: [] }, letter: ch })); }

const tv = CONFIG.TILE_VALUES, lb = CONFIG.LENGTH_BONUS_PER_LETTER;
const N = 60;
let longTotal = 0, shortTotal = 0, shortWins = 0;
const target5 = CONFIG.ROUND_TARGETS[4];

for (let i = 0; i < N; i++) {
  const rack = shuffle(CONFIG.STARTING_BAG, makeRng(1000 + i)).slice(0, CONFIG.RACK_SIZE);
  const counts = rackCounts(rack);
  const formable = byLen.filter(w => w.length <= CONFIG.RACK_SIZE && canForm(w, counts));
  if (!formable.length) continue;

  // Best long word, no relics
  let bestLong = 0;
  for (const w of formable) bestLong = Math.max(bestLong, scoreWord(selOf(w), { tileValues: tv, lengthBonusPerLetter: lb }).score);

  // Best <=3-letter word with a Short&Sweet + Polished-on-every-tile build (proxy for a stacked short build)
  let bestShort = 0;
  for (const w of formable.filter(w => w.length <= 3)) {
    const sel = [...w].map(ch => ({ tile: { id: 't', letter: ch, mods: [getMod('polished')] }, letter: ch }));
    bestShort = Math.max(bestShort, scoreWord(sel, { tileValues: tv, lengthBonusPerLetter: lb, relics: [RELICS.shortAndSweet] }).score);
  }
  longTotal += bestLong; shortTotal += bestShort;
  if (bestShort >= bestLong) shortWins++;
}

const ratio = shortTotal / longTotal;
console.log(`Letter Ride — short-vs-long balance over ${N} seeded base-bag racks`);
console.log(`  median-ish avg best long-word score (no relics): ${(longTotal / N).toFixed(1)}`);
console.log(`  avg best short build (Short&Sweet + Polished):   ${(shortTotal / N).toFixed(1)}`);
console.log(`  short/long ratio: ${(ratio * 100).toFixed(0)}%  (Tier 1 gate bar: >= 80%)`);
console.log(`  racks where short >= long: ${shortWins}/${N}`);
console.log(`  round 5 target = ${target5}; short build reaches it in one play on ${'<eyeball above>'} racks`);
