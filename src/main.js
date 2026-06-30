// src/main.js
import { CONFIG } from './config.js';
import { loadFromFile } from './dictionary.js';
import { newRun, playWord, discard, nextRound, offerNode, isBossRound } from './run.js';
import { ALL_BOSS_IDS } from './bosses.js';
import { saveRun, loadRun } from './storage.js';
import { generateShop, purchase } from './shop.js';
import { RELICS, ALL_RELIC_IDS } from './relics.js';
import { ALL_MOD_IDS } from './tiles.js';
import { saveMeta, loadMeta, metaEarned, poolFromMeta, applyStakeTargets, buildLoadout, metaShopOffers, purchaseMeta } from './meta.js';
import { loadTelemetry, saveTelemetry, recordOffers, recordPurchase, recordPlay, recordDiscard, recordRunEnd, summarize } from './telemetry.js';
import { loadProfile, saveProfile, recordPlay as profileRecordPlay, recordRunEnd as profileRecordRunEnd } from './profile.js';
import { ACHIEVEMENTS, checkAchievements, grantBounties, collectAchievement, collectBounty, pendingCount } from './achievements.js';
import { EVENTS, applyEventOption, pressStart, pressDraw, pressBank } from './events.js';
import { renderRun, renderSetup, renderMetaShop, renderMenu, renderSettings, renderAchievements, renderStats, renderTelemetry, achievementToast, bindControls, flashInvalid, handleRunKey, isPulling, animatePull, showConfirm } from './ui.js';
import { play as sfx, resumeAudio } from './audio.js';
import { logEvent } from './playlog.js';
import { applyDisplayPrefs } from './settings.js';
import { initUpdater } from './updater.js';

