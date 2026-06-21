// src/meta.js — persistent meta-progression state + earn.
const META_KEY = 'letterRide.meta';

export function makeMetaState(config) {
  const b = config.META.baseUnlocked;
  return {
    meta: 0,
    unlockedRelics: [...b.relics],
    unlockedMods: [...b.mods],
    unlockedDecks: [...b.decks],
    unlockedStakes: [...b.stakes],
    loadout: { extraDiscards: 0, startCoins: 0, startRelic: 0 },
  };
}

export function saveMeta(metaState, storage) {
  storage.setItem(META_KEY, JSON.stringify(metaState));
}

export function loadMeta(storage, config) {
  const raw = storage.getItem(META_KEY);
  if (!raw) return makeMetaState(config);
  try {
    const data = JSON.parse(raw);
    const base = makeMetaState(config);
    return { ...base, ...data, loadout: { ...base.loadout, ...(data.loadout || {}) } };
  } catch {
    return makeMetaState(config);
  }
}

export function metaEarned(run, config) {
  const cleared = run.status === 'won' ? run.targets.length : run.roundIndex;
  const e = config.META.earn;
  return cleared * e.perRoundCleared + (run.status === 'won' ? e.winBonus : 0);
}
