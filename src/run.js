import { makeBag } from './bag.js';
import { makeTile } from './tiles.js';
import { makeRng, shuffle } from './rng.js';
import { validate, isLegalSelection } from './word.js';
import { scoreWord } from './scoring.js';
import { honeModifiers } from './archetypes.js';

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
    playsLeft: playsPerRound + sumExtraPlays(startRelics),
    discardsLeft: discardsPerRound,
    bag: makeBag(letters.map(l => makeTile(l))),
    tileValues: { ...config.TILE_VALUES },
    relics: startRelics,
    coins: loadout.startCoins || 0,
    rack: [],
    drawPile: [],
    honeLevels: {},
    relicState: {},
    wordsPlayedThisRound: 0,
    stake, deck,
    status: 'playing',
  };
  startRound(run);
  return run;
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
  const allMods = [...run.relics, ...honeModifiers(run.honeLevels)];
  const scored = scoreWord(selection, {
    tileValues: run.tileValues,
    lengthBonusPerLetter: run.config.LENGTH_BONUS_PER_LETTER,
    relics: allMods,
    context: { wordsPlayedThisRound: run.wordsPlayedThisRound, enablers, relicState: run.relicState },
  });
  run.roundTotal += scored.score;
  run.wordsPlayedThisRound += 1;
  run.playsLeft -= 1;
  // Model B: consume the played tiles from the hand, then refill from the draw-pile.
  const usedIds = new Set(selection.map(s => s.tile.id));
  run.rack = run.rack.filter(t => !usedIds.has(t.id));
  refillHand(run);
  if (run.roundTotal >= run.target) { run.status = 'roundCleared'; if (run.config.COINS_ON_CLEAR) awardCoins(run); }
  else if (run.playsLeft <= 0) run.status = 'lost';
  else checkDeadHand(run);
  return { ok: true, scored, run };
}

export function discard(run, selection = []) {
  if (run.discardsLeft <= 0 || selection.length === 0) return run;
  run.discardsLeft -= 1;
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
  run.status = 'playing';
  startRound(run);
  return run;
}