try {
  initUpdater();   // OTA self-update check on launch (Android only; a no-op on the web)
  const blocklist = CONFIG.PROFANITY_FILTER ? CONFIG.PROFANITY_BLOCKLIST : [];
  const dictionary = await loadFromFile('assets/enable1.txt', blocklist);
  const meta = loadMeta(window.localStorage, CONFIG);
  let telemetry = loadTelemetry(window.localStorage);
  const profile = loadProfile(window.localStorage);
  let run = loadRun(window.localStorage, { config: CONFIG, dictionary });   // resume an in-progress run if any
  let view = 'menu';   // boot to the main menu; Resume picks up an in-progress run
  let settingsReturn = 'menu';   // where the Settings back-arrow returns to (the run if opened mid-run, else menu)
  // Compact run snapshot attached to each logged event (dev playtest log; see src/playlog.js).
  const snap = () => run ? { round: run.roundIndex, target: run.target, roundTotal: run.roundTotal, coins: run.coins, plays: run.playsLeft, discards: run.discardsLeft, boss: run.boss || null, chain: run.chainLength || 1 } : {};

  function extractOfferIds(shop) {
    return (shop?.offers || []).flatMap(o => {
      if (o.type === 'buyRelic') return [o.relicId];
      if (o.type === 'buyEnchantedTile' || o.type === 'enchantTile') return [o.modId];
      return [];
    });
  }

  const saveAll = () => { saveMeta(meta, window.localStorage); saveTelemetry(telemetry, window.localStorage); saveProfile(profile, window.localStorage); if (run) saveRun(run, window.localStorage); };

  // Mark newly-completed achievements. Meta is NOT paid here: the player collects it on the
  // Achievements screen (onCollectAchievement / onCollectBounty). The visual unlock toast is
  // added with the deferred achievements UI task.
  function markCompletions(list) {
    for (const a of list) if (!profile.completed.includes(a.id)) { profile.completed.push(a.id); achievementToast(a); }
  }
  const render = () => {
    if (view === 'run') return renderRun(run, profile);
    if (view === 'setup') return renderSetup(meta, CONFIG, profile);
    if (view === 'meta') return renderMetaShop(meta, CONFIG, ALL_RELIC_IDS, ALL_MOD_IDS);
    if (view === 'settings') return renderSettings(!!run);
    if (view === 'achievements') return renderAchievements(profile, CONFIG, ACHIEVEMENTS, ALL_RELIC_IDS, ALL_MOD_IDS);
    if (view === 'stats') return renderStats(profile, CONFIG, ALL_RELIC_IDS, ALL_MOD_IDS, ACHIEVEMENTS);
    if (view === 'telemetry') return renderTelemetry(summarize(telemetry));
    return renderMenu(!!run, meta.meta, pendingCount(profile, CONFIG));   // 'menu' (badge = items ready to collect)
  };
  const pool = () => poolFromMeta(meta);

  function startRun(deckId, stakeId) {
    const deck = CONFIG.DECKS[deckId] || CONFIG.DECKS.standard;
    const stake = CONFIG.STAKES.find(s => s.id === stakeId) || CONFIG.STAKES[0];
    const targets = applyStakeTargets(CONFIG.ROUND_TARGETS, stake);
    const loadout = buildLoadout(meta, CONFIG, RELICS);
    run = newRun({ config: CONFIG, dictionary, seed: Date.now() >>> 0, targets, deck: { id: deck.id, startingBag: deck.startingBag }, stake, loadout });
    logEvent('run_start', { deck: deckId, stake: stakeId, targets: run.targets, relics: run.relics.map(r => r.id), bagSize: run.bag.tiles.length });
    view = 'run'; saveAll(); render();
  }
  function endRun() {
    const earned = metaEarned(run, CONFIG);                 // stake metaMult removed; bounties replace it
    const relicIds = run.relics.map(r => r.id);
    const modIds = [...new Set(run.bag.tiles.flatMap(t => t.mods.map(m => m.id)))];
    recordRunEnd(telemetry, { won: run.status === 'won', ownedIds: [...relicIds, ...modIds] });
    const won = run.status === 'won';
    const roundsCleared = won ? run.targets.length : run.roundIndex;
    // Update lifetime sets FIRST so completeness predicates (curator/enchanter) see this run's ids.
    profileRecordRunEnd(profile, { won, roundsCleared, runScore: run.roundTotal, relicIds, modIds, archetypeTally: run.archetypeTally });
    if (won) grantBounties(profile, run.stake?.id ?? 0, run.deck?.id ?? null);   // mark earned; collected later
    markCompletions(checkAchievements(profile, {
      phase: 'end', won, roundIndex: run.roundIndex,
      boughtAnythingThisRun: !!run.boughtAnythingThisRun,
      discardedThisRun: !!run.discardedThisRun,
      totalWordsThisRun: run.totalWordsThisRun || 0,
      flawlessSoFar: run.flawlessSoFar !== false,
      archetypeTally: run.archetypeTally || {},
      relicsCount: relicIds.length, modsCount: modIds.length,
      stakeId: run.stake?.id ?? 0,
      usedImprint: !!run.usedImprint,
      bossCount: ALL_BOSS_IDS.length,
      allRelicIds: ALL_RELIC_IDS, allModIds: ALL_MOD_IDS,
    }, CONFIG));
    meta.meta += earned; run.lastMetaEarned = earned;   // base drip auto-pays; achievement/bounty Meta is collected on the Achievements screen
    logEvent('run_end', { won, roundsCleared, runScore: run.roundTotal, relics: relicIds, mods: modIds, metaEarned: earned });
    window.localStorage.removeItem('letterRide.run'); run = null; view = 'menu'; saveAll(); render();
  }

  // resume safety: a finished run sitting in storage shouldn't strand the player
  if (run && run.status === 'roundCleared' && run.roundIndex + 1 >= run.targets.length) {
    nextRound(run);   // final round was cleared but not advanced — go straight to the win screen, no node
  }
  if (run && (run.status === 'roundCleared') && !run.shop && !run.nodeEventId && run.nodeEventId !== null) {
    // nodeEventId not yet set — call offerNode to establish it
    offerNode(run);
  }
  if (run && (run.status === 'roundCleared') && !run.shop && run.nodeEventId === null) {
    // no eligible event — go straight to shop
    run.shop = generateShop(run, run.rng, pool());
    recordOffers(telemetry, extractOfferIds(run.shop));
  }

  // Clear the node state and advance to the next round. Shared by onContinue (shop/Press) and
  // onEventOption (so resolving a standard event jumps straight to the next round, no middle screen).
  const advanceRound = () => {
    run.nodeEventId = null; run._nodePick = null; run.press = null; run._pressLastPot = null; run.shop = null; run.nodeResolved = false;
    nextRound(run);
    if (isBossRound(run.roundIndex)) sfx('boss');
    logEvent('round_advance', { round: run.roundIndex, boss: run.boss || null, ...snap() });
  };

  bindControls({
    onSubmit(sel) { if (isPulling()) return;
      const r = playWord(run, sel);
      if (!r.ok) {
        logEvent('invalid', { word: sel.map(s => s.letter).join('').toUpperCase(), letters: sel.map(s => s.letter.toUpperCase()), reason: r.reason, ...snap() });
        return flashInvalid(r.reason);
      }
      recordPlay(telemetry, { letters: sel.map(s => s.letter.toUpperCase()), word: sel.map(s => s.letter).join('').toUpperCase(), selection: sel, wordsPlayedThisRound: run.wordsPlayedThisRound, enablers: run.relics.filter(rv => rv.enabler).map(rv => rv.enabler) }, r.scored?.score ?? 0);
      const playedWord = sel.map(s => s.letter).join('');
      run.lastPlay = { word: playedWord, score: r.scored.score, coins: r.coinsEarned || 0 };
      // Track the run's best line for the end-of-run broadside (in-memory; not persisted).
      if (!run.bestPlay || r.scored.score > run.bestPlay.score) run.bestPlay = { word: playedWord, score: r.scored.score };
      logEvent('play', { word: playedWord, letters: sel.map(s => s.letter), score: r.scored.score, points: r.scored.points, mult: r.scored.mult, breakdown: r.scored.breakdown, status: run.status, ...snap() });
      profileRecordPlay(profile, { word: playedWord, score: r.scored.score, roundTotal: run.roundTotal });
      // Track peak coins (Tidy Sum) + boss clears (Critic's Pick) before checking achievements this tick.
      profile.stats.maxCoinsHeld = Math.max(profile.stats.maxCoinsHeld || 0, run.coins || 0);
      if (run.status === 'roundCleared' && run.boss && !profile.stats.bossesBeaten.includes(run.boss)) profile.stats.bossesBeaten.push(run.boss);
      markCompletions(checkAchievements(profile, {
        phase: 'play',
        letters: sel.map(s => s.letter.toUpperCase()),
        word: playedWord.toUpperCase(),
        score: r.scored.score,
        wordsPlayedThisRound: run.wordsPlayedThisRound,
        status: run.status,
        playsLeft: run.playsLeft,
        prevRoundTotal: run.roundTotal - r.scored.score,
        target: run.target,
        roundTotal: run.roundTotal,
        roundIndex: run.roundIndex,
        boss: run.boss || null,
        chainLength: run.chainLength || 1,
        hasWild: sel.some(s => s.tile && s.tile.letter === '*'),
        maxHoneLevel: Math.max(0, ...Object.values(run.honeLevels || {})),
      }, CONFIG));
      if (run.status === 'roundCleared') {
        if (run.roundIndex + 1 >= run.targets.length) {
          nextRound(run);   // final round cleared: win immediately — no shop/event node before the trophy
        } else {
          offerNode(run);
          if (run.nodeEventId === null) {
            // no eligible event — go straight to shop
            run.shop = generateShop(run, run.rng, pool());
            recordOffers(telemetry, extractOfferIds(run.shop));
          }
        }
      }
      saveAll(); animatePull(sel, r.scored, render); return r; },
    onDiscard(sel) { const dtiles = sel.map(s => s.letter); discard(run, sel); recordDiscard(telemetry, dtiles); logEvent('discard', { tiles: dtiles, ...snap() }); saveAll(); render(); },
    onBuy(offer, opts = {}) {
      const r = purchase(run, offer, opts);
      logEvent('purchase', { offer: offer.type, id: offer.relicId || offer.modId || offer.letter || null, cost: offer.cost, ok: r.ok, coins: run.coins });
      if (r.ok) {
        run.boughtAnythingThisRun = true;
        if (offer.type === 'enchantMulti') run.usedImprint = true;   // Mass Production achievement
        if (offer.type === 'buyRelic') recordPurchase(telemetry, offer.relicId);
        else if (offer.type === 'buyEnchantedTile' || offer.type === 'enchantTile' || offer.type === 'enchantMulti') recordPurchase(telemetry, offer.modId);
        run.shop.offers = run.shop.offers.filter(o => o !== offer);   // consume only the bought slot; the rest stay (reroll replaces the set)
      }
      saveAll(); render(); return r;
    },
    onReroll() {
      const free = (run.freeRerollsLeft || 0) > 0;
      if (!free && run.coins < run.shop.rerollCost) return;
      if (free) run.freeRerollsLeft -= 1; else run.coins -= run.shop.rerollCost;
      run.shop = generateShop(run, run.rng, pool());
      recordOffers(telemetry, extractOfferIds(run.shop));
      logEvent('reroll', { free, rerollCost: free ? 0 : run.shop.rerollCost, coins: run.coins, freeRerollsLeft: run.freeRerollsLeft || 0 });
      saveAll(); render();
    },
    onPickShop() {
      run._nodePick = 'shop';
      logEvent('node_pick', { pick: 'shop', round: run.roundIndex });
      run.shop = generateShop(run, run.rng, pool());
      recordOffers(telemetry, extractOfferIds(run.shop));
      saveAll(); render();
    },
    onPickEvent() {
      const ev = EVENTS[run.nodeEventId];
      if (!ev) return;
      run._nodePick = 'event';
      logEvent('node_pick', { pick: 'event', event: run.nodeEventId });
      if (ev.interactive) {
        pressStart(run);
      } else if (ev.autoResolve) {
        // Single-option, no-input events (Ink Merchant, The Blank) resolve on pick - no confirm click.
        const r = applyEventOption(run, run.nodeEventId, 0, {});
        if (r?.ok !== false) run.nodeResolved = true;
      }
      saveAll(); render();
    },
    onEventOption(optionIndex, opts) {
      const r = applyEventOption(run, run.nodeEventId, optionIndex, opts);
      if (r?.ok !== false) advanceRound();   // resolved -> straight to the next round (no middle "Done/Continue" screen)
      saveAll(); render(); return r;
    },
    onPressDraw() {
      pressDraw(run);
      sfx('tap');
      saveAll(); render();
    },
    onPressBank() {
      run._pressLastPot = run.press?.pot || 0;
      pressBank(run);
      sfx('cash');
      run.nodeResolved = true;
      saveAll(); render();
    },
    onContinue() { advanceRound(); saveAll(); render(); },
    // Shuffle: cosmetically reorder the rack using Math.random (not run.rng).
    // Rack order has no effect on scoring or future draws, so this is purely visual.
    // Using run.rng here would desync the seeded RNG stream and make a run's outcome
    // depend on how often the player shuffled — Math.random is the correct choice.
    onShuffle() {
      const rack = run.rack;
      for (let i = rack.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rack[i], rack[j]] = [rack[j], rack[i]];
      }
      saveAll(); render();
    },
    // run-end transitions to the meta screen:
    onRunEnd() { endRun(); },
    // meta screen actions:
    onMetaBuy(offer) { const r = purchaseMeta(meta, offer, CONFIG); saveAll(); render(); return r; },
    onStartRun(deckId, stakeId) { startRun(deckId, stakeId); },
    // Menu navigation:
    onResume() { if (run) { view = 'run'; render(); } },
    onNewRun() {
      const active = run && run.status !== 'won' && run.status !== 'lost';
      if (active) {
        showConfirm({ title: 'Start a new run?', body: 'Your current run will be lost.', confirmLabel: 'New run', danger: true, onConfirm: () => { view = 'setup'; render(); } });
        return;
      }
      view = 'setup'; render();
    },
    onOpenSettings() { settingsReturn = (view === 'run') ? 'run' : 'menu'; view = 'settings'; render(); },
    onOpenMetaShop() { view = 'meta'; render(); },
    onOpenAchievements() { view = 'achievements'; render(); },
    onOpenStats() { view = 'stats'; render(); },
    onOpenTelemetry() { view = 'telemetry'; render(); },
    // Collect an earned-but-unclaimed reward on the Achievements screen (the only path that pays Meta).
    onCollectAchievement(id) { const r = collectAchievement(profile, id, CONFIG); if (r > 0) meta.meta += r; saveAll(); render(); return r; },
    onCollectBounty(key) { const r = collectBounty(profile, key, CONFIG); if (r > 0) meta.meta += r; saveAll(); render(); return r; },
    onBackToMenu() { view = (view === 'settings' && settingsReturn === 'run') ? 'run' : 'menu'; settingsReturn = 'menu'; render(); },
    onExitToMenu() { view = 'menu'; render(); },   // run stays saved; Resume continues it
    onAbandonRun() {
      showConfirm({ title: 'Abandon this run?', body: 'Your current run will be lost.', confirmLabel: 'Abandon', danger: true, onConfirm: () => {
        window.localStorage.removeItem('letterRide.run'); run = null;
        view = 'menu'; render();
      } });
    },
  });
  window.addEventListener('keydown', (e) => { if (view === 'run') handleRunKey(e); });
  // First user gesture unlocks the audio context for SFX (browser autoplay policy).
  window.addEventListener('pointerdown', () => { resumeAudio(); }, { once: true });
  applyDisplayPrefs();
  render();
} catch (err) {
  document.getElementById('app').textContent = 'Failed to start Letter Ride: ' + err.message + ' — check that assets/enable1.txt is present and served.';
}
