// src/tiles.js
import { countOf } from './patterns.js';
import { hasRare } from './archetypes.js';   // wilds-aware rare check, shared with relics (one home)

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const isVowel = (c) => VOWELS.has(String(c).toUpperCase());

let counter = 0;
const MOD_REGISTRY = {
  resonator: {
    id: 'resonator', name: 'Resonator', desc: '+5 Points if the word has 2+ of this letter',
    evaluate: (tile, ctx) => ({ addPoints: countOf(ctx.letters, tile.letter) >= 2 ? 5 : 0 }),
  },
  polished: {
    id: 'polished', name: 'Polished', desc: '+4 Points, always',
    evaluate: () => ({ addPoints: 4 }),
  },
  catalyst: {
    id: 'catalyst', name: 'Catalyst', desc: '+1 Mult, always',
    evaluate: () => ({ addMult: 1 }),
  },
  anchor: {
    id: 'anchor', name: 'Anchor', desc: '+8 Points if this tile is the first letter',
    evaluate: (tile, ctx) => ({ addPoints: ctx.selection[0]?.tile === tile ? 8 : 0 }),
  },
  reprint: {
    id: 'reprint', name: 'Reprint', desc: 'The sort it sits on prints one extra time',
    evaluate: () => ({ retrigger: 1 }),
  },
  // Doubled-archetype enabler: lets the player ENGINEER the doubled condition (a skill lever) rather
  // than wait for the rack to hand it over. Detected in archetypes.isDoubled; no standalone score.
  twin: {
    id: 'twin', name: 'Twin', desc: 'This tile counts as a doubled letter',
    evaluate: () => ({}),
  },
  // Archetype-flavored mods (design-review #4): each rewards its archetype's condition when this tile
  // is played, giving the per-tile layer build identity. Magnitudes are placeholder starting points.
  bloom: {
    id: 'bloom', name: 'Bloom', desc: '+2 Points per vowel in the word',
    evaluate: (tile, ctx) => ({ addPoints: 2 * ctx.letters.filter(isVowel).length }),
  },
  lode: {
    id: 'lode', name: 'Lode', desc: '+15 Points if the word uses J/Q/X/Z',
    evaluate: (tile, ctx) => ({ addPoints: hasRare(ctx) ? 15 : 0 }),
  },
  stretch: {
    id: 'stretch', name: 'Stretch', desc: '+3 Points per letter beyond 4',
    evaluate: (tile, ctx) => ({ addPoints: 3 * Math.max(0, ctx.letters.length - 4) }),
  },
  compact: {
    id: 'compact', name: 'Compact', desc: '+2 Mult if the word is 3 letters or fewer',
    evaluate: (tile, ctx) => ({ addMult: ctx.letters.length <= 3 ? 2 : 0 }),
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
