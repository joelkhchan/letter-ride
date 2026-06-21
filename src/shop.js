// src/shop.js — in-run shop generation + purchases (Coins).
import { shuffle } from './rng.js';
import { makeTile, getMod, ALL_MOD_IDS } from './tiles.js';
import { RELICS, ALL_RELIC_IDS } from './relics.js';

// Build the candidate offer list, then sample offersPerShop of them deterministically.
export function generateShop(run, rng, pool = {}) {
  const cfg = run.config.SHOP;
  const relicIds = pool.relicIds || ALL_RELIC_IDS;
  const modIds = pool.modIds || ALL_MOD_IDS;
  const candidates = [];
  for (const letter of cfg.buyableLetters) candidates.push({ type: 'buyLetter', letter, cost: cfg.cost.buyLetter });
  for (const letter of cfg.buyableLetters) for (const modId of modIds)
    candidates.push({ type: 'buyEnchantedTile', letter, modId, cost: cfg.cost.buyEnchantedTile });
  for (const modId of modIds) candidates.push({ type: 'enchantTile', modId, cost: cfg.cost.enchantTile });
  for (const letter of cfg.buyableLetters) candidates.push({ type: 'upgradeLetter', letter, plus: cfg.upgradePlus, cost: cfg.cost.upgradeLetter });
  for (const letter of cfg.buyableLetters) candidates.push({ type: 'thinLetter', letter, cost: cfg.cost.thinLetter });
  for (const relicId of relicIds) candidates.push({ type: 'buyRelic', relicId, cost: cfg.cost.buyRelic });

  const offers = shuffle(candidates, rng).slice(0, Math.min(cfg.offersPerShop, candidates.length));
  return { offers, rerollCost: cfg.rerollCost };
}

export function purchase(run, offer, opts = {}) {
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
    case 'buyRelic':
      run.relics.push(RELICS[offer.relicId]); break;
    default:
      return { ok: false, reason: 'unknown' };
  }
  run.coins -= offer.cost;
  return { ok: true };
}
