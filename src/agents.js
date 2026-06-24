// src/agents.js — the Agent interface: a bundle of play/discard/shop policies.
// Imports from sim.js (one direction only — sim.js must not import this file).
import { bestPlay, smartDiscard, noShop, randomPlay } from './sim.js';

export function makeAgent({ choosePlay, chooseDiscard, chooseShop }) {
  return { choosePlay, chooseDiscard, chooseShop };
}

export function greedyAgent(shopPolicy = noShop) {
  return makeAgent({ choosePlay: (run, w) => bestPlay(run, w), chooseDiscard: smartDiscard, chooseShop: shopPolicy });
}

export function randomAgent(shopPolicy = noShop) {
  return makeAgent({ choosePlay: (run, w) => randomPlay(run, w), chooseDiscard: smartDiscard, chooseShop: shopPolicy });
}
