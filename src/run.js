import { makeBag } from './bag.js';
import { makeTile } from './tiles.js';
import { makeRng } from './rng.js';
import { validate, isLegalSelection } from './word.js';
import { scoreWord } from './scoring.js';

export function awardCoins(run) {
  const c = run.config.COINS_ON_CLEAR;
  let coins = c.base + c.perUnusedPlay * run.playsLeft + c.perUnusedDiscard * run.discardsLeft;
  for (const r of run.relics) coins += r.coinsOnRoundClear?.(run) ?? 0;
  run.coins += coins;
  return coins;
}

export function newRun({ config, dictionary, seed, targets = config.ROUND_TARGETS, deck = null, stake = null, loadout = {} /* reserved for Tier 2 loadout boosts (Task 19) */ }) {
  const letters = (deck && deck.startingBag) || config.STARTING_BAG;
  return {
    config, dictionary,
    seed, rng: makeRng(seed),
    targets,
    roundIndex: 0,
    target: targets[0],
    roundTotal: 0,
    playsLeft: config.PLAYS_PER_ROUND,
    discardsLeft: config.DISCARDS_PER_ROUND,
    bag: makeBag(letters.map(l => makeTile(l))),
    tileValues: { ...config.TILE_VALUES },
    relics: [],
    coins: 0,
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
  run.roundTotal += scored.points;
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
  run.playsLeft = run.config.PLAYS_PER_ROUND;
  run.discardsLeft = run.config.DISCARDS_PER_ROUND;
  run.wordsPlayedThisRound = 0;
  run.status = 'playing';
  return run;
}
