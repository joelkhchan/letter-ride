import { makeBag } from './bag.js';
import { makeTile } from './tiles.js';
import { makeRng } from './rng.js';
import { validate, isLegalSelection } from './word.js';
import { scoreWord } from './scoring.js';

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
  return {
    config, dictionary,
    seed, rng: makeRng(seed),
    targets,
    roundIndex: 0,
    target: targets[0],
    roundTotal: 0,
    playsPerRound,
    discardsPerRound,
    playsLeft: playsPerRound,
    discardsLeft: discardsPerRound,
    bag: makeBag(letters.map(l => makeTile(l))),
    tileValues: { ...config.TILE_VALUES },
    relics: [...(loadout.startRelics || [])],
    coins: loadout.startCoins || 0,
    rack: [],
    wordsPlayedThisRound: 0,
    stake, deck,
    status: 'playing',
  };
}

export function drawRack(run) {
  run.rack = run.bag.draw(run.config.RACK_SIZE, run.rng);
  return run.rack;
}

export function playWord(run, selection) {
  if (!isLegalSelection(selection, run.rack)) return { ok: false, reason: 'illegal', run };
  const v = validate(selection, run.dictionary, run.config.MIN_WORD_LEN);
  if (!v.ok) return { ok: false, reason: v.reason, run };
  const scored = scoreWord(selection, {
    tileValues: run.tileValues,
    lengthBonusPerLetter: run.config.LENGTH_BONUS_PER_LETTER,
    relics: run.relics,
    context: { wordsPlayedThisRound: run.wordsPlayedThisRound },
  });
  run.roundTotal += scored.score;
  run.wordsPlayedThisRound += 1;
  run.playsLeft -= 1;
  if (run.roundTotal >= run.target) { run.status = 'roundCleared'; if (run.config.COINS_ON_CLEAR) awardCoins(run); }
  else if (run.playsLeft <= 0) run.status = 'lost';
  return { ok: true, scored, run };
}

export function discard(run) {
  if (run.discardsLeft > 0) { run.discardsLeft -= 1; drawRack(run); }
  return run;
}

export function nextRound(run) {
  const next = run.roundIndex + 1;
  if (next >= run.targets.length) { run.status = 'won'; return run; }
  run.roundIndex = next;
  run.target = run.targets[next];
  run.roundTotal = 0;
  run.playsLeft = run.playsPerRound;
  run.discardsLeft = run.discardsPerRound;
  run.wordsPlayedThisRound = 0;
  run.status = 'playing';
  return run;
}
