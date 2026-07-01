import { shuffle } from './rng.js';

// Mystery Bag: a per-run randomized letter composition (deterministic for a fixed rng seed). Both the
// vowel/consonant COUNTS and the letter identities are rolled, so bag size and mix vary run to run.
// Vowels are floored (cfg.vowelsMin) so the bag is never vowel-starved - a COMPOSITION floor, distinct
// from (and allowed alongside) the "no drawn-rack vowel guarantee" design rule. Rares (J/Q/X/Z) are
// excluded (they live only in Rare Cache) by simply not being in cfg.consWeights. Letter identities are
// frequency-weighted (cfg.vowelWeights / cfg.consWeights) so a roll rarely bricks; flatten the weights
// for a wilder gamble. `rng` is a seeded [0,1) generator (see makeRng), passed in for determinism.
export function buildMysteryBag(cfg, rng) {
  const roll = (min, max) => min + Math.floor(rng() * (max - min + 1));   // inclusive integer in [min, max]
  const pick = (weights) => {
    const entries = Object.entries(weights);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let x = rng() * total;
    for (const [letter, w] of entries) { x -= w; if (x < 0) return letter; }
    return entries[entries.length - 1][0];                                // float-safety fallback
  };
  const vCount = roll(cfg.vowelsMin, cfg.vowelsMax);
  const cCount = roll(cfg.consMin, cfg.consMax);
  const letters = [];
  for (let i = 0; i < vCount; i++) letters.push(pick(cfg.vowelWeights));
  for (let i = 0; i < cCount; i++) letters.push(pick(cfg.consWeights));
  return letters;
}

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
