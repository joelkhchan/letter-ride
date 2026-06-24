import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneRun, lookaheadPlay } from '../src/lookahead.js';
import { bestPlay, simulateRun } from '../src/sim.js';
import { greedyAgent, makeAgent } from '../src/agents.js';
import { newRun, playWord } from '../src/run.js';
import { makeDictionary } from '../src/dictionary.js';
import { RELICS } from '../src/relics.js';
import { resetTileIds } from '../src/tiles.js';

// Small self-contained beatable world (no external asset). Single non-boss round.
function makeLookaheadFixture() {
  const words = ['CAT', 'COAT', 'TACO', 'ACT', 'COT', 'CAB', 'TAB', 'AT', 'TO', 'OAT'];
  const config = {
    STARTING_BAG: ['C', 'O', 'A', 'T', 'C', 'A', 'B', 'T', 'O', 'A'],
    TILE_VALUES: { A: 1, B: 3, C: 3, O: 1, T: 1 },
    RACK_SIZE: 4, PLAYS_PER_ROUND: 3, DISCARDS_PER_ROUND: 1,
    MIN_WORD_LEN: 2, LENGTH_BONUS_PER_LETTER: 5,
    ROUND_TARGETS: [40],
    COINS_ON_CLEAR: { base: 4, perUnusedPlay: 1, perUnusedDiscard: 1 },
    INTEREST: { enabled: false, per: 5, rate: 1, cap: 5 },
    DECKS: {},
  };
  return { config, dictionary: makeDictionary(words), words: words.map(w => w.toUpperCase()) };
}

test('cloneRun produces an independent run with preserved rng state and tile ids', () => {
  resetTileIds();
  const { config, dictionary } = makeLookaheadFixture();
  const run = newRun({ config, dictionary, seed: 1 });
  const clone = cloneRun(run);
  assert.notEqual(clone, run);
  assert.deepEqual(clone.rack.map(t => t.id), run.rack.map(t => t.id));
  assert.equal(clone.rng.getState(), run.rng.getState());
  clone.roundTotal = 999;
  assert.notEqual(run.roundTotal, 999);
});

test('cloneRun isolates relicState — playing on the clone does not ratchet the original snowball', () => {
  resetTileIds();
  const { config, dictionary, words } = makeLookaheadFixture();
  const run = newRun({ config, dictionary, seed: 1 });
  run.relics = [RELICS.perpetualEngine];
  run.relicState = {};
  const clone = cloneRun(run);
  const sel = bestPlay(clone, words).selection;
  playWord(clone, sel);
  assert.equal((run.relicState.perpetualEngine?.stacks) || 0, 0, 'original stacks untouched');
  assert.ok((clone.relicState.perpetualEngine?.stacks) >= 1, 'clone ratcheted independently');
});

test('lookaheadPlay returns a legal first move', () => {
  resetTileIds();
  const { config, dictionary, words } = makeLookaheadFixture();
  const run = newRun({ config, dictionary, seed: 1 });
  const p = lookaheadPlay(run, words, { k: 3, branch: 5 });
  assert.ok(p && p.selection && p.word);
});

test('lookahead never regresses vs greedy on the same seed', () => {
  const { config, dictionary, words } = makeLookaheadFixture();
  for (const seed of [1, 2, 3, 4, 5]) {
    const greedy = simulateRun({ config, dictionary, words, seed, agent: greedyAgent() });
    const lookA = simulateRun({ config, dictionary, words, seed,
      agent: makeAgent({ choosePlay: (r, w) => lookaheadPlay(r, w, { k: 3, branch: 5 }),
                         chooseDiscard: greedyAgent().chooseDiscard, chooseShop: greedyAgent().chooseShop }) });
    assert.ok(lookA.roundReached >= greedy.roundReached, `lookahead regressed on seed ${seed}`);
  }
});
