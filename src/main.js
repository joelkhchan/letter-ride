// src/main.js
import { CONFIG } from './config.js';
import { loadFromFile } from './dictionary.js';
import { newRun, drawRack, playWord, discard, nextRound } from './run.js';
import { saveRun, loadRun } from './storage.js';
import { renderRun, bindControls, flashInvalid } from './ui.js';
import { generateShop, purchase } from './shop.js';

try {
  const blocklist = CONFIG.PROFANITY_FILTER ? CONFIG.PROFANITY_BLOCKLIST : [];
  const dictionary = await loadFromFile('assets/enable1.txt', blocklist);

  let run = loadRun(window.localStorage, { config: CONFIG, dictionary });   // null on absent/corrupt → fresh
  if (!run) {
    run = newRun({ config: CONFIG, dictionary, seed: Date.now() >>> 0, targets: CONFIG.ROUND_TARGETS });
    drawRack(run);
  }
  // On resume: if round was cleared but shop wasn't serialized, regenerate it.
  if (run.status === 'roundCleared' && !run.shop) {
    run.shop = generateShop(run, run.rng);
  }

  const save = () => saveRun(run, window.localStorage);
  const render = () => renderRun(run);

  bindControls({
    onSubmit(selection) {
      const res = playWord(run, selection);
      if (!res.ok) return flashInvalid(res.reason);
      if (run.status === 'roundCleared') run.shop = generateShop(run, run.rng);
      if (run.status === 'playing') drawRack(run);
      save(); render();
    },
    onDiscard() { discard(run); save(); render(); },
    onBuy(offer, targetTileId) {
      const res = purchase(run, offer, { targetTileId });
      if (res.ok) run.shop = generateShop(run, run.rng);
      save(); render(); return res;
    },
    onReroll() {
      if (run.coins >= run.shop.rerollCost) {
        run.coins -= run.shop.rerollCost;
        run.shop = generateShop(run, run.rng);
        save(); render();
      }
    },
    onContinue() { run.shop = null; nextRound(run); if (run.status === 'playing') drawRack(run); save(); render(); },
    onNewRun() {
      run = newRun({ config: CONFIG, dictionary, seed: Date.now() >>> 0, targets: CONFIG.ROUND_TARGETS });
      drawRack(run); save(); render();
    },
  });
  render();
} catch (err) {
  // Most likely cause: the dictionary asset failed to load (wrong serve root / not committed).
  // Surface it ON THE PAGE — on a phone you won't have a console open.
  document.getElementById('app').textContent =
    'Failed to start Letter Ride: ' + err.message + ' — check that assets/enable1.txt is present and served.';
}
