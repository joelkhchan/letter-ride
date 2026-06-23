// scripts/analyze-sim.js — Phase 0b eval harness v1: greedy-player full-run simulation.
// Run: npm run analyze:sim   (real ENABLE list + CONFIG; prints win-rate + round-reached; no assertions)
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { makeDictionary } from '../src/dictionary.js';
import { simulateRun } from '../src/sim.js';

const raw = readFileSync(new URL('../assets/enable1.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const dictionary = makeDictionary(raw);
// Pre-filter once for speed: uppercase words in [MIN_WORD_LEN, RACK_SIZE] (longer words never fit the hand).
const words = raw.filter(w => w.length >= CONFIG.MIN_WORD_LEN && w.length <= CONFIG.RACK_SIZE).map(w => w.toUpperCase());

const N = 200;
const results = [];
for (let seed = 1; seed <= N; seed++) results.push(simulateRun({ config: CONFIG, dictionary, words, seed }));

const wins = results.filter(r => r.won).length;
const avgRound = (results.reduce((s, r) => s + r.roundReached, 0) / N).toFixed(2);
const capped = results.filter(r => r.hitCap).length;
const dist = {};
for (const r of results) dist[r.roundReached] = (dist[r.roundReached] || 0) + 1;

console.log(`\nLetter Ride — Model B greedy-player simulation (${N} seeds, standard deck)\n`);
console.log(`Win rate: ${wins}/${N} = ${(wins / N * 100).toFixed(1)}%`);
console.log(`Avg round reached: ${avgRound} / ${CONFIG.ROUND_TARGETS.length}`);
if (capped) console.log(`WARNING: ${capped} run(s) hit the iteration cap (possible stuck loop — investigate).`);
console.log('\nRound reached distribution:');
for (let r = 1; r <= CONFIG.ROUND_TARGETS.length; r++) console.log(`  Round ${r}: ${'#'.repeat(dist[r] || 0)} (${dist[r] || 0})`);
console.log('\nNote: greedy best-single-word policy, no shop purchases, wilds treated as non-letters (v1 limits).');
console.log('Per-archetype committer personas + purchase policies = v2.\n');
