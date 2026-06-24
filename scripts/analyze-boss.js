// scripts/analyze-boss.js — harness v3: per-(persona x boss) survivability matrix.
// For each persona, runs a no-boss baseline and each forced boss over the SAME seeds, reporting
// win-rate (Wilson CI) + p50 round + clear-margin p50, and the paired McNemar (boss vs none).
// Default agent is GREEDY (the survivability FLOOR) for speed; pass --lookahead for a skilled read.
// REPORTS ONLY. Run: npm run analyze:boss -- --n=50   (or --n=50 --lookahead --k=2 --branch=4)
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { makeDictionary } from '../src/dictionary.js';
import { PERSONAS, runPersona } from '../src/sim.js';
import { greedyAgent, lookaheadAgent } from '../src/agents.js';
import { ALL_BOSS_IDS } from '../src/bosses.js';
import { wilsonInterval, mcnemar } from '../src/stats.js';
import { formatPct } from '../src/report.js';

const raw = readFileSync(new URL('../assets/enable1.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const dictionary = makeDictionary(raw);
const words = raw.filter(w => w.length >= CONFIG.MIN_WORD_LEN && w.length <= CONFIG.RACK_SIZE).map(w => w.toUpperCase());

const arg = (name, def) => { const a = process.argv.find(x => x.startsWith(`--${name}=`)); return a ? Number(a.slice(name.length + 3)) : def; };
const useLook = process.argv.includes('--lookahead');
const N = arg('n', 50), K = arg('k', 2), BRANCH = arg('branch', 4);
const seeds = Array.from({ length: N }, (_, i) => i + 1);
const agentFor = useLook ? (shop) => lookaheadAgent(shop, { k: K, branch: BRANCH }) : (shop) => greedyAgent(shop);

const COLS = ['none', ...ALL_BOSS_IDS];
console.log(`\nLetter Ride — Harness v3: boss survivability matrix (${N} shared seeds; ${useLook ? `lookahead${K}` : 'greedy'} agent)`);
console.log('Win-rate per (persona x forced boss). "none" = bosses disabled (bossOrder=[]). REPORTS ONLY.\n');
console.log(`| Persona | ${COLS.join(' | ')} |`);
console.log(`|${'---|'.repeat(COLS.length + 1)}`);
for (const persona of PERSONAS) {
  const cells = {};
  for (const col of COLS) cells[col] = runPersona({ config: CONFIG, dictionary, words, persona, seeds, agentFor, forceBoss: col });
  const row = COLS.map(col => formatPct(cells[col].winRate)).join(' | ');
  console.log(`| ${persona.name} | ${row} |`);
}
console.log('\nRead (author-judged): each boss should DROP its target archetype vs "none" but NOT to a dead 0% — that is "antagonize, do not kill".');
console.log('A boss that zeroes an otherwise-viable archetype is a design failure (violates the no-dead-archetype rule).');
console.log('CAVEAT: this matrix is only informative once the curve is tuned so archetypes win >0% WITHOUT bosses. At the current steep 12-encounter curve the competent bot wins ~0% everywhere, so cells will read ~0% regardless of boss — the instrument is READY for post-tuning use.\n');
