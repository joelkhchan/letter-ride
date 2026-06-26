import { makeBag } from './bag.js';
import { makeTile } from './tiles.js';
import { makeRng, shuffle } from './rng.js';
import { validate, isLegalSelection } from './word.js';
import { scoreWord } from './scoring.js';
import { honeModifiers, ARCHETYPES, ALL_ARCHETYPE_IDS } from './archetypes.js';
import { BOSSES, ALL_BOSS_IDS, bossTileValues, applyBossToScore } from './bosses.js';
import { EVENTS, ALL_EVENT_IDS } from './events.js';

// Encounter structure: the target ladder is PASSAGES groups of (Word, Phrase, Sentence).
// roundIndex (0-based) is the flat encounter counter; Passage/tier/boss-ness derive from it.
export const TIERS = ['Word', 'Phrase', 'Sentence'];
export function passageOf(roundIndex) { return Math.floor(roundIndex / 3) + 1; }
export function tierOf(roundIndex) { return TIERS[roundIndex % 3]; }
export function isBossRound(roundIndex) { return roundIndex % 3 === 2; }

// Set run.boss for the current encounter (a boss id on Sentence encounters, else null) and apply
// any setup-time warp (lock). Called at newRun and on each nextRound. The boss OBJECT is BOSSES[run.boss].
function applyEncounterBoss(run) {
  run.boss = null;
  if (!isBossRound(run.roundIndex)) return;
  const passageIdx = passageOf(run.roundIndex) - 1;                     // 0-based passage
  run.boss = (run.bossOrder && run.bossOrder[passageIdx % run.bossOrder.length]) || null;
  const boss = run.boss ? BOSSES[run.boss] : null;
  if (boss && boss.warp.verb === 'lock' && boss.warp.lock === 'discard') run.discardsLeft = Math.min(run.discardsLeft, boss.warp.keep ?? 0);
}

const sumExtraPlays = (relics = []) => relics.reduce((n, r) => n + (r.extraPlays || 0), 0);

// Model B: fill the hand up to RACK_SIZE from the depleting draw-pile.
function refillHand(run) {
  const need = run.config.RACK_SIZE - run.rack.length;
  if (need > 0) run.rack.push(...run.drawPile.splice(0, need));
}

// Dead-hand: a player's turn they can't act on — no legal word and no discard to escape with.
function checkDeadHand(run) {
  if (run.status !== 'playing' || run.discardsLeft > 0) return;
  // A wild ('*') can substitute for any letter, but dictionary.findWord matches literally and
  // can't see wilds — so a hand holding any wild is never declared dead (conservative: wild rescues).
  if (run.rack.some(t => t.letter === '*')) return;
  const word = run.dictionary.findWord(run.rack.map(t => t.letter), run.config.MIN_WORD_LEN);
  if (!word) run.status = 'lost';
}

// Start a round: rebuild the depleting draw-pile from the full owned bag, deal a fresh hand.
export function startRound(run) {
  run.drawPile = shuffle([...run.bag.tiles], run.rng);
  run.rack = [];
  refillHand(run);
}

// Permanent thin alias: re-deal a fresh hand (used by storage.test.js + the eval harness).
export function drawRack(run) { startRound(run); return run.rack; }

export function awardCoins(run) {
  const c = run.config.COINS_ON_CLEAR;
  const i = run.config.INTEREST;
  const interest = (i && i.enabled) ? Math.min(i.cap, Math.floor(run.coins / i.per) * i.rate) : 0;
  const items = [];
  items.push({ label: 'Round clear', amount: c.base });
  if (run.playsLeft > 0) {
    items.push({ label: `${run.playsLeft} unused play${run.playsLeft === 1 ? '' : 's'}`, amount: c.perUnusedPlay * run.playsLeft });
  }
  if (run.discardsLeft > 0) {
    items.push({ label: `${run.discardsLeft} unused discard${run.discardsLeft === 1 ? '' : 's'}`, amount: c.perUnusedDiscard * run.discardsLeft });
  }
  for (const r of run.relics) {
    const amt = r.coinsOnRoundClear?.(run) ?? 0;
    if (amt > 0) items.push({ label: r.name, amount: amt });
  }
  if (interest > 0) items.push({ label: 'Interest', amount: interest });
  const coins = items.reduce((sum, x) => sum + x.amount, 0);
  run.lastAward = items;
  run.coins += coins;
  return coins;
}

export function newRun({ config, dictionary, seed, targets = config.ROUND_TARGETS, deck = null, stake = null, loadout = {} }) {
  const letters = (deck && deck.startingBag) || config.STARTING_BAG;
  const playsPerRound = config.PLAYS_PER_ROUND + (stake?.playsDelta || 0);
  const discardsPerRound = config.DISCARDS_PER_ROUND + (stake?.discardsDelta || 0) + (loadout.extraDiscards || 0);
  const startRelics = [...(loadout.startRelics || [])];
  const run = {
    config, dictionary,
    seed, rng: makeRng(seed),
    targets,
    roundIndex: 0,
    target: targets[0],
    roundTotal: 0,
    playsPerRound,
    discardsPerRound,
    playsLeft: playsPerRound + sumExtraPlays(startRelics) + (loadout.round1ExtraPlay || 0),  // round-1-only loadout bonus; nextRound omits it
    discardsLeft: discardsPerRound,
    bag: makeBag(letters.map(l => makeTile(l))),
    tileValues: { ...config.TILE_VALUES },
    relics: startRelics,
    coins: loadout.startCoins || 0,
    loadoutFreeRerolls: loadout.freeRerolls || 0,   // free shop rerolls granted each shop (loadout)
    freeRerollsLeft: loadout.freeRerolls || 0,
    rack: [],
    drawPile: [],
    honeLevels: {},
    relicState: {},
    wordsPlayedThisRound: 0,
    totalWordsThisRun: 0,
    discardedThisRun: false,
    flawlessSoFar: true,
    archetypeTally: {},
    boughtAnythingThisRun: false,
    chainLength: 0,
    lastWord: null,
    stake, deck,
    status: 'playing',
    bossOrder: shuffle([...ALL_BOSS_IDS], makeRng((seed ^ 0x9e3779b9) >>> 0)),   // seeded, separate stream
    boss: null,
    nodeEventId: null,
  };
  startRound(run);
  applyEncounterBoss(run);
  return run;
}

