// scripts/analyze-eval.js — harness v3: skill-gradient instrument.
// Runs the policy ladder x personas x shared seeds on the real ENABLE list + CONFIG.
// Reports win-rate (Wilson CI), round + clear-margin percentiles, the paired greedy->lookahead
// McNemar p-value, and a decision-gap legibility distribution. REPORTS ONLY — no tuning applied.
// Run: npm run analyze:eval -- --n=200            (human tables)
//      npm run analyze:eval -- --n=200 --json      (machine-readable, for baseline diffing)
//      npm run analyze:eval -- --n=200 --k=3 --branch=5
// Parallel by default (one worker per core-1; each runPersona is an independent, per-seed-deterministic
// task, so output is byte-identical to serial). Pass --serial to run in-process (determinism cross-check).
import { readFileSync } from 'node:fs';
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { CONFIG } from '../src/config.js';
import { makeDictionary } from '../src/dictionary.js';
import { PERSONAS, runPersona } from '../src/sim.js';
import { greedyAgent, randomAgent, lookaheadAgent } from '../src/agents.js';
import { wilsonInterval, mcnemar } from '../src/stats.js';
import { formatPct, toJSON } from '../src/report.js';
import { buildLoadout } from '../src/meta.js';

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

const LADDER = [{ id: 'random' }, { id: 'greedy' }, { id: `lookahead${K}` }];   // output order + labels
const serial = process.argv.includes('--serial');

// One task = one runPersona call (independent, per-seed-deterministic). Kinds map to ladder rungs + the
// optional dimension sweeps. greedy/loadout/events all use the greedy agent (dims are greedy-rung deltas).
const KINDS = ['random', 'greedy', 'lookahead', ...(doLoadout ? ['loadout'] : []), ...(doEvents ? ['events'] : [])];
const tasks = [];
for (let pi = 0; pi < PERSONAS.length; pi++) for (const kind of KINDS) tasks.push({ personaIdx: pi, kind, N, K, BRANCH });

// Persistent worker pool with a pull queue: each worker builds the dictionary once, then drains tasks.
function runPool(taskList, workerUrl, nWorkers) {
  const results = new Array(taskList.length);
  let next = 0, done = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(nWorkers, taskList.length)) }, () => new Worker(workerUrl));
  return new Promise((resolve, reject) => {
    const assign = (w) => { if (next < taskList.length) { w._i = next++; w.postMessage(taskList[w._i]); } };
    for (const w of workers) {
      w.on('message', (msg) => {
        results[w._i] = msg;
        if (++done === taskList.length) { workers.forEach(x => x.terminate()); resolve(results); }
        else assign(w);
      });
      w.on('error', reject);
      assign(w);
    }
  });
}

// In-process path (--serial): same task list, no workers. For a determinism cross-check vs the pool.
function runTasksSerial(taskList) {
  const raw = readFileSync(new URL('../assets/enable1.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
  const dictionary = makeDictionary(raw);
  const words = raw.filter(w => w.length >= CONFIG.MIN_WORD_LEN && w.length <= CONFIG.RACK_SIZE).map(w => w.toUpperCase());
  const seeds = Array.from({ length: N }, (_, i) => i + 1);
  const agentFor = (kind) => kind === 'random' ? (s) => randomAgent(s) : kind === 'lookahead' ? (s) => lookaheadAgent(s, { k: K, branch: BRANCH }) : (s) => greedyAgent(s);
  return taskList.map((t) => {
    const opts = { config: CONFIG, dictionary, words, persona: PERSONAS[t.personaIdx], seeds, agentFor: agentFor(t.kind) };
    if (t.kind === 'loadout') opts.loadout = loadoutOn;
    if (t.kind === 'events') opts.events = true;
    return { personaIdx: t.personaIdx, kind: t.kind, summary: runPersona(opts) };
  });
}

const rawResults = serial
  ? runTasksSerial(tasks)
  : await runPool(tasks, new URL('./eval-worker.js', import.meta.url), Math.max(1, Math.min((os.cpus()?.length || 2) - 1, tasks.length)));

const byPersona = PERSONAS.map(() => ({}));
for (const m of rawResults) byPersona[m.personaIdx][m.kind] = m.summary;

const out = PERSONAS.map((persona, pi) => {
  const r = byPersona[pi];
  const byRung = { random: r.random, greedy: r.greedy, [`lookahead${K}`]: r.lookahead };
  const dims = {};
  if (doLoadout) dims.loadoutOn = r.loadout;
  if (doEvents) dims.eventsOn = r.events;
  const g = byRung.greedy, l = byRung[`lookahead${K}`], rr = byRung.random;
  return {
    persona: persona.name, byRung, dims,
    skillGap: mcnemar(l.wonFlags, g.wonFlags),
    greedyOverRandom: g.winRate - rr.winRate,
    lookaheadOverGreedy: l.winRate - g.winRate,
  };
});

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
