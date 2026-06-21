// src/ui.js
const app = () => document.getElementById('app');
let handlers = {};
let selection = [];      // [{ tile, letter }]
let lastRun = null;

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
    case 'buyLetter':        return `Buy ${offer.letter} — ${offer.cost}c`;
    case 'buyEnchantedTile': return `${offer.letter} ×${offer.modId} — ${offer.cost}c`;
    case 'enchantTile':      return `Enchant a tile (${offer.modId}) — ${offer.cost}c`;
    case 'upgradeLetter':    return `Upgrade ${offer.letter} +${offer.plus} — ${offer.cost}c`;
    case 'thinLetter':       return `Thin a ${offer.letter} — ${offer.cost}c`;
    case 'buyRelic':         return `Relic: ${offer.relicId} — ${offer.cost}c`;
    default:                 return `${offer.type} — ${offer.cost}c`;
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
    const modsLabel = tile.mods && tile.mods.length ? ` [${tile.mods.map(m => m.id[0].toUpperCase()).join('')}]` : '';
    const btn = document.createElement('button');
    btn.textContent = tile.letter + modsLabel;
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

  // Active relics row (names only).
  const relicsHtml = run.relics && run.relics.length
    ? `<div id="relics">Relics: ${run.relics.map(r => r.name).join(', ')}</div>`
    : '';

  // Coins counter (only in Tier 1; coins field exists on run after Task 10).
  const coinsHtml = (typeof run.coins === 'number')
    ? `<div id="coins">Coins: ${run.coins}</div>`
    : '';

  app().innerHTML = `
    <div id="hud">
      <div>Round ${run.roundIndex + 1}/${run.targets.length}</div>
      <div><b>${run.roundTotal}</b> / ${run.target} Points</div>
      <div>Plays ${run.playsLeft} · Discards ${run.discardsLeft}</div>
      ${coinsHtml}
    </div>
    ${relicsHtml}
    <div id="staging">${staged || '&nbsp;'}</div>
    <div id="rack">
      ${run.rack.map(t => {
        const modBadge = t.mods && t.mods.length
          ? `<span class="mod-badge">${t.mods.map(m => m.id[0].toUpperCase()).join('')}</span>`
          : '';
        return `<button class="tile ${inRack(t.id) ? 'used' : ''}" data-id="${t.id}">${t.letter}${modBadge}</button>`;
      }).join('')}
    </div>
    <div id="msg"></div>
    <div id="controls">
      <button id="submit" ${done ? 'disabled' : ''}>Submit</button>
      <button id="back" ${done ? 'disabled' : ''}>⌫</button>
      <button id="clear" ${done ? 'disabled' : ''}>Clear</button>
      <button id="discard" ${done || run.discardsLeft <= 0 ? 'disabled' : ''}>Discard</button>
      ${run.status === 'won' ? '<div class="end">🎉 Run cleared!</div><button id="new">New run</button>' : ''}
      ${run.status === 'lost' ? '<div class="end">💀 Out of plays.</div><button id="new">New run</button>' : ''}
    </div>`;

  run.rack.forEach(t => {
    const btn = app().querySelector(`.tile[data-id="${t.id}"]`);
    if (btn && !inRack(t.id)) btn.onclick = () => tapTile(t);
  });
  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  on('submit', () => { const s = selection; selection = []; handlers.onSubmit?.(s); });
  on('back', () => { selection.pop(); renderRun(run); });
  on('clear', () => { selection = []; renderRun(run); });
  on('discard', () => { selection = []; handlers.onDiscard?.(); });
  on('new', () => { selection = []; handlers.onNewRun?.(); });
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

  // Active relics row.
  const relicsHtml = run.relics && run.relics.length
    ? `<div id="relics">Relics: ${run.relics.map(r => r.name).join(', ')}</div>`
    : '';

  app().innerHTML = `
    <div id="hud">
      <div>Round ${run.roundIndex + 1}/${run.targets.length} — Shop</div>
      <div><b>${run.roundTotal}</b> / ${run.target} Points ✓</div>
      <div id="coins">Coins: ${coins}</div>
    </div>
    ${relicsHtml}
    <div id="shop">
      <div id="shop-offers">${offersHtml}</div>
      <div id="shop-actions">
        <button id="reroll" ${rerollDisabled}>Reroll (${shop.rerollCost}c)</button>
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
