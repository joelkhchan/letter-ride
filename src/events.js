// src/events.js — run nodes: events are a between-encounter choice vs the Shop.
// One-shot events resolve on pick; The Press (Task 2) is interactive. Seeded mutators (draw from run.rng).
import { makeTile, WILD } from './tiles.js';
import { RELICS, ALL_RELIC_IDS } from './relics.js';
import { shuffle } from './rng.js';

// helper: pick N distinct random tiles from the bag via run.rng
function pickRandomTiles(run, n) {
  return shuffle([...run.bag.tiles], run.rng).slice(0, n);
}

export const EVENTS = {
  theBlank: {
    id: 'theBlank', name: 'The Blank',
    desc: 'Swap 3 random tiles in your bag for 1 Wild',
    options: [{ label: 'Swap 3 tiles for a Wild', apply: (run) => {
      const victims = pickRandomTiles(run, 3);
      for (const t of victims) run.bag.remove(t.id);
      run.bag.add(makeTile(WILD));
    } }],
    canOffer: (run) => run.bag.tiles.length > run.config.RACK_SIZE + 3,
  },
  wordsmith: {
    id: 'wordsmith', name: 'Wordsmith',
    desc: 'Gain a free Hone level for an archetype you choose',
    options: [{ label: 'Hone an archetype (free)', apply: (run, opts) => {
      const arch = opts?.archetypeId;
      if (!arch) return { ok: false, reason: 'no-target' };
      if (!run.honeLevels) run.honeLevels = {};
      run.honeLevels[arch] = (run.honeLevels[arch] || 0) + 1;
    } }],
    canOffer: () => true,
  },
  redaction: {
    id: 'redaction', name: 'Redaction',
    desc: 'Remove 2 tiles of your choice from your bag',
    options: [{ label: 'Remove 2 tiles (free)', apply: (run, opts) => {
      const ids = opts?.tileIds || [];
      if (ids.length !== 2) return { ok: false, reason: 'need-2' };
      for (const id of ids) run.bag.remove(id);
    } }],
    canOffer: (run) => run.bag.tiles.length > run.config.RACK_SIZE + 2,
  },
  inkMerchant: {
    id: 'inkMerchant', name: 'Ink Merchant',
    desc: 'Pay $5: gain a random relic you do not own',
    options: [{ label: 'Pay $5 for a random relic', apply: (run) => {
      if (run.coins < 5) return { ok: false, reason: 'broke' };
      const owned = new Set(run.relics.map(r => r.id));
      const pool = ALL_RELIC_IDS.filter(id => !owned.has(id));
      if (!pool.length) return { ok: false, reason: 'all-owned' };
      const pick = shuffle(pool, run.rng)[0];
      run.coins -= 5;
      run.relics.push(RELICS[pick]);
    } }],
    canOffer: (run) => run.coins >= 5 && run.relics.length < ALL_RELIC_IDS.length,
  },
  // thePress added in Task 2
};

export const ALL_EVENT_IDS = Object.keys(EVENTS);

export function applyEventOption(run, eventId, optionIndex, opts = {}) {
  const ev = EVENTS[eventId];
  if (!ev) return { ok: false, reason: 'unknown' };
  const opt = ev.options?.[optionIndex];
  if (!opt) return { ok: false, reason: 'no-option' };
  const r = opt.apply(run, opts);
  return r && r.ok === false ? r : { ok: true };
}
