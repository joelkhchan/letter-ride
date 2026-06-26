// src/shop.js — in-run shop generation + purchases (Coins).
import { shuffle } from './rng.js';
import { makeTile, getMod, ALL_MOD_IDS } from './tiles.js';
import { RELICS, ALL_RELIC_IDS } from './relics.js';
import { ALL_ARCHETYPE_IDS } from './archetypes.js';

const RARE_LETTERS = new Set(['J', 'Q', 'X', 'Z']);
const COUNT_MODS = new Set(['resonator']);  // value needs 2+ of the tile's OWN letter

// Build the candidate offer list, then sample offersPerShop of them deterministically.
export function generateShop(run, rng, pool = {}) {
  const cfg = run.config.SHOP;
  const relicIds = pool.relicIds || ALL_RELIC_IDS;
  const modIds = pool.modIds || ALL_MOD_IDS;
  const owned = new Set(run.relics.map(r => r.id));
  const candidates = [];
  for (const letter of cfg.buyableLetters) candidates.push({ type: 'buyLetter', letter, cost: cfg.cost.buyLetter });
  for (const letter of cfg.buyableLetters) for (const modId of modIds) {
    // Count-based mods (e.g. Resonator: +Points for 2+ of this letter) are a dead enchant on a rare
    // letter - you almost never draw two J/Q/X/Z - so skip those pairings.
    if (RARE_LETTERS.has(letter) && COUNT_MODS.has(modId)) continue;
    candidates.push({ type: 'buyEnchantedTile', letter, modId, cost: cfg.cost.buyEnchantedTile });
  }
  for (const modId of modIds) candidates.push({ type: 'enchantTile', modId, cost: cfg.cost.enchantTile });
  for (const letter of cfg.buyableLetters) candidates.push({ type: 'upgradeLetter', letter, plus: cfg.upgradePlus, cost: cfg.cost.upgradeLetter });
  candidates.push({ type: 'thinLetter', cost: cfg.cost.thinLetter });
  candidates.push({ type: 'recastTile', cost: cfg.cost.recastTile });
  candidates.push({ type: 'transferMods', cost: cfg.cost.transferMods });
  for (const relicId of relicIds) if (!owned.has(relicId)) candidates.push({ type: 'buyRelic', relicId, cost: cfg.cost.buyRelic });
  for (const archetypeId of ALL_ARCHETYPE_IDS) candidates.push({ type: 'hone', archetypeId, cost: run.config.HONE.cost });

  const offers = shuffle(candidates, rng).slice(0, Math.min(cfg.offersPerShop, candidates.length));
  return { offers, rerollCost: cfg.rerollCost };
}

export function purchase(run, offer, opts = {}) {
  if (run.purchaseLog) {
    run.purchaseLog.push(
      offer.type === 'buyRelic' ? `relic:${offer.relicId}`
      : offer.type === 'hone' ? `hone:${offer.archetypeId}`
      : offer.type
    );
  }
  if (run.coins < offer.cost) return { ok: false, reason: 'broke' };
  const findTarget = () => run.bag.tiles.find(t => t.id === opts.targetTileId);
  switch (offer.type) {
    case 'buyLetter':
      run.bag.add(makeTile(offer.letter)); break;
    case 'buyEnchantedTile':
      run.bag.add(makeTile(offer.letter, [getMod(offer.modId)])); break;
    case 'enchantTile': {
      const t = findTarget(); if (!t) return { ok: false, reason: 'no-target' };
      t.mods.push(getMod(offer.modId)); break;
    }
    case 'upgradeLetter':
      run.tileValues[offer.letter] = (run.tileValues[offer.letter] || 0) + offer.plus; break;
    case 'thinLetter': {
      const t = findTarget(); if (!t) return { ok: false, reason: 'no-target' };
      run.bag.remove(t.id); break;
    }
    case 'recastTile': {
      const t = findTarget(); if (!t) return { ok: false, reason: 'no-target' };
      if (!run.config.SHOP.buyableLetters.includes(opts.targetLetter)) return { ok: false, reason: 'bad-letter' };
      t.letter = opts.targetLetter; break;
    }
    case 'transferMods': {
      const src = run.bag.tiles.find(t => t.id === opts.sourceTileId);
      const tgt = run.bag.tiles.find(t => t.id === opts.targetTileId);
      if (!src || !tgt) return { ok: false, reason: 'no-target' };
      if (src.id === tgt.id) return { ok: false, reason: 'same-tile' };
      tgt.mods.push(...src.mods);
      run.bag.remove(src.id); break;
    }
    case 'buyRelic':
      if (run.relics.some(r => r.id === offer.relicId)) return { ok: false, reason: 'owned' };
      run.relics.push(RELICS[offer.relicId]); break;
    case 'hone': {
      if (!run.honeLevels) run.honeLevels = {};
      run.honeLevels[offer.archetypeId] = (run.honeLevels[offer.archetypeId] || 0) + 1; break;
    }
    default:
      return { ok: false, reason: 'unknown' };
  }
  run.coins -= offer.cost;
  return { ok: true };
}
