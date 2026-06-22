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
function selOf(word, mods = []) { return [...word].map(ch => ({ tile: { id: 't', letter: ch, mods }, letter: ch })); }

const tv = CONFIG.TILE_VALUES, lb = CONFIG.LENGTH_BONUS_PER_LETTER;
const N = 60;
const target5 = CONFIG.ROUND_TARGETS[4];

const variants = {
  'Short, no relics': { noRelics: true, polishedCount: 0 },
  'Short + S&S only': { shortAndSweet: true, polishedCount: 0 },
  'Short + S&S + 1 Polished': { shortAndSweet: true, polishedCount: 1 },
  'Short + S&S + all Polished': { shortAndSweet: true, polishedCount: 'all' }
};

const results = {};
for (const name in variants) results[name] = { total: 0, wins: 0 };
let longTotal = 0;

for (let i = 0; i < N; i++) {
  const rack = shuffle(CONFIG.STARTING_BAG, makeRng(1000 + i)).slice(0, CONFIG.RACK_SIZE);
  const counts = rackCounts(rack);
  const formable = byLen.filter(w => w.length <= CONFIG.RACK_SIZE && canForm(w, counts));
  if (!formable.length) continue;

  // Best long word, no relics
  let bestLong = 0;
  for (const w of formable) bestLong = Math.max(bestLong, scoreWord(selOf(w), { tileValues: tv, lengthBonusPerLetter: lb }).score);
  longTotal += bestLong;

  // Best <=3-letter word for each variant
  const shortWords = formable.filter(w => w.length <= 3);
  for (const [variantName, variantCfg] of Object.entries(variants)) {
    let bestScore = 0;
    for (const w of shortWords) {
      let mods = [];
      let relicsArray = [];
      let polishedCount = variantCfg.polishedCount;

      if (!variantCfg.noRelics) {
        relicsArray.push(RELICS.shortAndSweet);
        if (polishedCount === 'all') {
          mods = Array(w.length).fill(getMod('polished'));
        } else if (polishedCount > 0) {
          mods = Array(w.length).fill(null);
          for (let j = 0; j < Math.min(polishedCount, w.length); j++) mods[j] = getMod('polished');
        }
      }

      const sel = [...w].map((ch, idx) => ({ tile: { id: 't', letter: ch, mods: mods[idx] ? [mods[idx]] : [] }, letter: ch }));
      const scoreObj = scoreWord(sel, { tileValues: tv, lengthBonusPerLetter: lb, relics: relicsArray.length ? relicsArray : undefined });
      bestScore = Math.max(bestScore, scoreObj.score);
    }
    results[variantName].total += bestScore;
    if (bestScore >= bestLong) results[variantName].wins++;
  }
}

const avgLong = longTotal / N;
console.log(`\nLetter Ride — Short-Build Balance Analysis (${N} seeded racks)\n`);
console.log(`Baseline: best long word (no relics) avg = ${avgLong.toFixed(1)}\n`);
console.log('| Short-Build Variant | Avg Score | Ratio to Long | Short ≥ Long |');
console.log('|---|---|---|---|');
for (const name of Object.keys(variants)) {
  const avg = results[name].total / N;
  const ratio = ((avg / avgLong) * 100).toFixed(0);
  const wins = results[name].wins;
  console.log(`| ${name} | ${avg.toFixed(1)} | ${ratio}% | ${wins}/${N} |`);
}

const ceilingAvg = results['Short + S&S + all Polished'].total / N;
const reachTarget = results['Short + S&S + all Polished'].wins;
console.log(`\nRound 5 target: ${target5}`);
console.log(`Ceiling build reaches target in one play: ${reachTarget}/${N} racks`);
