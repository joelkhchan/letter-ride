// src/storage.js
import { makeBag } from './bag.js';
import { makeRng } from './rng.js';
import { rehydrateTile, setMinTileId, tileIdNum } from './tiles.js';
import { RELICS } from './relics.js';

const KEY = 'letterRide.run';

export function serializeRun(run) {
  return {
    version: 8,                                          // bump when the schema changes
    seed: run.seed,
    rngState: run.rng.getState(),
    targets: run.targets,
    endless: run.endless ?? false,                       // endless-mode flag + round counter (persist mid-endless)
    endlessRound: run.endlessRound || 0,
    wonBase: run.wonBase ?? false,                       // base run cleared (an endless loss still records a win)
    wordle: run.wordle ?? null,                          // The Proof mid-event state (target/guesses/status)
    loadoutMetaPenalty: run.loadoutMetaPenalty || 0,     // Meta deducted at run end for opted-in perks
    roundIndex: run.roundIndex,
    target: run.target,
    roundTotal: run.roundTotal,
    playsLeft: run.playsLeft,
    discardsLeft: run.discardsLeft,
    playsPerRound: run.playsPerRound,
    discardsPerRound: run.discardsPerRound,
    wordsPlayedThisRound: run.wordsPlayedThisRound,
    totalWordsThisRun: run.totalWordsThisRun ?? 0,
    discardedThisRun: run.discardedThisRun ?? false,
    flawlessSoFar: run.flawlessSoFar ?? true,
    archetypeTally: run.archetypeTally ?? {},
    boughtAnythingThisRun: run.boughtAnythingThisRun ?? false,
    coins: run.coins,
    status: run.status,
    stake: run.stake,
    deck: run.deck,
    tileValues: { ...run.tileValues },
    relicIds: run.relics.map(r => r.id),                 // empty in Tier 0
    tiles: run.bag.tiles.map(t => ({ id: t.id, letter: t.letter, modIds: t.mods.map(m => m.id) })),
    rackIds: run.rack.map(t => t.id),
    drawPileIds: run.drawPile.map(t => t.id),
    lastAward: run.lastAward || null,
    honeLevels: run.honeLevels || {},
    relicState: run.relicState || {},
    boss: run.boss ?? null,
    bossOrder: run.bossOrder || [],
    censorLetter: run.censorLetter ?? null,             // The Censor's chosen zeroed letter (persist mid-round)
    upgradeCounts: run.upgradeCounts || {},             // per-letter upgrade tally (escalating cost)
    usedImprint: run.usedImprint ?? false,              // Mass Production achievement flag
    nodeEventId: run.nodeEventId ?? null,
    nodeResolved: run.nodeResolved ?? false,
    chainLength: run.chainLength ?? 0,
    lastWord: run.lastWord ?? null,
  };
}

export function deserializeRun(data, { config, dictionary }) {
  const tiles = data.tiles.map(rehydrateTile);
  const maxId = tiles.reduce((m, t) => Math.max(m, tileIdNum(t.id)), -1);
  setMinTileId(maxId);
  const byId = new Map(tiles.map(t => [t.id, t]));
  const rng = makeRng(data.seed);
  rng.setState(data.rngState);
  return {
    config, dictionary,
    seed: data.seed, rng,
    targets: data.targets,
    endless: data.endless ?? false,
    endlessRound: data.endlessRound || 0,
    wonBase: data.wonBase ?? false,
    wordle: data.wordle ?? null,
    loadoutMetaPenalty: data.loadoutMetaPenalty || 0,
    roundIndex: data.roundIndex,
    target: data.target,
    roundTotal: data.roundTotal,
    playsLeft: data.playsLeft,
    discardsLeft: data.discardsLeft,
    playsPerRound: data.playsPerRound ?? config.PLAYS_PER_ROUND,
    discardsPerRound: data.discardsPerRound ?? config.DISCARDS_PER_ROUND,
    wordsPlayedThisRound: data.wordsPlayedThisRound,
    totalWordsThisRun: data.totalWordsThisRun ?? 0,
    discardedThisRun: data.discardedThisRun ?? false,
    flawlessSoFar: data.flawlessSoFar ?? true,
    archetypeTally: data.archetypeTally ?? {},
    boughtAnythingThisRun: data.boughtAnythingThisRun ?? false,
    coins: data.coins,
    status: data.status,
    stake: data.stake,
    deck: data.deck,
    tileValues: { ...data.tileValues },
    relics: (data.relicIds || []).map(id => RELICS[id]).filter(Boolean),
    bag: makeBag(tiles),
    rack: data.rackIds.map(id => byId.get(id)).filter(Boolean),
    drawPile: (data.drawPileIds || []).map(id => byId.get(id)).filter(Boolean),
    lastAward: data.lastAward || null,
    honeLevels: data.honeLevels || {},
    relicState: data.relicState || {},
    boss: data.boss ?? null,
    bossOrder: data.bossOrder || [],
    censorLetter: data.censorLetter ?? null,
    upgradeCounts: data.upgradeCounts || {},
    usedImprint: data.usedImprint ?? false,
    nodeEventId: data.nodeEventId ?? null,
    nodeResolved: data.nodeResolved ?? false,
    chainLength: data.chainLength ?? 0,
    lastWord: data.lastWord ?? null,
  };
}

export function saveRun(run, storage) {
  storage.setItem(KEY, JSON.stringify(serializeRun(run)));
}

export function loadRun(storage, deps) {
  const raw = storage.getItem(KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data.version !== 8) return null;     // schema changed → treat as no save (graceful drop)
    return deserializeRun(data, deps);
  } catch {
    return null;                             // corrupt save → start fresh, never brick the page
  }
}