// Pick which Event is offered alongside the Shop after a cleared encounter.
// Uses a SEPARATE seeded stream (constant 0x5bf03635, distinct from bossOrder's 0x9e3779b9)
// so it does NOT consume run.rng and cannot desync the shop/bag draws.
// Not called by the engine — called by main.js when it detects roundCleared.
export function offerNode(run) {
  run.freeRerollsLeft = run.loadoutFreeRerolls || 0;   // refresh per-shop free rerolls on reaching the node
  const stream = makeRng((run.seed ^ 0x5bf03635 ^ run.roundIndex) >>> 0);
  const eligible = ALL_EVENT_IDS.filter(id => EVENTS[id].canOffer(run));
  run.nodeEventId = eligible.length ? shuffle(eligible, stream)[0] : null;
}

export function playWord(run, selection) {
  if (!isLegalSelection(selection, run.rack)) return { ok: false, reason: 'illegal', run };
  const v = validate(selection, run.dictionary, run.config.MIN_WORD_LEN);
  if (!v.ok) return { ok: false, reason: v.reason, run };
  const enablers = run.relics.filter(r => r.enabler).map(r => r.enabler);
  // Snowball relics ratchet BEFORE scoring so a qualifying word benefits from the stack it just earned.
  run.relicState = run.relicState || {};
  const ratchetLetters = selection.map(s => s.letter.toUpperCase());
  const ratchetCtx = { word: ratchetLetters.join(''), letters: ratchetLetters, selection, wordsPlayedThisRound: run.wordsPlayedThisRound, enablers };
  for (const r of run.relics) {
    if (r.snowball && r.snowball.condition(ratchetCtx)) {
      const st = run.relicState[r.id] || (run.relicState[r.id] = { stacks: 0 });
      st.stacks += 1;
    }
  }
  // Chaining: a word continues the letter-chain when its first spelled letter equals the previous
  // word's last spelled letter (this round). Computed before scoring so chain relics read it.
  const chainFirst = selection[0].letter.toUpperCase();
  const chainLast = selection[selection.length - 1].letter.toUpperCase();
  const chainLength = (run.lastWord && run.lastWord.lastLetter === chainFirst) ? run.chainLength + 1 : 1;
  const boss = run.boss ? BOSSES[run.boss] : null;
  const allMods = [...run.relics, ...honeModifiers(run.honeLevels)];
  const scored0 = scoreWord(selection, {
    tileValues: bossTileValues(run.tileValues, boss),        // disable: vowels zeroed (else same ref)
    lengthBonusPerLetter: run.config.LENGTH_BONUS_PER_LETTER,
    relics: allMods,
    context: { wordsPlayedThisRound: run.wordsPlayedThisRound, enablers, relicState: run.relicState, chainLength },
  });
  const scored = applyBossToScore(scored0, boss);            // cap/tax (else unchanged)
  run.roundTotal += scored.score;
  run.wordsPlayedThisRound += 1;
  run.totalWordsThisRun += 1;
  for (const id of ALL_ARCHETYPE_IDS) {
    if (ARCHETYPES[id].matches(ratchetCtx)) run.archetypeTally[id] = (run.archetypeTally[id] || 0) + 1;
  }
  run.chainLength = chainLength;
  run.lastWord = { lastLetter: chainLast };
  run.playsLeft -= 1;
  // Model B: consume the played tiles from the hand, then refill from the draw-pile.
  const usedIds = new Set(selection.map(s => s.tile.id));
  run.rack = run.rack.filter(t => !usedIds.has(t.id));
  refillHand(run);
  if (run.roundTotal >= run.target) { run.status = 'roundCleared'; if (run.playsLeft <= 0) run.flawlessSoFar = false; if (run.config.COINS_ON_CLEAR) awardCoins(run); }
  else if (run.playsLeft <= 0) run.status = 'lost';
  else checkDeadHand(run);
  return { ok: true, scored, run };
}

export function discard(run, selection = []) {
  if (run.discardsLeft <= 0 || selection.length === 0) return run;
  run.discardsLeft -= 1;
  run.discardedThisRun = true;
  const dropIds = new Set(selection.map(s => s.tile.id));
  run.rack = run.rack.filter(t => !dropIds.has(t.id));
  refillHand(run);
  checkDeadHand(run);
  return run;
}

export function nextRound(run) {
  const next = run.roundIndex + 1;
  if (next >= run.targets.length) { run.status = 'won'; return run; }
  run.roundIndex = next;
  run.target = run.targets[next];
  run.roundTotal = 0;
  run.playsLeft = run.playsPerRound + sumExtraPlays(run.relics);
  run.discardsLeft = run.discardsPerRound;
  run.wordsPlayedThisRound = 0;
  run.chainLength = 0;
  run.lastWord = null;
  run.status = 'playing';
  startRound(run);
  applyEncounterBoss(run);
  return run;
}
