// scripts/eval-worker.js — worker for analyze-eval.js parallelism. Builds the dictionary + word list
// ONCE per worker, then runs one runPersona per task message. Results are deterministic per seed, so
// parallel output is byte-identical to serial. Heavy (lookahead) and light (greedy) tasks share the
// pool via a pull queue in the parent, so load balances without pre-partitioning.
import { parentPort } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { makeDictionary } from '../src/dictionary.js';
import { PERSONAS, runPersona } from '../src/sim.js';
import { greedyAgent, randomAgent, lookaheadAgent } from '../src/agents.js';
import { buildLoadout } from '../src/meta.js';

const raw = readFileSync(new URL('../assets/enable1.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const dictionary = makeDictionary(raw);
const words = raw.filter(w => w.length >= CONFIG.MIN_WORD_LEN && w.length <= CONFIG.RACK_SIZE).map(w => w.toUpperCase());
const loadoutOn = buildLoadout(
  { loadout: { extraDiscards: CONFIG.LOADOUT.extraDiscards.max, freeReroll: CONFIG.LOADOUT.freeReroll.max, round1Play: CONFIG.LOADOUT.round1Play.max } },
  CONFIG, ['extraDiscards', 'freeReroll', 'round1Play'],
);

// A task = { personaIdx, kind: 'random'|'greedy'|'lookahead'|'loadout'|'events', N, K, BRANCH }.
parentPort.on('message', (task) => {
  const { personaIdx, kind, N, K, BRANCH } = task;
  const persona = PERSONAS[personaIdx];
  const seeds = Array.from({ length: N }, (_, i) => i + 1);
  const agentFor =
    kind === 'random' ? (shop) => randomAgent(shop)
    : kind === 'lookahead' ? (shop) => lookaheadAgent(shop, { k: K, branch: BRANCH })
    : (shop) => greedyAgent(shop);                 // greedy / loadout / events all use the greedy agent
  const opts = { config: CONFIG, dictionary, words, persona, seeds, agentFor };
  if (kind === 'loadout') opts.loadout = loadoutOn;
  if (kind === 'events') opts.events = true;
  parentPort.postMessage({ personaIdx, kind, summary: runPersona(opts) });
});
