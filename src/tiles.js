// src/tiles.js
import { countOf } from './patterns.js';

let counter = 0;
const MOD_REGISTRY = {
  resonator: {
    id: 'resonator', name: 'Resonator', desc: '+5 Wit if the word has 2+ of this letter',
    evaluate: (tile, ctx) => ({ addWit: countOf(ctx.letters, tile.letter) >= 2 ? 5 : 0 }),
  },
  polished: {
    id: 'polished', name: 'Polished', desc: '+4 Wit, always',
    evaluate: () => ({ addWit: 4 }),
  },
  catalyst: {
    id: 'catalyst', name: 'Catalyst', desc: '+1 Mult, always',
    evaluate: () => ({ addMult: 1 }),
  },
  anchor: {
    id: 'anchor', name: 'Anchor', desc: '+8 Wit if this tile is the first letter',
    evaluate: (tile, ctx) => ({ addWit: ctx.selection[0]?.tile === tile ? 8 : 0 }),
  },
};

export const WILD = '*';
export const ALL_MOD_IDS = Object.keys(MOD_REGISTRY);

export function nextId() { return 't' + (counter++); }
export function setMinTileId(n) { if (n + 1 > counter) counter = n + 1; }
export function resetTileIds() { counter = 0; }
export function tileIdNum(id) { return parseInt(String(id).slice(1), 10); }

export function makeTile(letter, mods = [], id = nextId()) {
  return { id, letter, mods };
}

export function isWild(tile) { return tile.letter === WILD; }

export function getMod(id) { return MOD_REGISTRY[id]; }

export function rehydrateTile({ id, letter, modIds = [] }) {
  return { id, letter, mods: modIds.map(getMod).filter(Boolean) };
}
