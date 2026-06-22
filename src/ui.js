// src/ui.js
import { metaShopOffers } from './meta.js';
import { RELICS } from './relics.js';
import { getMod } from './tiles.js';
import { scoreWord } from './scoring.js';

const app = () => document.getElementById('app');
let handlers = {};
let selection = [];      // [{ tile, letter }]
let lastRun = null;
let selectedDeckId = 'standard';
let selectedStakeId = null;  // will be set to config.STAKES[0].id on first render

export function bindControls(h) { handlers = h; }

export function flashInvalid(reason) {
  const el = document.getElementById('msg');
  if (el) el.textContent = reason === 'short' ? 'Too short (min 3).' : 'Not a word.';
}

function tapTile(tile) {
  if (selection.some(s => s.tile.id === tile.id)) return;   // each rack tile once
  let letter = tile.letter;
  if (letter === '*') {
    const choice = (window.prompt('Wild — choose a letter:') || '').toUpperCase().slice(0, 1);
    if (!/[A-Z]/.test(choice)) return;
    letter = choice;
  }
  selection.push({ tile, letter });
  renderRun(lastRun);
}

// Return a short display label for an offer.
function offerLabel(offer) {
  switch (offer.type) {
    case 'buyLetter':        return `Buy ${offer.letter} — $${offer.cost}`;
    case 'buyEnchantedTile': {
      const mod = getMod(offer.modId);
      return `${offer.letter} + ${mod?.name || offer.modId} (${mod?.desc || ''}) — $${offer.cost}`;
    }
    case 'enchantTile': {
      const mod = getMod(offer.modId);
      return `Enchant a tile: ${mod?.name || offer.modId} — ${mod?.desc || ''} — $${offer.cost}`;
    }
    case 'upgradeLetter':    return `Upgrade ${offer.letter} +${offer.plus} — $${offer.cost}`;
    case 'thinLetter':       return `Thin a tile — $${offer.cost}`;
    case 'buyRelic': {
      const relic = RELICS[offer.relicId];
      return `Relic: ${relic?.name || offer.relicId} — ${relic?.desc || ''} — $${offer.cost}`;
    }
    default:                 return `${offer.type} — $${offer.cost}`;
  }
}

// Returns whether an offer needs a tile-picker before confirming.
function needsTilePicker(offer) {
  return offer.type === 'enchantTile' || offer.type === 'thinLetter';
}

