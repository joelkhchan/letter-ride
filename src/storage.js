// src/storage.js
import { makeBag } from './bag.js';
import { makeRng } from './rng.js';
import { rehydrateTile, setMinTileId, tileIdNum } from './tiles.js';
import { RELICS } from './relics.js';

const KEY = 'letterRide.run';

export function serializeRun(run) {
  return {
    version: 1,                                          // bump when the schema changes
    seed: run.seed,
    rngState: run.rng.getState(),
    targets: run.targets,
    roundIndex: run.roundIndex,
    target: run.target,
    roundTotal: run.roundTotal,
    playsLeft: run.playsLeft,
    discardsLeft: run.discardsLeft,
    playsPerRound: run.playsPerRound,
    discardsPerRound: run.discardsPerRound,
    wordsPlayedThisRound: run.wordsPlayedThisRound,
    coins: run.coins,
    status: run.status,
    stake: run.stake,
    deck: run.deck,
    tileValues: { ...run.tileValues },
    relicIds: run.relics.map(r => r.id),                 // empty in Tier 0
    tiles: run.bag.tiles.map(t => ({ id: t.id, letter: t.letter, modIds: t.mods.map(m => m.id) })),
    rackIds: run.rack.map(t => t.id),
    lastAward: run.lastAward || null,
    honeLevels: run.honeLevels || {},
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
    roundIndex: data.roundIndex,
    target: data.target,
    roundTotal: data.roundTotal,
    playsLeft: data.playsLeft,
    discardsLeft: data.discardsLeft,
    playsPerRound: data.playsPerRound ?? config.PLAYS_PER_ROUND,
    discardsPerRound: data.discardsPerRound ?? config.DISCARDS_PER_ROUND,
    wordsPlayedThisRound: data.wordsPlayedThisRound,
    coins: data.coins,
    status: data.status,
    stake: data.stake,
    deck: data.deck,
    tileValues: { ...data.tileValues },
    relics: (data.relicIds || []).map(id => RELICS[id]).filter(Boolean),
    bag: makeBag(tiles),
    rack: data.rackIds.map(id => byId.get(id)).filter(Boolean),
    lastAward: data.lastAward || null,
    honeLevels: data.honeLevels || {},
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
    if (data.version !== 1) return null;     // schema changed → treat as no save
    return deserializeRun(data, deps);
  } catch {
    return null;                             // corrupt save → start fresh, never brick the page
  }
}
