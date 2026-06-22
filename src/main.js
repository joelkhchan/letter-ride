// src/main.js
import { CONFIG } from './config.js';
import { loadFromFile } from './dictionary.js';
import { newRun, drawRack, playWord, discard, nextRound } from './run.js';
import { saveRun, loadRun } from './storage.js';
import { generateShop, purchase } from './shop.js';
import { RELICS, ALL_RELIC_IDS } from './relics.js';
import { ALL_MOD_IDS } from './tiles.js';
import { saveMeta, loadMeta, metaEarned, poolFromMeta, applyStakeTargets, buildLoadout, metaShopOffers, purchaseMeta } from './meta.js';
import { loadTelemetry, saveTelemetry, recordOffers, recordPurchase, recordPlay, recordRunEnd, summarize } from './telemetry.js';
import { renderRun, renderMeta, bindControls, flashInvalid, handleRunKey } from './ui.js';

try {
  const blocklist = CONFIG.PROFANITY_FILTER ? CONFIG.PROFANITY_BLOCKLIST : [];
  const dictionary = await loadFromFile('assets/enable1.txt', blocklist);
  const meta = loadMeta(window.localStorage, CONFIG);
  let telemetry = loadTelemetry(window.localStorage);
  let run = loadRun(window.localStorage, { config: CONFIG, dictionary });   // resume an in-progress run if any
  let view = run ? 'run' : 'meta';

  function extractOfferIds(shop) {
    return (shop?.offers || []).flatMap(o => {
      if (o.type === 'buyRelic') return [o.relicId];
      if (o.type === 'buyEnchantedTile' || o.type === 'enchantTile') return [o.modId];
      return [];
    });
  }

  const saveAll = () => { saveMeta(meta, window.localStorage); saveTelemetry(telemetry, window.localStorage); if (run) saveRun(run, window.localStorage); };
  const render = () => view === 'run' ? renderRun(run) : renderMeta(meta, CONFIG, ALL_RELIC_IDS, ALL_MOD_IDS, () => summarize(telemetry));
  const pool = () => poolFromMeta(meta);

  function startRun(deckId, stakeId) {
    const deck = CONFIG.DECKS[deckId] || CONFIG.DECKS.standard;
    const stake = CONFIG.STAKES.find(s => s.id === stakeId) || CONFIG.STAKES[0];
    const targets = applyStakeTargets(CONFIG.ROUND_TARGETS, stake);
    const loadout = buildLoadout(meta, CONFIG, RELICS);
    run = newRun({ config: CONFIG, dictionary, seed: Date.now() >>> 0, targets, deck: { startingBag: deck.startingBag }, stake, loadout });
    drawRack(run); view = 'run'; saveAll(); render();
  }
  function endRun() {
    const earned = Math.round(metaEarned(run, CONFIG) * (run.stake?.metaMult || 1));
    meta.meta += earned; run.lastMetaEarned = earned;       // for the meta screen to show
    const ownedIds = [
      ...run.relics.map(r => r.id),
      ...[...new Set(run.bag.tiles.flatMap(t => t.mods.map(m => m.id)))],
    ];
    recordRunEnd(telemetry, { won: run.status === 'won', ownedIds });
    window.localStorage.removeItem('letterRide.run'); run = null; view = 'meta'; saveAll(); render();
  }

  // resume safety: a finished run sitting in storage shouldn't strand the player
  if (run && (run.status === 'roundCleared') && !run.shop) {
    run.shop = generateShop(run, run.rng, pool());
    recordOffers(telemetry, extractOfferIds(run.shop));
  }

  bindControls({
    onSubmit(sel) { const r = playWord(run, sel); if (!r.ok) return flashInvalid(r.reason);
      recordPlay(telemetry, sel.length);
      run.lastPlay = { word: sel.map(s => s.letter).join(''), score: r.scored.score };
      if (run.status === 'roundCleared') {
        run.shop = generateShop(run, run.rng, pool());
        recordOffers(telemetry, extractOfferIds(run.shop));
      }
      if (run.status === 'playing') drawRack(run); saveAll(); render(); return r; },
    onDiscard() { discard(run); saveAll(); render(); },
    onBuy(offer, targetTileId) {
      const r = purchase(run, offer, { targetTileId });
      if (r.ok) {
        if (offer.type === 'buyRelic') recordPurchase(telemetry, offer.relicId);
        else if (offer.type === 'buyEnchantedTile' || offer.type === 'enchantTile') recordPurchase(telemetry, offer.modId);
        run.shop = generateShop(run, run.rng, pool());
        recordOffers(telemetry, extractOfferIds(run.shop));
      }
      saveAll(); render(); return r;
    },
    onReroll() { if (run.coins >= run.shop.rerollCost) { run.coins -= run.shop.rerollCost; run.shop = generateShop(run, run.rng, pool()); recordOffers(telemetry, extractOfferIds(run.shop)); saveAll(); render(); } },
    onContinue() { run.shop = null; nextRound(run); if (run.status === 'playing') drawRack(run); saveAll(); render(); },
    // Hint: delegate dictionary lookup to main (keeps ui.js rules-free).
    onHint() {
      return dictionary.findWord(run.rack.map(t => t.letter), CONFIG.MIN_WORD_LEN);
    },
    // run-end transitions to the meta screen:
    onRunEnd() { endRun(); },
    // meta screen actions:
    onMetaBuy(offer) { const r = purchaseMeta(meta, offer, CONFIG); saveAll(); render(); return r; },
    onStartRun(deckId, stakeId) { startRun(deckId, stakeId); },
  });
  window.addEventListener('keydown', (e) => { if (view === 'run') handleRunKey(e); });
  render();
} catch (err) {
  document.getElementById('app').textContent = 'Failed to start Letter Ride: ' + err.message + ' — check that assets/enable1.txt is present and served.';
}
