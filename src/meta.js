// src/meta.js — persistent meta-progression state + earn.
const META_KEY = 'letterRide.meta';

export const META_SCHEMA_VERSION = 2;

export function makeMetaState(config) {
  const b = config.META.baseUnlocked;
  return {
    schemaVersion: META_SCHEMA_VERSION,
    meta: 0,
    unlockedRelics: [...b.relics],
    unlockedMods: [...b.mods],
    unlockedDecks: [...b.decks],
    unlockedStakes: [...b.stakes],
    loadout: { extraDiscards: 0 },
  };
}

export function saveMeta(metaState, storage) {
  storage.setItem(META_KEY, JSON.stringify(metaState));
}

// Historical costs of the removed perks, for one-time refund of already-spent Meta.
const REMOVED_PERK_COST = { startCoins: 8, startRelic: 25 };

export function loadMeta(storage, config) {
  const raw = storage.getItem(META_KEY);
  if (!raw) return makeMetaState(config);
  try {
    const data = JSON.parse(raw);
    const base = makeMetaState(config);
    const merged = { ...base, ...data, loadout: { ...base.loadout, ...(data.loadout || {}) } };
    if ((data.schemaVersion || 0) < META_SCHEMA_VERSION) {
      const lo = data.loadout || {};
      const refund = (lo.startCoins || 0) * REMOVED_PERK_COST.startCoins
                   + (lo.startRelic || 0) * REMOVED_PERK_COST.startRelic;
      merged.meta = (merged.meta || 0) + refund;
      merged.loadout = { extraDiscards: lo.extraDiscards || 0 };   // drop removed keys
      merged.schemaVersion = META_SCHEMA_VERSION;
    }
    return merged;
  } catch {
    return makeMetaState(config);
  }
}

export function metaEarned(run, config) {
  const cleared = run.status === 'won' ? run.targets.length : run.roundIndex;
  const e = config.META.earn;
  return cleared * e.perRoundCleared + (run.status === 'won' ? e.winBonus : 0);
}

export function poolFromMeta(metaState) {
  return { relicIds: metaState.unlockedRelics, modIds: metaState.unlockedMods };
}

export function applyStakeTargets(baseTargets, stake) {
  const mult = stake?.targetMult ?? 1;
  return baseTargets.map(t => Math.ceil(t * mult));
}

export function buildLoadout(metaState, config, RELICS) {
  const lo = metaState.loadout || {};
  return {
    extraDiscards: lo.extraDiscards || 0,
    freeRerolls: lo.freeReroll || 0,
    round1ExtraPlay: lo.round1Play || 0,
    startRelics: [],
  };
}

export function metaShopOffers(metaState, config, allRelicIds, allModIds) {
  const offers = [];
  const c = config.META.unlockCost;
  for (const id of allRelicIds) if (!metaState.unlockedRelics.includes(id)) offers.push({ type: 'unlockRelic', relicId: id, cost: c.relic });
  for (const id of allModIds) if (!metaState.unlockedMods.includes(id)) offers.push({ type: 'unlockMod', modId: id, cost: c.mod });
  for (const id of Object.keys(config.DECKS)) if (!metaState.unlockedDecks.includes(id)) offers.push({ type: 'unlockDeck', deckId: id, cost: c.deck });
  for (const s of config.STAKES) if (!metaState.unlockedStakes.includes(s.id)) offers.push({ type: 'unlockStake', stakeId: s.id, cost: c.stake });
  for (const key of Object.keys(config.LOADOUT)) if ((metaState.loadout[key] || 0) < config.LOADOUT[key].max) offers.push({ type: 'loadout', key, cost: config.LOADOUT[key].cost });
  return offers;
}

export function purchaseMeta(metaState, offer, config) {
  if (metaState.meta < offer.cost) return { ok: false, reason: 'broke' };
  const addUnique = (arr, id) => { if (arr.includes(id)) return false; arr.push(id); return true; };
  switch (offer.type) {
    case 'unlockRelic': if (!addUnique(metaState.unlockedRelics, offer.relicId)) return { ok: false, reason: 'owned' }; break;
    case 'unlockMod':   if (!addUnique(metaState.unlockedMods, offer.modId))   return { ok: false, reason: 'owned' }; break;
    case 'unlockDeck':  if (!addUnique(metaState.unlockedDecks, offer.deckId)) return { ok: false, reason: 'owned' }; break;
    case 'unlockStake': if (!addUnique(metaState.unlockedStakes, offer.stakeId)) return { ok: false, reason: 'owned' }; break;
    case 'loadout': {
      const cur = metaState.loadout[offer.key] || 0;
      if (cur >= config.LOADOUT[offer.key].max) return { ok: false, reason: 'maxed' };
      metaState.loadout[offer.key] = cur + 1;
      break;
    }
    default: return { ok: false, reason: 'unknown' };
  }
  metaState.meta -= offer.cost;
  return { ok: true };
}
