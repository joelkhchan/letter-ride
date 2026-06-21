import { shuffle } from './rng.js';

export function makeBag(tiles) {
  const state = { tiles: [...tiles] };
  return {
    get tiles() { return state.tiles; },
    draw(n, rng) { return shuffle(state.tiles, rng).slice(0, Math.min(n, state.tiles.length)); },
    add(tile) { state.tiles.push(tile); },
    remove(tileId) {
      const i = state.tiles.findIndex(t => t.id === tileId);
      if (i >= 0) state.tiles.splice(i, 1);
    },
  };
}
