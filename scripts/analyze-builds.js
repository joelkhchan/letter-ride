// scripts/analyze-builds.js — head-to-head archetype competitiveness harness.
// Run: npm run analyze   (uses the real ENABLE list + CONFIG; prints a ratio table, no assertions)
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { makeRng, shuffle } from '../src/rng.js';
import { makeDictionary } from '../src/dictionary.js';
import { scoreWord } from '../src/scoring.js';
import { RELICS } from '../src/relics.js';
import { honeModifiers, ARCHETYPES } from '../src/archetypes.js';

const words = readFileSync(new URL('../assets/enable1.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const dict = makeDictionary(words);
const byLen = words.filter(w => w.length >= CONFIG.MIN_WORD_LEN).map(w => w.toUpperCase());

const tv = CONFIG.TILE_VALUES, lb = CONFIG.LENGTH_BONUS_PER_LETTER;
const N = 60;

// ─── helpers ────────────────────────────────────────────────────────────────
function canForm(word, counts) {
  const need = {};
  for (const ch of word) { need[ch] = (need[ch] || 0) + 1; if (need[ch] > (counts[ch] || 0)) return false; }
  return true;
}
function rackCounts(rack) { const c = {}; for (const l of rack) c[l] = (c[l] || 0) + 1; return c; }
function selOf(word) { return [...word].map(ch => ({ tile: { id: 't', letter: ch, mods: [] }, letter: ch })); }

// Build a scoring context for an archetype word (wordsPlayedThisRound for escalation sims).
function makeCtx(word, opts = {}) {
  const letters = [...word.toUpperCase()];
  return {
    word: word.toUpperCase(),
    letters,
    selection: selOf(word),
    wordsPlayedThisRound: opts.wordsPlayedThisRound || 0,
    enablers: opts.enablers || [],
  };
}

// Score a word with given relics+hone, injecting full ctx so relic predicates work.
function scoreWithBuild(word, relicsArray, honeMods, ctxOpts = {}) {
  const sel = selOf(word);
  const ctx = makeCtx(word, ctxOpts);
  // scoreWord merges its own ctx; we pass additional context fields via context param.
  return scoreWord(sel, {
    tileValues: tv,
    lengthBonusPerLetter: lb,
    relics: [...relicsArray, ...honeMods],
    context: {
      wordsPlayedThisRound: ctxOpts.wordsPlayedThisRound || 0,
      enablers: ctxOpts.enablers || [],
    },
  }).score;
}

// Draw a rack from a given bag definition (array of letter strings).
function drawRackFromBag(bagDef, seed) {
  return shuffle([...bagDef], makeRng(seed)).slice(0, CONFIG.RACK_SIZE);
}

// ─── fixtures ───────────────────────────────────────────────────────────────
// Each fixture: { archetypeId, bagId, relicIds, honeLevels, ctxOpts }
// Bag: null → CONFIG.STARTING_BAG (standard). Hone level 3 for each archetype = meaningful bonus.
// Escalation uses wordsPlayedThisRound=3 (simulates late-round play; best play on the 4th word).
const fixtures = [
  {
    archetypeId: 'shortWord',
    bagId:       'lean',
    relicIds:    ['shortAndSweet'],
    honeLevels:  { shortWord: 3 },
    // shortWord picks <=3-letter words only; shortAndSweet gives ×3 Mult, hone gives +3 addMult
    filterWord:  (w) => w.length <= 3,
  },
  {
    archetypeId: 'longWord',
    bagId:       'standard',
    relicIds:    ['lengthy', 'longHaul'],
    honeLevels:  { longWord: 3 },
    // longWord picks >=6-letter words; lengthy +1 addMult per letter > 4, longHaul ×Mult scales
    filterWord:  (w) => w.length >= 6,
  },
  {
    archetypeId: 'rareLetter',
    bagId:       'rareRich',
    relicIds:    ['rareHoarder', 'rareSurge'],
    honeLevels:  { rareLetter: 3 },
    // rareLetter: no word filter — just maximize score on whatever formable words contain J/Q/X/Z
    filterWord:  null,
  },
  {
    archetypeId: 'doubled',
    bagId:       'doubled',
    relicIds:    ['doubleTrouble', 'echoChamber'],
    honeLevels:  { doubled: 3 },
    // doubled: no word filter — pick best-scoring word containing a doubled letter
    filterWord:  null,
  },
  {
    archetypeId: 'vowelHeavy',
    bagId:       'standard',
    relicIds:    ['vowelBonus', 'freshStart'],
    honeLevels:  { vowelHeavy: 3 },
    // vowelHeavy: pick words with >=3 vowels; vowelBonus +2 per vowel, freshStart +2 Mult on V-start
    filterWord:  null,
  },
  {
    archetypeId: 'escalation',
    bagId:       'standard',
    relicIds:    ['comboCounter', 'momentum'],
    honeLevels:  { escalation: 3 },
    // Escalation: best word on the 3rd play (wordsPlayedThisRound=3); comboCounter +3 Mult, momentum +30 Points
    filterWord:  null,
    ctxOpts:     { wordsPlayedThisRound: 3 },
  },
];

// ─── baseline: best long word, no relics, standard bag ──────────────────────
let longTotal = 0;
for (let i = 0; i < N; i++) {
  const rack = drawRackFromBag(CONFIG.STARTING_BAG, 1000 + i);
  const counts = rackCounts(rack);
  const formable = byLen.filter(w => w.length <= CONFIG.RACK_SIZE && canForm(w, counts));
  if (!formable.length) continue;
  let bestLong = 0;
  for (const w of formable) bestLong = Math.max(bestLong, scoreWord(selOf(w), { tileValues: tv, lengthBonusPerLetter: lb }).score);
  longTotal += bestLong;
}
const avgLong = longTotal / N;

// ─── per-fixture measurement ─────────────────────────────────────────────────
const results = [];

for (const fix of fixtures) {
  const bagDef = fix.bagId === 'standard' || !fix.bagId
    ? CONFIG.STARTING_BAG
    : CONFIG.DECKS[fix.bagId].startingBag;

  const relicsArray = fix.relicIds.map(id => RELICS[id]);
  const honeMods    = honeModifiers(fix.honeLevels);
  const ctxOpts     = fix.ctxOpts || {};
  const arch        = ARCHETYPES[fix.archetypeId];

  let total = 0;
  let countedRacks = 0;

  for (let i = 0; i < N; i++) {
    const rack = drawRackFromBag(bagDef, 1000 + i);
    const counts = rackCounts(rack);
    let formable = byLen.filter(w => w.length <= CONFIG.RACK_SIZE && canForm(w, counts));

    // Apply word filter (e.g. shortWord only looks at <=3-letter words)
    if (fix.filterWord) formable = formable.filter(fix.filterWord);
    if (!formable.length) continue;

    // Score every formable word and pick the best; for archetype-specific relics the
    // predicate runs inside scoreWord via ctx fields, so we pass ctxOpts.
    let best = 0;
    for (const w of formable) {
      const s = scoreWithBuild(w, relicsArray, honeMods, ctxOpts);
      if (s > best) best = s;
    }

    total += best;
    countedRacks++;
  }

  const avg = countedRacks > 0 ? total / countedRacks : 0;
  results.push({ name: arch.name, archetypeId: fix.archetypeId, avg, countedRacks });
}

// ─── print table ─────────────────────────────────────────────────────────────
console.log(`\nLetter Ride — Archetype Head-to-Head Balance (${N} seeded racks per archetype)\n`);
console.log(`Baseline: best long word (no relics, standard bag) avg = ${avgLong.toFixed(1)}\n`);
console.log('| Archetype | Relics | Bag | Avg Score | Ratio to Baseline |');
console.log('|---|---|---|---|---|');

const fixtureMap = Object.fromEntries(fixtures.map(f => [f.archetypeId, f]));

for (const r of results) {
  const fix = fixtureMap[r.archetypeId];
  const ratio = avgLong > 0 ? ((r.avg / avgLong) * 100).toFixed(0) : '?';
  const relicStr = fix.relicIds.join(', ');
  const bagStr = fix.bagId || 'standard';
  const flag = Number(ratio) < 50 ? ' ⚠️  < 50%' : '';
  console.log(`| ${r.name} | ${relicStr} | ${bagStr} | ${r.avg.toFixed(1)} | ${ratio}%${flag} |`);
}

console.log('\nNote: shortWord measured on <=3-letter words only. escalation simulates play #4 in a round.');
console.log('Flag: archetypes below 50% baseline may need tuning (config.js / archetypes.js / relics.js).\n');
