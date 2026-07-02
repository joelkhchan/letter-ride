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
import { buildLoadout } from '../src/meta.js';

const raw = readFileSync(new URL('../assets/enable1.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const dictionary = makeDictionary(raw);
const words = raw.filter(w => w.length >= CONFIG.MIN_WORD_LEN && w.length <= CONFIG.RACK_SIZE).map(w => w.toUpperCase());

const arg = (name, def) => { const a = process.argv.find(x => x.startsWith(`--${name}=`)); return a ? Number(a.slice(name.length + 3)) : def; };
const json = process.argv.includes('--json');
const N = arg('n', 200), K = arg('k', 4), BRANCH = arg('branch', 6);
const seeds = Array.from({ length: N }, (_, i) => i + 1);

// Opt-in dimensions (2026-07-01 harness v4). Default off → the base ladder is unchanged. Each is measured
// at the GREEDY rung (the competent-player line) as a delta vs that rung's baseline, to avoid a table
// explosion. --loadout = all perks maxed; --events = the Shop-XOR-Event node policy engages events.
const doLoadout = process.argv.includes('--loadout');
const doEvents = process.argv.includes('--events');
const loadoutOn = buildLoadout(
  { loadout: { extraDiscards: CONFIG.LOADOUT.extraDiscards.max, freeReroll: CONFIG.LOADOUT.freeReroll.max, round1Play: CONFIG.LOADOUT.round1Play.max } },
  CONFIG, ['extraDiscards', 'freeReroll', 'round1Play'],
);

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
  // Dimension sweeps at the greedy rung (only when flagged).
  const dims = {};
  if (doLoadout) dims.loadoutOn = runPersona({ config: CONFIG, dictionary, words, persona, seeds, agentFor: (shop) => greedyAgent(shop), loadout: loadoutOn });
  if (doEvents) dims.eventsOn = runPersona({ config: CONFIG, dictionary, words, persona, seeds, agentFor: (shop) => greedyAgent(shop), events: true });
  out.push({
    persona: persona.name, byRung, dims,
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
    console.log(`gradient: greedy-random ${formatPct(row.greedyOverRandom)}, lookahead-greedy ${formatPct(row.lookaheadOverGreedy)} (McNemar p=${row.skillGap.p.toFixed(3)}, b=${row.skillGap.b}, c=${row.skillGap.c}); decision-gap p50/p90 ${dg.p50.toFixed(2)}/${dg.p90.toFixed(2)}`);
    if (doLoadout || doEvents) {
      const gw = row.byRung.greedy.winRate, parts = [];
      if (row.dims.loadoutOn) parts.push(`+loadout ${formatPct(row.dims.loadoutOn.winRate)} (Δ ${formatPct(row.dims.loadoutOn.winRate - gw)})`);
      if (row.dims.eventsOn) parts.push(`+events ${formatPct(row.dims.eventsOn.winRate)} (Δ ${formatPct(row.dims.eventsOn.winRate - gw)})`);
      console.log(`dimensions (greedy baseline ${formatPct(gw)}): ${parts.join('; ')}`);
    }
    console.log('');
  }
  console.log('Read (author-judged): a positive, CI-separated lookahead-greedy delta with McNemar p<0.05 = skill has headroom.');
  console.log('A near-zero gradient across the ladder = luck-dominated or trivial decisions. High decision-gap p50 = one play usually dominates (legibility concern).');
  console.log('Dimensions (opt-in): --loadout = all perks maxed (its Meta cost is an analyze:meta question, not shown here); --events = the Shop-XOR-Event node policy, with The Proof/Press resolved by EV constants (sim-events.EVENT_EV), not a solver.');
  console.log('Limits: lookahead branches on top-N immediate-score plays (may miss low-now/high-later setups); shop policy is the simple target-buy; event EV probabilities are author-owned estimates. REPORTS only.\n');
}
