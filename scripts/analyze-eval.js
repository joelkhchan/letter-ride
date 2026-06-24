// scripts/analyze-eval.js — harness v3: skill-gradient instrument.
// Runs the policy ladder x personas x shared seeds on the real ENABLE list + CONFIG.
// Reports win-rate (Wilson CI), round + clear-margin percentiles, the paired greedy->lookahead
// McNemar p-value, and a decision-gap legibility distribution. REPORTS ONLY — no tuning applied.
// Run: npm run analyze:eval -- --n=200            (human tables)
//      npm run analyze:eval -- --n=200 --json      (machine-readable, for baseline diffing)
//      npm run analyze:eval -- --n=200 --k=3 --branch=5
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { makeDictionary } from '../src/dictionary.js';
import { PERSONAS, runPersona } from '../src/sim.js';
import { greedyAgent, randomAgent, lookaheadAgent } from '../src/agents.js';
import { wilsonInterval, mcnemar } from '../src/stats.js';
import { formatPct, toJSON } from '../src/report.js';

const raw = readFileSync(new URL('../assets/enable1.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const dictionary = makeDictionary(raw);
const words = raw.filter(w => w.length >= CONFIG.MIN_WORD_LEN && w.length <= CONFIG.RACK_SIZE).map(w => w.toUpperCase());

const arg = (name, def) => { const a = process.argv.find(x => x.startsWith(`--${name}=`)); return a ? Number(a.slice(name.length + 3)) : def; };
const json = process.argv.includes('--json');
const N = arg('n', 200), K = arg('k', 4), BRANCH = arg('branch', 6);
const seeds = Array.from({ length: N }, (_, i) => i + 1);

const LADDER = [
  { id: 'random',          agentFor: (shop) => randomAgent(shop) },
  { id: 'greedy',          agentFor: (shop) => greedyAgent(shop) },
  { id: `lookahead${K}`,   agentFor: (shop) => lookaheadAgent(shop, { k: K, branch: BRANCH }) },
];

const out = [];
for (const persona of PERSONAS) {
  const byRung = {};
  for (const rung of LADDER) byRung[rung.id] = runPersona({ config: CONFIG, dictionary, words, persona, seeds, agentFor: rung.agentFor });
  const g = byRung.greedy, l = byRung[`lookahead${K}`], r = byRung.random;
  out.push({
    persona: persona.name, byRung,
    skillGap: mcnemar(l.wonFlags, g.wonFlags),
    greedyOverRandom: g.winRate - r.winRate,
    lookaheadOverGreedy: l.winRate - g.winRate,
  });
}

if (json) {
  console.log(toJSON({ N, K, BRANCH, personas: out }));
} else {
  console.log(`\nLetter Ride — Harness v3: skill-gradient (${N} shared seeds; ladder random->greedy->lookahead${K}, branch ${BRANCH})\n`);
  for (const row of out) {
    console.log(`### ${row.persona}`);
    console.log('| Policy | Win rate (95% CI) | round p10/p50/p90 | clear-margin p10/p50/p90 | dead-rack% |');
    console.log('|---|---|---|---|---|');
    for (const rung of LADDER) {
      const s = row.byRung[rung.id];
      const ci = wilsonInterval(Math.round(s.winRate * N), N);
      const rr = s.roundReached, cm = s.clearMargin;
      console.log(`| ${rung.id} | ${formatPct(s.winRate)} [${formatPct(ci.low)}, ${formatPct(ci.high)}] | ${rr.p10}/${rr.p50}/${rr.p90} | ${cm.p10}/${cm.p50}/${cm.p90} | ${formatPct(s.deadRackRate, 2)} |`);
    }
    const dg = row.byRung.greedy.decisionGap;
    console.log(`gradient: greedy-random ${formatPct(row.greedyOverRandom)}, lookahead-greedy ${formatPct(row.lookaheadOverGreedy)} (McNemar p=${row.skillGap.p.toFixed(3)}, b=${row.skillGap.b}, c=${row.skillGap.c}); decision-gap p50/p90 ${dg.p50.toFixed(2)}/${dg.p90.toFixed(2)}\n`);
  }
  console.log('Read (author-judged): a positive, CI-separated lookahead-greedy delta with McNemar p<0.05 = skill has headroom.');
  console.log('A near-zero gradient across the ladder = luck-dominated or trivial decisions. High decision-gap p50 = one play usually dominates (legibility concern).');
  console.log('Limits: lookahead branches on top-N immediate-score plays (may miss low-now/high-later setups); shop policy is the simple target-buy; wild-substitution lands in the next task. REPORTS only.\n');
}
