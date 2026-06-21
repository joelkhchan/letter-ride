// src/tiles.js
let counter = 0;
const MOD_REGISTRY = {};            // empty in Tier 0; Tier 1 registers tile-mods here

export const WILD = '*';

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
