// scripts/analyze-sim-v2.js — harness v2: per-archetype skilled-persona simulation (skill-vs-luck).
// Run: npm run analyze:sim-v2   (real ENABLE list + CONFIG; prints win-rate + p10/p50/p90 + dead-rack%; no assertions)
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { makeDictionary } from '../src/dictionary.js';
import { PERSONAS, runPersona } from '../src/sim.js';

const raw = readFileSync(new URL('../assets/enable1.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const dictionary = makeDictionary(raw);
const words = raw.filter(w => w.length >= CONFIG.MIN_WORD_LEN && w.length <= CONFIG.RACK_SIZE).map(w => w.toUpperCase());

const N = 200;
const seeds = Array.from({ length: N }, (_, i) => i + 1);

console.log(`\nLetter Ride — Harness v2: skilled per-archetype personas (${N} seeds each)\n`);

// Two buyer policies, side by side, to show the recalibration (A3):
//   greedy  — original: spends on the first affordable target, never banks (the old instrument).
//   banker  — assembler: holds filler buys above the keystone relic's cost, so coins accrue toward
//             the engine keystone (and earn interest). This models the agency a build-or-bust player
//             actually has ("save / prioritize / pick"). If the banker STILL stalls, the funnel/economy
//             is too starved (Phase B); if it clears, the issue is player behavior/onboarding.
const POLICIES = [
  { tag: 'greedy', opts: {} },
  { tag: 'banker', opts: { bankForKeystone: true } },
];

for (const { tag, opts } of POLICIES) {
  console.log(`\n### Buyer policy: ${tag}${tag === 'banker' ? ' (keystone-saving assembler)' : ' (original)'}`);
  console.log('| Persona | Win rate | round p10 | p50 | p90 | dead-rack% (post-thin) |');
  console.log('|---|---|---|---|---|---|');
  for (const persona of PERSONAS) {
    const s = runPersona({ config: CONFIG, dictionary, words, persona, seeds, ...opts });   // pool {} = everything unlocked
    const rr = s.roundReached;
    console.log(`| ${persona.name} | ${(s.winRate * 100).toFixed(1)}% | ${rr.p10} | ${rr.p50} | ${rr.p90} | ${(s.deadRackRate * 100).toFixed(2)}% |`);
  }
}
console.log('\nWide p10↔p90 spread = luck-dominated; tight = skill-rewarding. 0% across the board would mean the curve is unbeatable even with a skilled line.');
console.log('Limits: greedy best-word play + simple target-buy policy; banking gates only filler (no in-shop thinning yet); wilds treated as non-letters. This REPORTS only — no tuning applied.\n');