// Render a tile-picker overlay and wire up the buttons.
function showTilePicker(run, offer) {
  // Remove any existing overlay first.
  const old = document.getElementById('tile-picker-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tile-picker-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;z-index:100;';

  const title = document.createElement('div');
  title.textContent = offer.type === 'thinLetter' ? 'Remove which tile?' : 'Enchant which tile?';
  title.style.cssText = 'color:#fff;font-weight:bold;font-size:1.1em;';
  overlay.appendChild(title);

  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:320px;';

  run.bag.tiles.forEach(tile => {
    const modsLabel = tile.mods && tile.mods.length ? ` [${tile.mods.map(m => m.name || m.id[0].toUpperCase()).join(', ')}]` : '';
    const btn = document.createElement('button');
    btn.textContent = tile.letter + modsLabel;
    if (tile.mods && tile.mods.length) {
      btn.title = tile.mods.map(m => `${m.name || m.id}: ${m.desc || ''}`).join('; ');
    }
    btn.style.cssText = 'padding:10px 14px;font-size:1em;border-radius:6px;cursor:pointer;';
    btn.onclick = () => {
      overlay.remove();
      const res = handlers.onBuy?.(offer, tile.id);
      if (res && !res.ok) {
        const msg = document.getElementById('msg');
        if (msg) msg.textContent = 'Purchase failed: ' + (res.reason || 'unknown');
      }
    };
    grid.appendChild(btn);
  });
  overlay.appendChild(grid);

  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.style.cssText = 'margin-top:8px;padding:8px 20px;font-size:0.95em;border-radius:6px;cursor:pointer;';
  cancel.onclick = () => overlay.remove();
  overlay.appendChild(cancel);

  document.body.appendChild(overlay);
}

// Build relics + tile-mods panel HTML (always rendered during play and shop).
function relicsModsPanelHtml(run) {
  const relicsText = (run.relics && run.relics.length)
    ? run.relics.map(r => `<span class="relic-entry" title="${r.desc || ''}">${r.name}</span>`).join(' · ')
    : '<span class="none-label">none yet</span>';

  // Collect all rack + bag tiles with mods
  const allTiles = [
    ...(run.rack || []),
    ...(run.bag?.tiles || []),
  ];
  const moddedTiles = allTiles.filter(t => t.mods && t.mods.length);
  const modsText = moddedTiles.length
    ? moddedTiles.map(t => `${t.letter}:${t.mods.map(m => m.name || m.id).join('+')}`)
        .join(', ')
    : '<span class="none-label">none yet</span>';

  return `<div id="relics-mods-panel">
    <div class="rp-row"><span class="rp-label">Relics:</span> ${relicsText}</div>
    <div class="rp-row"><span class="rp-label">Tile-mods:</span> ${modsText}</div>
  </div>`;
}

// Build live scorebug HTML for the current selection (read-only preview).
function scorePreviewHtml(run, sel) {
  if (!sel.length) return '';
  const result = scoreWord(sel, {
    tileValues: run.tileValues,
    lengthBonusPerLetter: run.config.LENGTH_BONUS_PER_LETTER,
    relics: run.relics || [],
    context: { wordsPlayedThisRound: run.wordsPlayedThisRound },
  });
  const bd = result.breakdown;

  // Build itemization string
  const parts = [];
  parts.push(`Base ${bd.base}`);
  if (bd.lengthBonus > 0) parts.push(`+${bd.lengthBonus} length`);
  for (const p of bd.pointParts) parts.push(`+${p.amount} ${p.label}`);

  let multStr = `×${result.mult % 1 === 0 ? result.mult : result.mult.toFixed(2)}`;
  const multParts = [];
  if (bd.addMultParts.length) multParts.push(bd.addMultParts.map(p => `+${p.amount} ${p.label}`).join(', '));
  if (bd.timesMultParts.length) multParts.push(bd.timesMultParts.map(p => `×${p.amount} ${p.label}`).join(', '));

  const pointsPart = parts.join(' ');
  const multDetail = multParts.length ? ` (${multParts.join('; ')})` : '';
  const word = sel.map(s => s.letter).join('');

  return `<div id="scorebug">
    <span class="sb-word">${word}</span>
    <span class="sb-formula">${result.points} Points ${multStr} Mult${multDetail} = <b>${result.score}</b> Score</span>
    <span class="sb-detail">${pointsPart}</span>
  </div>`;
}

export function renderRun(run) {
  lastRun = run;

  // Shop screen: render when round cleared and shop is available.
  if (run.status === 'roundCleared' && run.shop) {
    renderShop(run);
    return;
  }

  const inRack = id => selection.some(s => s.tile.id === id);
  const staged = selection.map(s => s.letter).join('');
  const done = run.status !== 'playing';

  // Currency counter (only in Tier 1; coins field exists on run after Task 10).
  const coinsHtml = (typeof run.coins === 'number')
    ? `<div id="coins">$${run.coins}</div>`
    : '';

  // Last play result
  const lastPlayHtml = run.lastPlay
    ? `<div id="last-play">Last: <b>${run.lastPlay.word}</b> = ${run.lastPlay.score} Score</div>`
    : '';

  // Live score preview (only when playing and selection non-empty)
  const preview = (!done && selection.length) ? scorePreviewHtml(run, selection) : '';

  app().innerHTML = `
    <div id="hud">
      <div>Round ${run.roundIndex + 1}/${run.targets.length}</div>
      <div><b>${run.roundTotal}</b> / ${run.target} Score</div>
      <div>Plays ${run.playsLeft} · Discards ${run.discardsLeft}</div>
      ${coinsHtml}
    </div>
    ${relicsModsPanelHtml(run)}
    ${lastPlayHtml}
    <div id="staging">${staged || '&nbsp;'}</div>
    ${preview}
    <div id="rack">
      ${run.rack.map(t => {
        const modBadge = t.mods && t.mods.length
          ? `<span class="mod-badge">${t.mods.map(m => (m.name || m.id)[0].toUpperCase()).join('')}</span>`
          : '';
        const tileVal = t.letter === '*' ? '' : `<span class="tile-val">${(run.tileValues || {})[t.letter] ?? 0}</span>`;
        const titleAttr = t.mods && t.mods.length
          ? ` title="${t.mods.map(m => `${m.name || m.id}: ${m.desc || ''}`).join('; ')}"`
          : '';
        return `<button class="tile ${inRack(t.id) ? 'used' : ''}" data-id="${t.id}"${titleAttr}>${t.letter}${modBadge}${tileVal}</button>`;
      }).join('')}
    </div>
    <div id="msg"></div>
    <div id="controls">
      <button id="submit" ${done ? 'disabled' : ''}>Submit</button>
      <button id="back" ${done ? 'disabled' : ''}>⌫</button>
      <button id="clear" ${done ? 'disabled' : ''}>Clear</button>
      <button id="discard" ${done || run.discardsLeft <= 0 ? 'disabled' : ''}>Discard</button>
      ${run.status === 'won' ? `<div class="end">🎉 Run cleared!${run.lastMetaEarned ? ` +${run.lastMetaEarned} Meta earned` : ''}</div><button id="new">Back to menu</button>` : ''}
      ${run.status === 'lost' ? `<div class="end">💀 Out of plays.${run.lastMetaEarned ? ` +${run.lastMetaEarned} Meta earned` : ''}</div><button id="new">Back to menu</button>` : ''}
    </div>`;

  run.rack.forEach(t => {
    const btn = app().querySelector(`.tile[data-id="${t.id}"]`);
    if (btn && !inRack(t.id)) btn.onclick = () => tapTile(t);
  });
  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  on('submit', () => { const s = selection; selection = []; const r = handlers.onSubmit?.(s); });
  on('back', () => { selection.pop(); renderRun(run); });
  on('clear', () => { selection = []; renderRun(run); });
  on('discard', () => { selection = []; handlers.onDiscard?.(); });
  on('new', () => { selection = []; handlers.onRunEnd?.(); });
}

// Keyboard handler — exported so main.js can wire it.
// Operates on module-level lastRun + selection.
// Wilds are still placed by tap only; typing only matches real-letter tiles.
export function handleRunKey(e) {
  if (!lastRun || lastRun.status !== 'playing') return;

  if (/^[a-zA-Z]$/.test(e.key)) {
    const L = e.key.toUpperCase();
    const tile = lastRun.rack.find(t => t.letter === L && !selection.some(s => s.tile.id === t.id));
    if (tile) {
      selection.push({ tile, letter: L });
      e.preventDefault();
      renderRun(lastRun);
    }
  } else if (e.key === 'Backspace') {
    e.preventDefault();
    selection.pop();
    renderRun(lastRun);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const s = selection;
    selection = [];
    handlers.onSubmit?.(s);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    selection = [];
    renderRun(lastRun);
  }
}

function renderShop(run) {
  const shop = run.shop;
  const coins = run.coins || 0;
  const canAfford = (cost) => coins >= cost;

  const offersHtml = shop.offers.map((offer, i) => {
    const label = offerLabel(offer);
    const disabled = !canAfford(offer.cost) ? 'disabled' : '';
    return `<button class="shop-offer" data-idx="${i}" ${disabled}>${label}</button>`;
  }).join('');

  const rerollDisabled = !canAfford(shop.rerollCost) ? 'disabled' : '';

  let lastAwardHtml = '';
  if (run.lastAward && run.lastAward.length) {
    const total = run.lastAward.reduce((s, x) => s + x.amount, 0);
    const breakdown = run.lastAward.map(x => `${x.label} $${x.amount}`).join(' · ');
    lastAwardHtml = `<div id="scorebug">Earned $${total}  ·  ${breakdown}</div>`;
  }

  app().innerHTML = `
    <div id="hud">
      <div>Round ${run.roundIndex + 1}/${run.targets.length} — Shop</div>
      <div><b>${run.roundTotal}</b> / ${run.target} Score ✓</div>
      <div id="coins">$${coins}</div>
    </div>
    ${relicsModsPanelHtml(run)}
    ${lastAwardHtml}
    <div id="shop">
      <div id="shop-offers">${offersHtml}</div>
      <div id="shop-actions">
        <button id="reroll" ${rerollDisabled}>Reroll ($${shop.rerollCost})</button>
        <button id="continue">Continue →</button>
      </div>
    </div>
    <div id="msg"></div>`;

  // Wire offer buttons.
  shop.offers.forEach((offer, i) => {
    const btn = app().querySelector(`.shop-offer[data-idx="${i}"]`);
    if (!btn || btn.disabled) return;
    btn.onclick = () => {
      if (needsTilePicker(offer)) {
        showTilePicker(run, offer);
      } else {
        const res = handlers.onBuy?.(offer);
        if (res && !res.ok) {
          const msg = document.getElementById('msg');
          if (msg) msg.textContent = 'Purchase failed: ' + (res.reason || 'unknown');
        }
      }
    };
  });

  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  on('reroll', () => handlers.onReroll?.());
  on('continue', () => { selection = []; handlers.onContinue?.(); });
}

export function renderMeta(meta, config, allRelicIds, allModIds) {
  // Reset selectedStakeId if null or no longer valid.
  if (!selectedStakeId || !meta.unlockedStakes.includes(selectedStakeId)) {
    selectedStakeId = meta.unlockedStakes[0] ?? (config.STAKES[0]?.id || null);
  }

  // Meta-shop offers.
  const offers = metaShopOffers(meta, config, allRelicIds, allModIds);

  // Build deck picker buttons HTML.
  const deckButtonsHtml = meta.unlockedDecks.map(id => {
    const name = config.DECKS[id]?.name || id;
    const active = id === selectedDeckId ? ' style="font-weight:bold;outline:2px solid #333;"' : '';
    return `<button class="deck-pick" data-deck="${id}"${active}>${name}</button>`;
  }).join(' ');

  // Build stake picker buttons HTML.
  const stakeButtonsHtml = meta.unlockedStakes.map(id => {
    const stakeObj = config.STAKES.find(s => s.id === id);
    const name = stakeObj?.name || id;
    const active = id === selectedStakeId ? ' style="font-weight:bold;outline:2px solid #333;"' : '';
    return `<button class="stake-pick" data-stake="${id}"${active}>${name}</button>`;
  }).join(' ');

  // Build meta-shop offers HTML.
  function metaOfferLabel(offer) {
    switch (offer.type) {
      case 'unlockRelic': {
        const relic = RELICS[offer.relicId];
        return `Unlock relic: ${relic?.name || offer.relicId} — ${relic?.desc || ''} — ${offer.cost}`;
      }
      case 'unlockMod': {
        const mod = getMod(offer.modId);
        return `Unlock mod: ${mod?.name || offer.modId} — ${mod?.desc || ''} — ${offer.cost}`;
      }
      case 'unlockDeck':   return `Unlock bag: ${config.DECKS[offer.deckId]?.name || offer.deckId} — ${offer.cost}`;
      case 'unlockStake':  return `Unlock stake: ${config.STAKES.find(s => s.id === offer.stakeId)?.name || offer.stakeId} — ${offer.cost}`;
      case 'loadout':      return `${config.LOADOUT[offer.key]?.name || offer.key} — ${offer.cost}`;
      default:             return `${offer.type} — ${offer.cost}`;
    }
  }

  const shopHtml = offers.length
    ? offers.map((offer, i) => {
        const disabled = meta.meta < offer.cost ? 'disabled' : '';
        return `<button class="meta-offer" data-idx="${i}" ${disabled}>${metaOfferLabel(offer)}</button>`;
      }).join('')
    : '<div>(No offers available)</div>';

  app().innerHTML = `
    <div id="meta-screen">
      <h2>Letter Ride</h2>
      <div id="meta-balance">Meta: ${meta.meta}</div>
      <div id="deck-picker">
        <div><b>Bag:</b></div>
        <div id="deck-buttons">${deckButtonsHtml}</div>
      </div>
      <div id="stake-picker">
        <div><b>Stake:</b></div>
        <div id="stake-buttons">${stakeButtonsHtml}</div>
      </div>
      <button id="start-run">Start Run</button>
      <hr>
      <div id="meta-shop">
        <div><b>Meta Shop</b></div>
        <div id="meta-offers">${shopHtml}</div>
      </div>
    </div>`;

  // Wire deck picker.
  app().querySelectorAll('.deck-pick').forEach(btn => {
    btn.onclick = () => { selectedDeckId = btn.dataset.deck; renderMeta(meta, config, allRelicIds, allModIds); };
  });

  // Wire stake picker.
  app().querySelectorAll('.stake-pick').forEach(btn => {
    btn.onclick = () => { selectedStakeId = btn.dataset.stake; renderMeta(meta, config, allRelicIds, allModIds); };
  });

  // Wire Start Run.
  const startBtn = document.getElementById('start-run');
  if (startBtn) {
    startBtn.onclick = () => {
      const deck = selectedDeckId;
      const stake = selectedStakeId;
      selectedDeckId = 'standard';
      selectedStakeId = null;
      handlers.onStartRun?.(deck, stake);
    };
  }

  // Wire meta-shop offer buttons.
  offers.forEach((offer, i) => {
    const btn = app().querySelector(`.meta-offer[data-idx="${i}"]`);
    if (!btn || btn.disabled) return;
    btn.onclick = () => {
      handlers.onMetaBuy?.(offer);
    };
  });
}
