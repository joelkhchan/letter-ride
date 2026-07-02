// test/sim-events.test.js — harness v4 Stage 3: node policy (chooseNode) + EV resolver (resolveEventEV).
import { test } from 'node:test';
import assert from 'node:assert';
import { CONFIG } from '../src/config.js';
import { newRun } from '../src/run.js';
import { chooseNode, chooseNodeSmart, resolveEventEV, EVENT_EV } from '../src/sim-events.js';

const dict = { isValid: () => true, findWord: () => null };
const mkRun = (seed = 1) => newRun({ config: CONFIG, dictionary: dict, seed });

// ── chooseNode: the persona-aware Shop-vs-Event policy ──

test('chooseNode: no event offered → shop (false)', () => {
  const run = mkRun(); run.nodeEventId = null;
  assert.equal(chooseNode(run, { targetHoneId: 'longWord' }), false);
});

test('chooseNode: Wordsmith taken only when the persona has a hone', () => {
  const run = mkRun(); run.nodeEventId = 'wordsmith';
  assert.equal(chooseNode(run, { targetHoneId: 'longWord' }), true);
  assert.equal(chooseNode(run, { targetHoneId: null }), false);
});

test('chooseNode: Ink Merchant needs $5 and relic appetite', () => {
  const run = mkRun(); run.nodeEventId = 'inkMerchant';
  run.coins = 4; assert.equal(chooseNode(run, { targetRelicIds: ['vowelBonus'] }), false);
  run.coins = 5; assert.equal(chooseNode(run, { targetRelicIds: ['vowelBonus'] }), true);
});

test('chooseNode: The Press only for the coin engine (archetype null)', () => {
  const run = mkRun(); run.nodeEventId = 'thePress';
  assert.equal(chooseNode(run, { archetype: null }), true);
  assert.equal(chooseNode(run, { archetype: 'longWord' }), false);
});

test('chooseNodeSmart: shops when a targeted keystone is affordable, else defers to the event heuristic', () => {
  const run = mkRun(); run.nodeEventId = 'wordsmith';
  const persona = { targetRelicIds: ['vowelBonus'], targetHoneId: 'longWord' };
  run.coins = run.config.SHOP.cost.buyRelic;                 // can afford the target relic → shop, skip the event
  assert.equal(chooseNodeSmart(run, persona), false);
  run.coins = 0;                                             // broke → the free event beats an unaffordable shop
  assert.equal(chooseNodeSmart(run, persona), true);         // (wordsmith + hone → aggressive heuristic takes it)
});

test('resolveEventEV: Wordsmith grants a free Refine level to the persona hone', () => {
  const run = mkRun(); run.nodeEventId = 'wordsmith';
  resolveEventEV(run, { targetHoneId: 'longWord' });
  assert.equal(run.honeLevels.longWord, 1);
});

test('resolveEventEV: Redaction removes 2 bag tiles', () => {
  const run = mkRun(); run.nodeEventId = 'redaction';
  const before = run.bag.tiles.length;
  resolveEventEV(run, {});
  assert.equal(run.bag.tiles.length, before - 2);
});

test('resolveEventEV: The Proof with solveProb 1 grants a (random, per proofClaim) unowned relic when the persona wants relics', () => {
  const run = mkRun(); run.nodeEventId = 'theProof';
  const before = run.relics.length;
  resolveEventEV(run, { targetRelicIds: ['vowelBonus'] }, { ...EVENT_EV, proofSolveProb: 1 });
  assert.equal(run.relics.length, before + 1, 'a solve grants one unowned relic (random, matching the real event)');
});

test('resolveEventEV: The Proof with solveProb 0 grants nothing', () => {
  const run = mkRun(); run.nodeEventId = 'theProof';
  const beforeR = run.relics.length, beforeC = run.coins;
  resolveEventEV(run, { targetRelicIds: ['vowelBonus'] }, { ...EVENT_EV, proofSolveProb: 0 });
  assert.equal(run.relics.length, beforeR);
  assert.equal(run.coins, beforeC);
});

test('resolveEventEV: The Proof with no relic appetite grants speed-scaled coins on solve', () => {
  const run = mkRun(); run.nodeEventId = 'theProof';
  const beforeC = run.coins;
  resolveEventEV(run, { targetRelicIds: [] }, { ...EVENT_EV, proofSolveProb: 1, proofAvgGuesses: 4 });
  assert.ok(run.coins > beforeC, 'coins reward on solve when no relic is wanted');
});

test('resolveEventEV: Ink Merchant buys a relic for $5', () => {
  const run = mkRun(); run.nodeEventId = 'inkMerchant'; run.coins = 10;
  const before = run.relics.length;
  resolveEventEV(run, {});
  assert.equal(run.relics.length, before + 1);
  assert.equal(run.coins, 5);
});

test('resolveEventEV is deterministic for a fixed seed', () => {
  const a = mkRun(7); a.nodeEventId = 'theProof';
  const b = mkRun(7); b.nodeEventId = 'theProof';
  resolveEventEV(a, { targetRelicIds: ['vowelBonus'] });
  resolveEventEV(b, { targetRelicIds: ['vowelBonus'] });
  assert.deepEqual(a.relics.map(r => r.id), b.relics.map(r => r.id));
  assert.equal(a.coins, b.coins);
});
