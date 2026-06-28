// src/ui.js
import { metaShopOffers } from './meta.js';
import { RELICS } from './relics.js';
import { getMod } from './tiles.js';
import { scoreWord } from './scoring.js';
import { ARCHETYPES, honeModifiers, honeDescription } from './archetypes.js';
import { passageOf, tierOf, isBossRound } from './run.js';
import { BOSSES, bossTileValues, applyBossToScore } from './bosses.js';
import { EVENTS } from './events.js';
import { play as sfx, isMuted, toggleMuted } from './audio.js';
import { buildSummary, drawBroadside, shareBroadside } from './broadside.js';
import { getPref, setPref, togglePref, applyDisplayPrefs } from './settings.js';
import { levelFor, statsSummary } from './profile.js';
import { pendingMeta } from './achievements.js';
import { relicSealHtml, bossSealHtml, metaSealHtml, lineIconHtml, bucketBadgeHtml, bagHtml } from './icons.js';
import { updaterState, checkNow } from './updater.js';

const app = () => document.getElementById('app');
let handlers = {};
let selection = [];      // [{ tile, letter }]
let lastRun = null;
let selectedDeckId = 'standard';
let selectedStakeId = null;  // will be set to config.STAKES[0].id on first render
let lastShownScore = null;   // for score count-up animation
let _scoreRafId = null;      // active rAF handle (cancel on skip)
let _pulling = false;        // SP2 "the pull" reveal in progress
let _pullTimers = [];        // pending setTimeout ids (cancel on skip)
let _pullRaf = null;         // active pull tween rAF (cancel on skip)

export function bindControls(h) { handlers = h; }

export function flashInvalid(reason) {
  // The selection was already cleared on submit; re-render so the rack + staging reset (auto-clear,
  // letting the player immediately try another word), then surface why it didn't take.
  renderRun(lastRun);
  const el = document.getElementById('msg');
  if (el) el.textContent = reason === 'short' ? 'Too short (min 3).' : 'Not a word, try another.';
}

function tapTile(tile) {
  if (selection.some(s => s.tile.id === tile.id)) return;   // each rack tile once
  if (tile.letter === '*') {
    // Wild: choose its letter from a branded A-Z grid (no typing).
    showLetterPicker((chosen) => { selection.push({ tile, letter: chosen }); sfx('tap'); renderRun(lastRun); });
    return;
  }
  selection.push({ tile, letter: tile.letter });
  sfx('tap');
  renderRun(lastRun);
}

// Branded A-Z picker for assigning a Wild tile's letter (replaces window.prompt).
function showLetterPicker(onChoose) {
  document.getElementById('letter-picker-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'letter-picker-overlay';
  overlay.className = 'lr-overlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <h3 class="confirm-title">Wild tile — choose a letter</h3>
      <div class="letter-grid">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => `<button class="letter-pick" data-l="${l}">${l}</button>`).join('')}</div>
      <div class="confirm-actions"><button id="letter-cancel" class="menu-btn">Cancel</button></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.letter-pick').forEach(b => { b.onclick = () => { overlay.remove(); onChoose(b.dataset.l); }; });
  overlay.querySelector('#letter-cancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// Branded yes/no confirm modal (replaces window.confirm). onConfirm runs only if the user confirms.
export function showConfirm({ title, body = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm }) {
  document.getElementById('confirm-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'confirm-overlay';
  overlay.className = 'lr-overlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <h3 class="confirm-title">${title}</h3>
      ${body ? `<p class="confirm-body">${body}</p>` : ''}
      <div class="confirm-actions">
        <button id="confirm-no" class="menu-btn">${cancelLabel}</button>
        <button id="confirm-yes" class="menu-btn ${danger ? 'danger' : 'primary'}">${confirmLabel}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#confirm-no').onclick = close;
  overlay.querySelector('#confirm-yes').onclick = () => { close(); if (onConfirm) onConfirm(); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

// Return a short display label for an offer.
function offerLabel(offer) {
  switch (offer.type) {
    case 'buyLetter':        return `Buy ${offer.letter} · $${offer.cost}`;
    case 'buyEnchantedTile': {
      const mod = getMod(offer.modId);
      return `${offer.letter} + ${mod?.name || offer.modId} (${mod?.desc || ''}) · $${offer.cost}`;
    }
    case 'enchantTile': {
      const mod = getMod(offer.modId);
      return `Enchant a tile: ${mod?.name || offer.modId} · ${mod?.desc || ''} · $${offer.cost}`;
    }
    case 'upgradeLetter':    return `Upgrade ${offer.letter} +${offer.plus} · $${offer.cost}`;
    case 'thinLetter':       return `Remove a tile from your bag · $${offer.cost}`;
    case 'recastTile':       return `Recast a tile to a letter you choose · $${offer.cost}`;
    case 'transferMods':     return `Move a tile's mods onto another (destroys it) · $${offer.cost}`;
    case 'buyRelic': {
      const relic = RELICS[offer.relicId];
      return `Relic: ${relic?.name || offer.relicId} · ${relic?.desc || ''} · $${offer.cost}`;
    }
    case 'hone': {
      const archetype = ARCHETYPES[offer.archetypeId];
      const currentLevel = (lastRun?.honeLevels?.[offer.archetypeId] || 0);
      const archetypeDesc = archetype?.desc ? ` · ${archetype.desc}` : '';
      return `Hone: ${archetype?.name || offer.archetypeId} (Lv ${currentLevel}→${currentLevel + 1})${archetypeDesc} · $${offer.cost}`;
    }
    default:                 return `${offer.type} · $${offer.cost}`;
  }
}

// Returns whether an offer needs a tile-picker before confirming.
function needsTilePicker(offer) {
  return offer.type === 'enchantTile' || offer.type === 'thinLetter';
}

// Build a modal overlay with a title and a set of choice buttons. choices = [{label, title?, onPick}].
function buildPickOverlay(titleText, choices) {
  const old = document.getElementById('tile-picker-overlay');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.id = 'tile-picker-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;z-index:100;';
  const title = document.createElement('div');
  title.textContent = titleText;
  title.style.cssText = 'color:#fff;font-weight:bold;font-size:1.1em;';
  overlay.appendChild(title);
  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:320px;';
  choices.forEach(c => {
    const btn = document.createElement('button');
    btn.textContent = c.label;
    if (c.title) btn.title = c.title;
    btn.style.cssText = 'padding:10px 14px;font-size:1em;border-radius:6px;cursor:pointer;';
    btn.onclick = () => { overlay.remove(); c.onPick(); };
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

// Choice list for bag tiles, optionally excluding one id (e.g. the transfer source).
function tileChoices(run, onPick, excludeId) {
  return run.bag.tiles.filter(t => t.id !== excludeId).map(tile => {
    const modsLabel = tile.mods && tile.mods.length ? ` [${tile.mods.map(m => m.name || m.id[0].toUpperCase()).join(', ')}]` : '';
    return {
      label: tile.letter + modsLabel,
      title: tile.mods && tile.mods.length ? tile.mods.map(m => `${m.name || m.id}: ${m.desc || ''}`).join('; ') : undefined,
      onPick: () => onPick(tile),
    };
  });
}

function reportBuy(res) {
  if (res && !res.ok) {
    const msg = document.getElementById('msg');
    if (msg) msg.textContent = 'Purchase failed: ' + (res.reason || 'unknown');
  }
}

// enchant/thin: single tile pick.
function showTilePicker(run, offer) {
  const titleText = offer.type === 'thinLetter' ? 'Remove which tile?' : 'Enchant which tile?';
  buildPickOverlay(titleText, tileChoices(run, (tile) => reportBuy(handlers.onBuy?.(offer, { targetTileId: tile.id }))));
}

// recast: pick tile, then pick a letter from the shop pool.
function showRecastPicker(run, offer) {
  buildPickOverlay('Recast which tile?', tileChoices(run, (tile) => {
    buildPickOverlay(`Recast ${tile.letter} to which letter?`, run.config.SHOP.buyableLetters.map(L => ({
      label: L,
      onPick: () => reportBuy(handlers.onBuy?.(offer, { targetTileId: tile.id, targetLetter: L })),
    })));
  }));
}

// transfer: pick source (destroyed), then target (receives the mods).
function showTransferPicker(run, offer) {
  buildPickOverlay('Melt down which tile? (its mods move on)', tileChoices(run, (src) => {
    buildPickOverlay('Move its mods onto which tile?', tileChoices(run, (tgt) =>
      reportBuy(handlers.onBuy?.(offer, { sourceTileId: src.id, targetTileId: tgt.id })), src.id));
  }));
}

// Show a small inline popover anchored below the tapped chip element.
// Tapping the same chip again, or tapping elsewhere, dismisses it.
function showDescPopover(anchorEl, name, desc) {
  // Dismiss any existing popover first.
  const old = document.getElementById('desc-popover');
  if (old) {
    // If re-tapping the same chip, just close (toggle off).
    if (old.dataset.anchor === anchorEl.dataset.popoverKey) { old.remove(); return; }
    old.remove();
  }

  const popover = document.createElement('div');
  popover.id = 'desc-popover';
  popover.dataset.anchor = anchorEl.dataset.popoverKey;
  popover.innerHTML = `<span class="desc-pop-name">${name}</span><span class="desc-pop-text">${desc}</span><button class="desc-pop-close" aria-label="Close">x</button>`;

  // Float the popover over the layout (anchored below the chip) so it never reflows the panel.
  document.body.appendChild(popover);
  const r = anchorEl.getBoundingClientRect();
  popover.style.top = `${r.bottom + window.scrollY + 5}px`;
  const maxLeft = window.scrollX + document.documentElement.clientWidth - popover.offsetWidth - 8;
  popover.style.left = `${Math.max(window.scrollX + 8, Math.min(r.left + window.scrollX, maxLeft))}px`;

  const closeBtn = popover.querySelector('.desc-pop-close');
  if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); popover.remove(); };

  // Dismiss on tap-away (capture phase so it fires before any new tap-on-chip).
  function onDocTap(e) {
    if (!popover.isConnected) { document.removeEventListener('click', onDocTap, { capture: true }); return; }
    if (!popover.contains(e.target) && e.target !== anchorEl) {
      popover.remove();
      document.removeEventListener('click', onDocTap, { capture: true });
    }
  }
  // Delay one tick so the tap that opened it doesn't immediately close it.
  setTimeout(() => document.addEventListener('click', onDocTap, { capture: true }), 0);
}

// Wire tap-to-reveal handlers on chips inside a container element.
// Chips must have data-pop-name and data-pop-desc attributes.
function wireDescPopovers(containerEl) {
  if (!containerEl) return;
  containerEl.querySelectorAll('[data-pop-name]').forEach((chip, idx) => {
    chip.dataset.popoverKey = `chip-${idx}`;
    chip.style.cursor = 'pointer';
    chip.onclick = (e) => {
      e.stopPropagation();
      showDescPopover(chip, chip.getAttribute('data-pop-name'), chip.getAttribute('data-pop-desc'));
    };
  });
}

// Build relics + tile-mods panel HTML (always rendered during play and shop).
// Short display value per relic for the compact strip (the headline effect; author can reword).
const RELIC_TAGS = {
  vowelBonus: '+2/vowel', rareHoarder: '+40 rare', shortAndSweet: '×3', pithy: '+15',
  lengthy: '+1/letter', doubleTrouble: '+40 dbl', freshStart: '+2 Mult', comboCounter: '+1/word',
  recycler: '+$2/play', rareSurge: '×1.8', wildcardRares: 'wild→rare', longHaul: '× length',
  longReach: 'reach −1', echoChamber: '×2 dbl', looseDoubles: '2+=dbl', momentum: '+10/word',
  overtime: '+1 play', pressLead: 'retrig 1st', rareReprint: 'retrig rare',
  chainReaction: '× chain', throughLine: '+8/chain', wideMargins: '+1 hand', tightLeading: '+1M / −1 hand',
  rareAvalanche: '× grows', flywheel: '× grows', juggernaut: '× grows',
  resonanceEngine: '× grows', risingTide: '× grows', perpetualEngine: '× grows',
};
// Snowball relics show their LIVE x Mult (grows over the run); others show their static tag.
function relicChipValue(relic, run) {
  if (relic.snowball) {
    const tm = relic.evaluate?.({ relicState: run.relicState || {}, letters: [], selection: [] })?.timesMult || 1;
    if (tm > 1.0001) return `×${(Math.round(tm * 10) / 10).toFixed(1)}`;
  }
  return RELIC_TAGS[relic.id] || '';
}

// Compact relics strip: each owned relic = its seal icon + a short value; tap a chip for the full
// name + effect. Tile-mods live on the rack tiles (the mod badge) and hones fire visibly during
// scoring, so neither needs a row here.
function relicsModsPanelHtml(run) {
  if (!run.relics || !run.relics.length) {
    return `<div id="relics-mods-panel" class="rp-empty"><span class="none-label">No relics yet</span></div>`;
  }
  const counts = {};
  for (const r of run.relics) counts[r.id] = (counts[r.id] || 0) + 1;
  const seen = new Set();
  const chips = run.relics.filter(r => !seen.has(r.id) && seen.add(r.id)).map(r => {
    const n = counts[r.id];
    const val = relicChipValue(r, run);
    const safeDesc = (r.desc || '').replace(/"/g, '&quot;');
    const safeName = ((r.name || '') + (n > 1 ? ` ×${n}` : '')).replace(/"/g, '&quot;');
    return `<span class="relic-chip tappable-chip" data-pop-name="${safeName}" data-pop-desc="${safeDesc}">${relicSealHtml(r.id)}${val ? `<span class="rc-val">${val}</span>` : ''}${n > 1 ? `<span class="rc-n">×${n}</span>` : ''}</span>`;
  }).join('');
  return `<div id="relics-mods-panel">${chips}</div>`;
}

// Show the help overlay (Feature 4).
function showHelpOverlay() {
  const old = document.getElementById('help-overlay');
  if (old) { old.remove(); return; }

  const overlay = document.createElement('div');
  overlay.id = 'help-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:200;padding:16px;box-sizing:border-box;';

  const box = document.createElement('div');
  box.style.cssText = 'background:var(--night-2);color:var(--ink);border:1px solid var(--line);border-top:3px solid var(--gold);border-radius:10px;padding:20px 24px;max-width:380px;width:100%;font-size:0.97em;line-height:1.55;box-shadow:0 12px 32px rgba(0,0,0,0.6);box-sizing:border-box;';
  box.innerHTML = `
    <h3 style="margin:0 0 10px;color:var(--gold);font-family:var(--font-display);">How it works</h3>
    <p>A run is <b>4 Passages</b>. Each Passage has 3 encounters: <b>Word</b>, <b>Phrase</b>, then a <b>Sentence</b> (a boss with a special rule). Clear each round's Score target to advance.</p>
    <p><b>Score = Points × Mult.</b></p>
    <p>Each tile is worth <b>Points</b> (shown on the tile). Longer words add bonus Points.</p>
    <p><b>Relics</b> and <b>tile mods</b> add Points or Mult. Buy them in the shop with <b>$</b>.</p>
    <p>Beat the round's <b>Score target</b> before running out of plays. Discard your rack if you're stuck (limited discards per round).</p>
    <p>Use the <b>Shuffle</b> button to rearrange your rack tiles if you can't spot a word.</p>
  `;
  overlay.appendChild(box);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = 'padding:10px 28px;font-size:1em;font-weight:700;border-radius:6px;cursor:pointer;border:1px solid var(--gold);background:var(--night-2);color:var(--gold);';
  closeBtn.onclick = () => overlay.remove();
  overlay.appendChild(closeBtn);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// Show what's left in the bag (the draw pile): tile count + letter composition.
function showBagOverlay(run) {
  document.getElementById('bag-overlay')?.remove();
  const tiles = run.bag?.tiles || [];
  const counts = {};
  for (const t of tiles) { const k = t.letter === '*' ? '★' : t.letter; counts[k] = (counts[k] || 0) + 1; }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const grid = entries.map(([l, n]) => `<span class="bag-cell"><b>${l}</b><span class="bag-n">×${n}</span></span>`).join('');
  const overlay = document.createElement('div');
  overlay.id = 'bag-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:200;padding:16px;box-sizing:border-box;';
  overlay.innerHTML = `
    <div style="background:var(--night-2);color:var(--ink);border:1px solid var(--line);border-top:3px solid var(--gold);border-radius:10px;padding:18px 20px;max-width:380px;width:100%;box-shadow:0 12px 32px rgba(0,0,0,0.6);box-sizing:border-box;">
      <h3 style="margin:0 0 4px;color:var(--gold);font-family:var(--font-display);">In the bag</h3>
      <p style="margin:0 0 12px;font-size:0.85rem;color:var(--ink-soft);">${tiles.length} tile${tiles.length === 1 ? '' : 's'} left to draw (your hand is separate).</p>
      <div class="bag-grid">${grid || '<span class="none-label">Bag is empty</span>'}</div>
    </div>
    <button id="bag-close" class="menu-btn">Close</button>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#bag-close').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// Build live scorebug HTML from a pre-computed scoreWord result.
function scorePreviewHtml(sel, result, bossNote = '') {
  if (!sel.length || !result) return '';
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
    <span class="sb-formula">${result.points} Points ${multStr} Mult${multDetail}${bossNote ? ` ${bossNote}` : ''} = <b>${result.score}</b> Score</span>
    <span class="sb-detail">${pointsPart}</span>
  </div>`;
}

// Animate the score element's displayed number from `from` to `to` over ~500ms (ease-out).
// A tap/click anywhere during the roll skips to the final value immediately.
function animateScoreCountUp(from, to) {
  // Cancel any in-flight animation first.
  if (_scoreRafId !== null) {
    cancelAnimationFrame(_scoreRafId);
    _scoreRafId = null;
  }

  const el = document.getElementById('score-total');
  if (!el) return;
  if (from === to) { lastShownScore = to; return; }

  const DURATION = 500; // ms
  const start = performance.now();

  function skip() {
    if (_scoreRafId !== null) {
      cancelAnimationFrame(_scoreRafId);
      _scoreRafId = null;
    }
    const scoreEl = document.getElementById('score-total');
    if (scoreEl) scoreEl.textContent = to;
    lastShownScore = to;
    document.removeEventListener('click', skip, { capture: true });
  }

  document.addEventListener('click', skip, { capture: true, once: true });

  function frame(now) {
    const elapsed = now - start;
    const t = Math.min(elapsed / DURATION, 1);
    // Ease-out: decelerate as t → 1
    const eased = 1 - Math.pow(1 - t, 3);
    const current = Math.round(from + (to - from) * eased);

    const scoreEl = document.getElementById('score-total');
    if (scoreEl) scoreEl.textContent = current;

    if (t < 1) {
      _scoreRafId = requestAnimationFrame(frame);
    } else {
      _scoreRafId = null;
      lastShownScore = to;
      document.removeEventListener('click', skip, { capture: true });
    }
  }

  _scoreRafId = requestAnimationFrame(frame);
}

// --- The Pull (Phase 4 SP2): staged commit->score reveal ----------------------
// Pure UI feel over the existing scorebug/staging. Reads the scoreWord result and
// counts Points -> Mult -> Score up in phases, presses the staged word, then settles
// via onDone(). Tap anywhere fast-forwards; respects prefers-reduced-motion. The
// timings (ms) are feel-tunable presentation, not game balance.
const PULL = { press: 190, points: 330, mult: 300, score: 440, hold: 320, skipHold: 130 };

export function isPulling() { return _pulling; }

function _clearPullTimers() {
  _pullTimers.forEach(clearTimeout); _pullTimers = [];
  if (_pullRaf !== null) { cancelAnimationFrame(_pullRaf); _pullRaf = null; }
}
function _pullAfter(ms, fn) { _pullTimers.push(setTimeout(fn, ms)); }
function _pullTween(el, from, to, ms, fmt) {
  if (_pullRaf !== null) { cancelAnimationFrame(_pullRaf); _pullRaf = null; }
  if (!el) return;
  if (from === to) { el.textContent = fmt(to); return; }
  const start = performance.now();
  const step = now => {
    const t = Math.min((now - start) / ms, 1);
    const eased = 1 - Math.pow(1 - t, 3);          // ease-out
    el.textContent = fmt(from + (to - from) * eased);
    if (t < 1) _pullRaf = requestAnimationFrame(step);
    else _pullRaf = null;
  };
  _pullRaf = requestAnimationFrame(step);
}
const _multStr = m => `×${m % 1 === 0 ? m : (Math.round(m * 100) / 100).toFixed(2)}`;
function _pullDetail(bd) {
  const parts = [`Base ${bd.base || 0}`];
  if (bd.lengthBonus > 0) parts.push(`+${bd.lengthBonus} length`);
  for (const p of (bd.pointParts || [])) parts.push(`+${p.amount} ${p.label}`);
  const mp = [];
  if ((bd.addMultParts || []).length) mp.push(bd.addMultParts.map(p => `+${p.amount} ${p.label}`).join(', '));
  if ((bd.timesMultParts || []).length) mp.push(bd.timesMultParts.map(p => `×${p.amount} ${p.label}`).join(', '));
  return parts.join(' ') + (mp.length ? ` · ${mp.join('; ')}` : '');
}

// Animate a Balatro-style PER-LETTER score build in a centered overlay, then onDone() to settle.
// Each played tile fires in turn adding its Points; then length + relic/mod Points; then the Mult
// builds (+Mult, then xMult); then Score = Points x Mult flourishes. Tap to skip; reduced-motion /
// fast-scoring skip straight to the result. Timings (ms) are feel-tunable presentation, not balance.
export function animatePull(sel, scored, onDone) {
  sfx('chunk');                                   // the platen comes down (plays even when scoring is Off)
  const speed = getPref('scoringSpeed') || 'full';
  const reduce = getPref('reducedMotion') || speed === 'off' || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reduce || !scored || !sel.length) { if (onDone) onDone(); return; }
  const STEP = speed === 'fast' ? 120 : 300;      // 'full' = slow enough to read each letter tally

  const stage = document.getElementById('staging');
  if (!stage) { if (onDone) onDone(); return; }
  _pulling = true;
  let finished = false;
  const bd = scored.breakdown || {};
  const fires = bd.tileFires && bd.tileFires.length === sel.length ? bd.tileFires : sel.map(s => ({ letter: s.letter, points: 0 }));
  const intFmt = v => String(Math.round(v));

  // Show the formed WORD and tally each letter in order (it lights up + adds its Points); the running
  // Points x Mult = Score builds below it, inside the staging slot. (No rack-tile animation.)
  stage.classList.add('sa-readout');
  stage.innerHTML =
    `<div class="sa-word">${sel.map((s, i) => `<span class="sa-ltr" data-i="${i}">${s.letter === '*' ? '★' : s.letter}</span>`).join('')}</div>` +
    `<div class="sa-formula"><span id="sa-points">0</span> Points <span id="sa-mult" class="sa-multv">×1</span> Mult = <b id="sa-score">0</b> Score</div>`;
  const ltrs = [...stage.querySelectorAll('.sa-ltr')];
  const ptEl = stage.querySelector('#sa-points');
  const multEl = stage.querySelector('#sa-mult');
  const scoreEl = stage.querySelector('#sa-score');

  let runPts = 0, runMult = 1;
  const bump = (el) => { if (!el) return; el.classList.remove('sa-bump'); void el.offsetWidth; el.classList.add('sa-bump'); };
  const setPts = () => { ptEl.textContent = intFmt(runPts); bump(ptEl); };
  const setMult = () => { multEl.textContent = _multStr(runMult); bump(multEl); };

  const settle = () => {
    if (finished) return; finished = true;
    _clearPullTimers();
    document.removeEventListener('click', onTap, { capture: true });
    _pulling = false;
    if (onDone) onDone();                     // re-render refills the rack + resets staging
  };
  const showFinals = () => {
    ltrs.forEach(el => el.classList.add('sa-lit'));
    if (ptEl) ptEl.textContent = intFmt(scored.points);
    if (multEl) multEl.textContent = _multStr(scored.mult);
    if (scoreEl) { scoreEl.textContent = intFmt(scored.score); scoreEl.classList.add('sa-pop'); }
    sfx('flourish');
  };
  function onTap(e) { e.stopPropagation(); e.preventDefault(); _clearPullTimers(); showFinals(); _pullAfter(240, settle); }
  document.addEventListener('click', onTap, { capture: true });

  let t = 220;
  // 1) tally each letter of the word in order (it lights up + adds its base Points)
  fires.forEach((f, i) => {
    _pullAfter(t, () => { if (ltrs[i]) ltrs[i].classList.add('sa-lit'); runPts += f.points; setPts(); sfx('tap'); });
    t += STEP;
  });
  // 2) length bonus, then 3) Points from relics/mods (the Points number climbs)
  if (bd.lengthBonus > 0) { _pullAfter(t, () => { runPts += bd.lengthBonus; setPts(); sfx('tap'); }); t += STEP; }
  for (const p of (bd.pointParts || [])) { _pullAfter(t, () => { runPts += p.amount; setPts(); sfx('tap'); }); t += STEP; }
  // 4) the Mult climbs: +Mult then xMult
  for (const p of (bd.addMultParts || [])) { _pullAfter(t, () => { runMult += p.amount; setMult(); sfx('tap'); }); t += STEP; }
  for (const p of (bd.timesMultParts || [])) { _pullAfter(t, () => { runMult *= p.amount; setMult(); sfx('tap'); }); t += STEP; }
  // 5) Score reveal (snap Points/Mult to the exact final, then tween the Score)
  _pullAfter(t + 90, () => { if (ptEl) ptEl.textContent = intFmt(scored.points); if (multEl) multEl.textContent = _multStr(scored.mult); sfx('flourish'); _pullTween(scoreEl, 0, scored.score, 520, intFmt); });
  t += 90 + 520;
  _pullAfter(t, () => { if (scoreEl) scoreEl.classList.add('sa-pop'); });
  _pullAfter(t + 580, settle);
}

export function renderRun(run, profile) {
  lastRun = run;

  // Run end: show the broadside (trophy card) instead of the playing layout.
  if (run.status === 'won' || run.status === 'lost') { renderBroadside(run, profile); return; }

  // Node routing: after a round clear, show node choice, event UI, or shop.
  if (run.status === 'roundCleared') {
    if (run.shop) { renderShop(run); return; }
    if (run._nodePick === 'event' && run.nodeEventId) {
      // If the event was already resolved (persisted nodeResolved=true), skip re-offering it.
      if (run.nodeResolved) { renderEventDone(run, EVENTS[run.nodeEventId] || { name: '', desc: '' }); return; }
      const ev = EVENTS[run.nodeEventId];
      if (ev?.interactive) { renderPress(run); return; }
      renderEventOneShot(run); return;
    }
    renderNodeChoice(run); return;
  }

  const inRack = id => selection.some(s => s.tile.id === id);
  const staged = selection.map(s => s.letter).join('');
  const done = run.status !== 'playing';
  // Rack tile values reflect the active boss warp (e.g. The Mute zeroes vowels) so the badge matches scoring.
  const rackTileValues = (run.boss && BOSSES[run.boss]) ? bossTileValues(run.tileValues, BOSSES[run.boss]) : (run.tileValues || {});

  // Currency counter (only in Tier 1; coins field exists on run after Task 10).
  const coinsHtml = (typeof run.coins === 'number')
    ? `<div id="coins">$${run.coins}</div>`
    : '';

  // Last play result
  const lastPlayHtml = run.lastPlay
    ? `<div id="last-play">Last: <b>${run.lastPlay.word}</b> = ${run.lastPlay.score} Score</div>`
    : '';

  // (No pre-submit score preview: the per-letter scoring animation on submit is the score reveal.)

  const pct = run.target > 0 ? Math.min(100, Math.round((run.roundTotal / run.target) * 100)) : 0;
  const toGo = Math.max(0, run.target - run.roundTotal);
  // Run-progress track: one node per encounter, grouped 3 per passage; every 3rd (the Sentence) is a boss.
  const totalRounds = run.targets.length;
  const trackNodes = run.targets.map((_, i) => {
    const boss = (i % 3) === 2;
    const state = i < run.roundIndex ? 'done' : (i === run.roundIndex ? 'current' : 'upcoming');
    const grp = (i > 0 && i % 3 === 0) ? ' group-start' : '';
    return `<span class="rt-node ${state}${boss ? ' boss' : ''}${grp}" title="${tierOf(i)}${boss ? ' — Boss' : ''}"></span>`;
  }).join('');
  app().innerHTML = `
    <div class="run-view">
    <div id="run-track">
      <div class="rt-nodes">${trackNodes}</div>
      <div class="rt-label"><b>Round ${run.roundIndex + 1}/${totalRounds}</b> &middot; ${tierOf(run.roundIndex)}${isBossRound(run.roundIndex) ? ' &middot; Boss' : ''}</div>
    </div>
    <div id="hud">
      <div>Plays ${run.playsLeft} · Discards ${run.discardsLeft} · <button id="bag-btn" class="hud-link" title="Tiles left in the bag">Bag ${run.bag.tiles.length}</button></div>
      ${coinsHtml}
      <button id="help-btn" title="How it works" style="font-size:0.85em;padding:2px 7px;border-radius:50%;cursor:pointer;">?</button>
      <button id="mute-btn" class="${isMuted() ? 'muted' : ''}" title="${isMuted() ? 'Sound off (tap for on)' : 'Sound on (tap for off)'}" style="font-size:0.95em;padding:2px 8px;border-radius:50%;cursor:pointer;">&#9834;</button>
      <button id="settings-btn" title="Settings" style="font-size:0.95em;padding:2px 8px;border-radius:50%;cursor:pointer;">&#9881;</button>
      <button id="exit-btn" title="Main menu (your run is saved)" style="font-size:0.72em;padding:3px 10px;border-radius:10px;cursor:pointer;">Menu</button>
    </div>
    <div id="score-bar">
      <div class="score-nums"><span id="score-total">${run.roundTotal}</span><span class="score-slash">/</span>${run.target}</div>
      <div class="score-track"><div class="score-fill${pct >= 100 ? ' full' : ''}" style="width:${pct}%"></div></div>
      <div class="score-togo">${toGo > 0 ? `${toGo} to clear` : 'Target met'}</div>
    </div>
    ${relicsModsPanelHtml(run)}
    ${lastPlayHtml}
    <div id="staging">${staged || '<span class="staging-hint">Tap tiles to spell a word</span>'}</div>
    ${run.boss && BOSSES[run.boss] ? `<div id="boss-banner">${bossSealHtml(run.boss, { size: 'md' })}<span><b>${BOSSES[run.boss].name}</b> &middot; ${BOSSES[run.boss].desc}</span></div>` : ''}
    ${run.chainLength > 1 ? `<div id="chain-banner">Chain &times;${run.chainLength}${run.lastWord ? ` &middot; continue with ${run.lastWord.lastLetter}` : ''}</div>` : ''}
    <div id="rack">
      ${run.rack.map(t => {
        const modBadge = t.mods && t.mods.length
          ? `<span class="mod-badge">${t.mods.map(m => (m.name || m.id)[0].toUpperCase()).join('')}</span>`
          : '';
        const tileVal = t.letter === '*' ? '' : `<span class="tile-val">${rackTileValues[t.letter] ?? 0}</span>`;
        const titleAttr = t.mods && t.mods.length
          ? ` title="${t.mods.map(m => `${m.name || m.id}: ${m.desc || ''}`).join('; ')}"`
          : '';
        return `<button class="tile ${t.mods && t.mods.length ? 'mod ' : ''}${inRack(t.id) ? 'used' : ''}" data-id="${t.id}"${titleAttr}>${t.letter === '*' ? '<span class="tile-star"></span>' : t.letter}${modBadge}${tileVal}</button>`;
      }).join('')}
    </div>
    <div id="msg"></div>
    <div id="controls">
      <button id="submit" ${done ? 'disabled' : ''}>Submit</button>
      <div id="controls-secondary">
        <button id="back" ${done ? 'disabled' : ''}>⌫</button>
        <button id="clear" ${done ? 'disabled' : ''}>Clear</button>
        <button id="discard" ${done || run.discardsLeft <= 0 || selection.length === 0 ? 'disabled' : ''}>${lineIconHtml('trash')}${`Discard${selection.length ? ' (' + selection.length + ')' : ''}`}</button>
        <button id="shuffle" ${done || run.rack.length === 0 ? 'disabled' : ''}>${lineIconHtml('arrows-shuffle')}Shuffle</button>
      </div>
      ${run.status === 'won' ? `<div class="end">🎉 Run cleared!${run.lastMetaEarned ? ` +${run.lastMetaEarned} Meta earned` : ''}</div><button id="new">Back to menu</button>` : ''}
      ${run.status === 'lost' ? `<div class="end">💀 Out of plays.${run.lastMetaEarned ? ` +${run.lastMetaEarned} Meta earned` : ''}</div><button id="new">Back to menu</button>` : ''}
    </div>
    </div>`;

  // Score count-up: animate from lastShownScore to run.roundTotal after each render.
  // Reset lastShownScore when starting fresh (null = first render ever, or round reset to 0).
  if (lastShownScore === null || run.roundTotal < lastShownScore) {
    // First render of a run, or round advanced (total resets to 0 for next round).
    lastShownScore = run.roundTotal;
  }
  if (run.roundTotal !== lastShownScore) {
    animateScoreCountUp(lastShownScore, run.roundTotal);
  }

  run.rack.forEach(t => {
    const btn = app().querySelector(`.tile[data-id="${t.id}"]`);
    if (btn && !inRack(t.id)) btn.onclick = () => tapTile(t);
  });
  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  on('submit', () => { const s = selection; selection = []; const r = handlers.onSubmit?.(s); });
  on('back', () => { selection.pop(); renderRun(run); });
  on('clear', () => { selection = []; renderRun(run); });
  on('discard', () => { const sel = selection.slice(); selection = []; handlers.onDiscard?.(sel); });
  on('new', () => { selection = []; lastShownScore = null; handlers.onRunEnd?.(); });
  on('shuffle', () => { handlers.onShuffle?.(); });
  on('help-btn', () => showHelpOverlay());
  on('bag-btn', () => showBagOverlay(run));
  on('mute-btn', () => { toggleMuted(); renderRun(run); });
  on('settings-btn', () => handlers.onOpenSettings?.());
  on('exit-btn', () => handlers.onExitToMenu?.());
  wireDescPopovers(document.getElementById('relics-mods-panel'));
}

// Keyboard handler — exported so main.js can wire it.
// Operates on module-level lastRun + selection.
// Wilds are still placed by tap only; typing only matches real-letter tiles.
export function handleRunKey(e) {
  if (!lastRun || lastRun.status !== 'playing') return;
  if (_pulling) return;     // ignore keyboard input mid-pull

  if (/^[a-zA-Z]$/.test(e.key)) {
    const L = e.key.toUpperCase();
    const tile = lastRun.rack.find(t => t.letter === L && !selection.some(s => s.tile.id === t.id));
    if (tile) {
      selection.push({ tile, letter: L });
      sfx('tap');
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

// The end-of-run trophy card (SP4). Drawn to a canvas (see broadside.js) so it can be
// saved/shared as an image; matches the live theme. Shown for status won | lost.
function renderBroadside(run, profile) {
  // Unified rank: show the player's lifetime rank including this run's score (endRun adds it after).
  const lifetimeRank = levelFor((profile?.stats?.lifetimeScore || 0) + (run.roundTotal || 0), run.config).name;
  const s = buildSummary(run, lifetimeRank);
  const won = run.status === 'won';
  const totalRounds = (run.targets || run.config.ROUND_TARGETS).length;
  const roundsCleared = won ? totalRounds : run.roundIndex;
  const best = run.bestPlay || run.lastPlay || null;
  const words = run.totalWordsThisRun || 0;
  const metaEarned = run.lastMetaEarned || 0;
  const stat = (label, val) => `<div class="re-stat"><span class="re-stat-label">${label}</span><span class="re-stat-val">${val}</span></div>`;
  app().innerHTML = `
    <div id="runend-screen">
      <div class="runend-head ${won ? 'win' : 'loss'}">${won ? 'You won!' : 'Game Over'}</div>
      <div class="runend-sub">${s.resultLine}</div>
      <div class="runend-stats">
        ${stat('Rank', s.rank)}
        ${stat('Rounds cleared', `${roundsCleared} / ${totalRounds}`)}
        ${stat('Words played', words)}
        ${stat('Best word', best ? `${(best.word || '').toUpperCase()} &middot; ${best.score}` : '&mdash;')}
        ${metaEarned ? stat('Meta earned', `+${metaEarned}`) : ''}
      </div>
      <canvas id="broadside-canvas" width="680" height="800" style="display:none;" aria-hidden="true"></canvas>
      <div id="runend-actions">
        <button id="save-broadside" class="menu-btn">Save trophy card</button>
        <button id="new" class="menu-btn primary">Continue</button>
      </div>
    </div>`;
  const canvas = document.getElementById('broadside-canvas');     // hidden; drawn only for the Save button
  const draw = () => drawBroadside(canvas, s);
  draw();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  const save = document.getElementById('save-broadside');
  if (save) save.onclick = () => shareBroadside(canvas);
  const back = document.getElementById('new');
  if (back) back.onclick = () => { selection = []; lastShownScore = null; handlers.onRunEnd?.(); };
}

function renderNodeChoice(run) {
  const coins = run.coins || 0;
  const totalAward = run.lastAward ? run.lastAward.reduce((s, x) => s + x.amount, 0) : 0;
  const shopDesc = `Earned $${totalAward} this round. Browse upgrades, relics, and letters.`;

  let eventCardHtml = '';
  if (run.nodeEventId && EVENTS[run.nodeEventId]) {
    const ev = EVENTS[run.nodeEventId];
    eventCardHtml = `
      <button class="node-card" id="pick-event">
        <div class="node-card-title">Event: ${ev.name}</div>
        <div class="node-card-desc">${ev.desc}</div>
      </button>`;
  }

  app().innerHTML = `
    <div id="hud">
      <div>Passage ${passageOf(run.roundIndex)}/${run.config.PASSAGES} &middot; ${tierOf(run.roundIndex)}${isBossRound(run.roundIndex) ? ' (boss)' : ''} cleared</div>
      <div><b>${run.roundTotal}</b> / ${run.target} Score</div>
      <div id="coins">$${coins}</div>
    </div>
    ${relicsModsPanelHtml(run)}
    <div id="node-choice">
      <button class="node-card" id="pick-shop">
        <div class="node-card-title">Shop</div>
        <div class="node-card-desc">${shopDesc}</div>
      </button>
      ${eventCardHtml ? `<div class="node-or">OR</div>${eventCardHtml}` : ''}
    </div>
    <div id="msg"></div>`;

  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  on('pick-shop', () => handlers.onPickShop?.());
  on('pick-event', () => handlers.onPickEvent?.());
  wireDescPopovers(document.getElementById('relics-mods-panel'));
}

function renderEventOneShot(run) {
  const ev = EVENTS[run.nodeEventId];
  if (!ev) { renderNodeChoice(run); return; }

  const coins = run.coins || 0;

  // Build option buttons HTML — each option may need extra input
  // We'll render the base options first; special inputs rendered via DOM after
  const optionsHtml = (ev.options || []).map((opt, i) =>
    `<button class="event-option-btn" data-opt="${i}">${opt.label}</button>`
  ).join('');
  // Wordsmith picks an archetype to Hone: show the choices INLINE (themed), each with the actual
  // effect of the next level, instead of a separate pop-up overlay.
  const optionsBody = ev.id === 'wordsmith'
    ? Object.values(ARCHETYPES).map(a => {
        const lvl = run.honeLevels?.[a.id] || 0;
        return `<button class="event-option-btn arch-choice" data-arch="${a.id}"><b>${a.name}</b> <span class="arch-lvl">Lv ${lvl} &rarr; ${lvl + 1}</span><span class="arch-desc">${honeDescription(a.id, lvl + 1)}</span></button>`;
      }).join('')
    : optionsHtml;

  app().innerHTML = `
    <div id="hud">
      <div>Passage ${passageOf(run.roundIndex)}/${run.config.PASSAGES} &middot; ${tierOf(run.roundIndex)} &middot; Event</div>
      <div><b>${run.roundTotal}</b> / ${run.target} Score</div>
      <div id="coins">$${coins}</div>
    </div>
    ${relicsModsPanelHtml(run)}
    <div id="event-ui">
      <h3>${ev.name}</h3>
      <div class="event-desc">${ev.desc}</div>
      <div id="event-options">${optionsBody}</div>
      <div id="msg" style="color:#c0392b;min-height:1.2rem;margin-top:8px;"></div>
    </div>`;

  // Wire option buttons with special-case input gathering
  (ev.options || []).forEach((opt, i) => {
    const btn = app().querySelector(`.event-option-btn[data-opt="${i}"]`);
    if (!btn) return;

    if (ev.id === 'redaction') {
      // Redaction: need 2 tile picks from the bag
      btn.onclick = () => showEventTilePicker(run, 2, (tileIds) => {
        const r = handlers.onEventOption?.(i, { tileIds });
        if (r && !r.ok) {
          const msg = document.getElementById('msg');
          if (msg) msg.textContent = r.reason === 'bad-count' ? 'Pick 1 or 2 tiles.' : 'Could not remove tiles.';
        } else {
          renderEventDone(run, ev);
        }
      });
    } else {
      // Simple confirm (theBlank, inkMerchant)
      btn.onclick = () => {
        const r = handlers.onEventOption?.(i, {});
        if (r && !r.ok) {
          const msg = document.getElementById('msg');
          if (msg) msg.textContent = r.reason === 'broke' ? 'Not enough coins.' : r.reason === 'all-owned' ? 'You own all relics.' : 'Could not apply.';
        } else {
          renderEventDone(run, ev);
        }
      };
    }
  });
  // Redaction needs tile input but no intro step: open the picker immediately (Cancel reveals the card to retry).
  if (ev.id === 'redaction') app().querySelector('.event-option-btn[data-opt="0"]')?.click();
  // Wordsmith: each inline archetype button Hones that archetype (no overlay).
  if (ev.id === 'wordsmith') {
    app().querySelectorAll('.arch-choice[data-arch]').forEach(btn => {
      btn.onclick = () => {
        const r = handlers.onEventOption?.(0, { archetypeId: btn.dataset.arch });
        if (r && !r.ok) { const msg = document.getElementById('msg'); if (msg) msg.textContent = 'Could not apply hone.'; }
        else renderEventDone(run, ev);
      };
    });
  }
  wireDescPopovers(document.getElementById('relics-mods-panel'));
}

function renderEventDone(run, ev) {
  const coins = run.coins || 0;
  const result = (ev.id === 'inkMerchant' && run.relics.length)
    ? `Gained ${run.relics[run.relics.length - 1].name}!`
    : 'Done!';
  app().innerHTML = `
    <div id="hud">
      <div>Passage ${passageOf(run.roundIndex)}/${run.config.PASSAGES} &middot; ${tierOf(run.roundIndex)} &middot; Event</div>
      <div><b>${run.roundTotal}</b> / ${run.target} Score</div>
      <div id="coins">$${coins}</div>
    </div>
    ${relicsModsPanelHtml(run)}
    <div id="event-ui">
      <h3>${ev.name}</h3>
      <div class="event-desc">${ev.desc}</div>
      <p style="font-weight:700;color:#27ae60;">${result}</p>
      <button id="continue-btn">Continue</button>
    </div>`;
  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  on('continue-btn', () => { selection = []; handlers.onContinue?.(); });
  wireDescPopovers(document.getElementById('relics-mods-panel'));
}

// Show an overlay for picking N tiles from the bag (used by Redaction event).
function showEventTilePicker(run, count, onConfirm) {
  const old = document.getElementById('event-tile-picker-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'event-tile-picker-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;z-index:100;';

  const title = document.createElement('div');
  title.textContent = `Choose up to ${count} tiles to remove:`;
  title.style.cssText = 'color:#fff;font-weight:bold;font-size:1.1em;';
  overlay.appendChild(title);

  const selected = new Set();

  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:320px;';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = `Choose 1-${count} tiles`;
  confirmBtn.disabled = true;
  confirmBtn.style.cssText = 'padding:10px 22px;font-size:1em;border-radius:6px;cursor:pointer;margin-top:8px;';

  run.bag.tiles.forEach(tile => {
    const modsLabel = tile.mods && tile.mods.length
      ? ` [${tile.mods.map(m => m.name || m.id[0].toUpperCase()).join(', ')}]` : '';
    const btn = document.createElement('button');
    btn.textContent = tile.letter + modsLabel;
    btn.style.cssText = 'padding:10px 14px;font-size:1em;border-radius:6px;cursor:pointer;';
    btn.dataset.id = tile.id;
    btn.onclick = () => {
      if (selected.has(tile.id)) {
        selected.delete(tile.id);
        btn.style.outline = '';
      } else if (selected.size < count) {
        selected.add(tile.id);
        btn.style.outline = '2px solid #3b7dd8';
      }
      confirmBtn.disabled = selected.size < 1;
      confirmBtn.textContent = selected.size < 1 ? `Choose 1-${count} tiles` : `Remove ${selected.size} tile${selected.size === 1 ? '' : 's'}`;
    };
    grid.appendChild(btn);
  });
  overlay.appendChild(grid);

  confirmBtn.onclick = () => {
    overlay.remove();
    onConfirm([...selected]);
  };
  overlay.appendChild(confirmBtn);

  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.style.cssText = 'padding:8px 20px;font-size:0.95em;border-radius:6px;cursor:pointer;';
  cancel.onclick = () => overlay.remove();
  overlay.appendChild(cancel);

  document.body.appendChild(overlay);
}

function renderPress(run) {
  const st = run.press || {};
  const coins = run.coins || 0;
  const drawn = st.drawn || [];
  const drawnDisplay = drawn.length ? drawn.join(' ') : 'No letters drawn yet';
  const pot = st.pot || 0;
  const busted = !!st.busted;
  // After pressBank, run.press is null — detect completion by run._nodePick still being 'event'
  const pressComplete = !run.press && run._nodePick === 'event';
  const drawDisabled = busted || pressComplete ? 'disabled' : '';
  const bankDisabled = (busted || pot === 0 || pressComplete) ? 'disabled' : '';

  let resultHtml = '';
  if (busted) {
    resultHtml = `<div id="press-result" style="color:#c0392b;">Busted! Lost the pot.</div>`;
  } else if (pressComplete) {
    resultHtml = `<div id="press-result" style="color:#27ae60;">Banked $${ run._pressLastPot || pot}!</div>`;
  }

  const showContinue = busted || pressComplete;

  app().innerHTML = `
    <div id="hud">
      <div>Passage ${passageOf(run.roundIndex)}/${run.config.PASSAGES} &middot; ${tierOf(run.roundIndex)} &middot; The Press</div>
      <div><b>${run.roundTotal}</b> / ${run.target} Score</div>
      <div id="coins">$${coins}</div>
    </div>
    ${relicsModsPanelHtml(run)}
    <div id="press-ui">
      <h3>The Press</h3>
      <p style="font-size:0.9em;color:#7a3c00;margin:0 0 8px;">Each <b>Draw</b> reveals a letter and adds its point value to the pot. <b>Bank</b> takes the pot as $; or Draw again to push your luck. Draw a letter you have already drawn and you <b>bust</b>, losing the whole pot.</p>
      <div id="press-drawn">${drawnDisplay}</div>
      <div id="press-pot">Pot: $${pot}</div>
      <div id="press-controls">
        <button id="press-draw" ${drawDisabled}>Draw</button>
        <button id="press-bank" ${bankDisabled}>Bank $${pot}</button>
      </div>
      ${resultHtml}
      ${showContinue ? '<button id="continue-btn" style="display:block;margin:12px auto 0;">Continue</button>' : ''}
    </div>
    <div id="msg"></div>`;

  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  on('press-draw', () => handlers.onPressDraw?.());
  on('press-bank', () => handlers.onPressBank?.());
  on('continue-btn', () => { selection = []; handlers.onContinue?.(); });
  wireDescPopovers(document.getElementById('relics-mods-panel'));
}

// Return { name, desc } for offer types that have a description worth surfacing.
// Returns null when there is no extra description (letter buy, upgrade, thin).
function offerInfoData(offer) {
  switch (offer.type) {
    case 'buyEnchantedTile':
    case 'enchantTile': {
      const mod = getMod(offer.modId);
      if (!mod?.desc) return null;
      return { name: mod.name || offer.modId, desc: mod.desc };
    }
    case 'buyRelic': {
      const relic = RELICS[offer.relicId];
      if (!relic?.desc) return null;
      return { name: relic.name || offer.relicId, desc: relic.desc };
    }
    case 'hone': {
      const arch = ARCHETYPES[offer.archetypeId];
      if (!arch?.desc) return null;
      return { name: arch.name || offer.archetypeId, desc: arch.desc };
    }
    default: return null;
  }
}

// Full card data for an in-run shop offer: category caption, name, description, icon HTML.
// Mirrors the Meta Shop's card vocabulary so both shops read as one family.
function shopOfferCard(offer) {
  const badge = (cls, inner) => `<span class="meta-badge ${cls}">${inner}</span>`;
  const tile = (l) => badge('letter', l);
  const util = (icon) => badge('util', lineIconHtml(icon));
  switch (offer.type) {
    case 'buyRelic': {
      const r = RELICS[offer.relicId];
      return { cat: 'Relic', name: r?.name || offer.relicId, desc: r?.desc || '', icon: relicSealHtml(offer.relicId, { size: 'md' }) };
    }
    case 'buyEnchantedTile': {
      const m = getMod(offer.modId);
      return { cat: 'Enchant', name: `${offer.letter} + ${m?.name || offer.modId}`, desc: m?.desc || '', icon: tile(offer.letter) };
    }
    case 'enchantTile': {
      const m = getMod(offer.modId);
      return { cat: 'Enchant', name: m?.name || offer.modId, desc: `Enchant a tile: ${m?.desc || ''}`, icon: badge('mod', (m?.name || '?').slice(0, 1)) };
    }
    case 'buyLetter':
      return { cat: 'Letter', name: `Buy ${offer.letter}`, desc: `Add ${/^[AEIOU]/.test(offer.letter) ? 'an' : 'a'} ${offer.letter} tile to your bag`, icon: tile(offer.letter) };
    case 'upgradeLetter':
      return { cat: 'Upgrade', name: `Upgrade ${offer.letter} +${offer.plus}`, desc: `Every ${offer.letter} tile is worth +${offer.plus} Point${offer.plus === 1 ? '' : 's'}`, icon: tile(offer.letter) };
    case 'thinLetter':
      return { cat: 'Bag', name: 'Thin the bag', desc: 'Remove a tile of your choice from your bag', icon: util('trash') };
    case 'recastTile':
      return { cat: 'Recast', name: 'Recast a tile', desc: 'Change one tile to a letter you choose', icon: util('refresh') };
    case 'transferMods':
      return { cat: 'Transfer', name: 'Transfer mods', desc: "Move a tile's mods onto another (destroys the source)", icon: util('arrows-shuffle') };
    case 'hone': {
      const a = ARCHETYPES[offer.archetypeId];
      const lvl = (lastRun?.honeLevels?.[offer.archetypeId] || 0);
      return { cat: `Hone &middot; Lv ${lvl}&rarr;${lvl + 1}`, name: a?.name || offer.archetypeId, desc: a?.desc || '', icon: badge('hone', lineIconHtml('tools')) };
    }
    default:
      return { cat: '', name: offerLabel(offer), desc: '', icon: '' };
  }
}

function renderShop(run) {
  const shop = run.shop;
  const coins = run.coins || 0;
  const canAfford = (cost) => coins >= cost;

  const offersHtml = shop.offers.map((offer, i) => {
    const { cat, name, desc, icon } = shopOfferCard(offer);
    const cant = !canAfford(offer.cost);
    const cls = `meta-card shop-card${offer.type === 'buyRelic' ? ' is-relic' : ''}${cant ? ' cant' : ''}`;
    return `<button class="${cls}" data-idx="${i}"${cant ? ' disabled' : ''}>
      <span class="meta-card-icon">${icon}</span>
      <span class="meta-card-body">${cat ? `<span class="shop-cat">${cat}</span>` : ''}<b class="meta-card-name">${name}</b>${desc ? `<span class="meta-card-desc">${desc}</span>` : ''}<span class="meta-card-cost">${lineIconHtml('coins')}${offer.cost}</span></span>
    </button>`;
  }).join('');

  const freeRerolls = run.freeRerollsLeft || 0;
  const rerollDisabled = (freeRerolls <= 0 && !canAfford(shop.rerollCost)) ? 'disabled' : '';
  const rerollLabel = freeRerolls > 0 ? `Reroll <span class="free-pill">free &times;${freeRerolls}</span>` : `Reroll ($${shop.rerollCost})`;

  let lastAwardHtml = '';
  if (run.lastAward && run.lastAward.length) {
    const total = run.lastAward.reduce((s, x) => s + x.amount, 0);
    const breakdown = run.lastAward.map(x => `${x.label} $${x.amount}`).join(' · ');
    lastAwardHtml = `<div id="scorebug">Earned $${total}  ·  ${breakdown}</div>`;
  }

  app().innerHTML = `
    <div class="shop-counter">
      <span class="sc-title">${lineIconHtml('building-store')}<span class="sc-main">The Press Shop</span><span class="sc-sub">Passage ${passageOf(run.roundIndex)}/${run.config.PASSAGES} &middot; ${tierOf(run.roundIndex)} cleared</span></span>
      <span class="shop-wallet">${lineIconHtml('coins')}${coins}</span>
    </div>
    ${relicsModsPanelHtml(run)}
    ${lastAwardHtml}
    <div id="shop">
      <div class="shop-grid">${offersHtml}</div>
      <div id="shop-actions">
        <button id="reroll" ${rerollDisabled}>${lineIconHtml('refresh')}${rerollLabel}</button>
        <button id="continue">${lineIconHtml('player-track-next')}Continue</button>
      </div>
    </div>
    <div id="msg"></div>`;

  // Wire offer buttons.
  shop.offers.forEach((offer, i) => {
    const btn = app().querySelector(`.shop-card[data-idx="${i}"]`);
    if (!btn || btn.disabled) return;
    btn.onclick = () => {
      if (offer.type === 'recastTile') showRecastPicker(run, offer);
      else if (offer.type === 'transferMods') showTransferPicker(run, offer);
      else if (needsTilePicker(offer)) showTilePicker(run, offer);
      else reportBuy(handlers.onBuy?.(offer));
    };
  });

  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  on('reroll', () => handlers.onReroll?.());
  on('continue', () => { selection = []; handlers.onContinue?.(); });
  wireDescPopovers(document.getElementById('relics-mods-panel'));
}

function showStatsOverlay(summary) {
  const old = document.getElementById('stats-overlay');
  if (old) { old.remove(); return; }
  if (!summary) return;

  const overlay = document.createElement('div');
  overlay.id = 'stats-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:200;padding:16px;box-sizing:border-box;overflow-y:auto;';

  const box = document.createElement('div');
  box.style.cssText = 'background:var(--night-2);color:var(--ink);border:1px solid var(--line);border-top:3px solid var(--gold);border-radius:10px;padding:20px 24px;max-width:420px;width:100%;font-size:0.93em;line-height:1.5;max-height:80vh;overflow-y:auto;box-shadow:0 12px 32px rgba(0,0,0,0.6);box-sizing:border-box;';

  const pct = (r) => (r * 100).toFixed(1) + '%';
  const rowsHtml = summary.items.length
    ? summary.items.map(it =>
        `<tr>
          <td>${it.id}</td>
          <td>${pct(it.pickRate)} (${it.purchased}/${it.offered})</td>
          <td>${pct(it.winRate)} (${it.winsWith}/${it.runsWith})</td>
          <td>${it.runsWith}</td>
        </tr>`
      ).join('')
    : '<tr><td colspan="4">(no data yet)</td></tr>';

  box.innerHTML = `
    <h3 style="margin:0 0 10px;color:var(--gold);font-family:var(--font-display);">Balance Stats</h3>
    <p>Runs: <b>${summary.runs}</b> &nbsp; Wins: <b>${summary.wins}</b> &nbsp; Win rate: <b>${pct(summary.winRate)}</b></p>
    <p>Avg word length: <b>${summary.avgWordLen.toFixed(1)}</b></p>
    <table style="width:100%;border-collapse:collapse;font-size:0.9em;">
      <thead><tr style="border-bottom:1px solid var(--line);">
        <th style="text-align:left;">Item</th>
        <th style="text-align:left;">Pick rate</th>
        <th style="text-align:left;">Win rate</th>
        <th style="text-align:left;">Runs with</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
  overlay.appendChild(box);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = 'padding:10px 28px;font-size:1em;font-weight:700;border-radius:6px;cursor:pointer;border:1px solid var(--gold);background:var(--night-2);color:var(--gold);';
  closeBtn.onclick = () => overlay.remove();
  overlay.appendChild(closeBtn);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ---- Front-of-game shell: main menu / settings / achievements ---------------
// Consistent top-left back arrow for pushed screens (Setup / Meta Shop / Settings / Achievements).
const backArrowHtml = () => `<button class="back-arrow" id="back-arrow" aria-label="Back" title="Back">${lineIconHtml('arrow-left')}</button>`;
function wireBack() { const b = document.getElementById('back-arrow'); if (b) b.onclick = () => handlers.onBackToMenu?.(); }

export function renderMenu(hasRun, metaTotal = 0, pending = 0) {
  const badge = pending > 0 ? ` <span class="menu-badge" title="ready to collect">${pending}</span>` : '';
  app().innerHTML = `
    <div id="main-menu">
      <div class="menu-title">Letter Ride</div>
      <div class="menu-tagline">A word-builder roguelike</div>
      <div class="menu-rule">&#10086;</div>
      <div class="menu-buttons">
        ${hasRun ? `<button id="menu-resume" class="menu-btn primary">${lineIconHtml('player-play')}Resume Run</button>` : ''}
        <button id="menu-new" class="menu-btn${hasRun ? '' : ' primary'}">${lineIconHtml('plus')}New Run</button>
        <button id="menu-metashop" class="menu-btn">${lineIconHtml('building-store')}Meta Shop</button>
        <button id="menu-settings" class="menu-btn">${lineIconHtml('settings')}Settings</button>
        <button id="menu-achievements" class="menu-btn">${lineIconHtml('trophy')}Achievements${badge}</button>
        <button id="menu-stats" class="menu-btn">${lineIconHtml('chart-bar')}Stats</button>
      </div>
      <div class="menu-meta">${metaSealHtml({ size: 'sm' })}<span>Meta: ${metaTotal}</span></div>
    </div>`;
  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  on('menu-resume', () => handlers.onResume?.());
  on('menu-new', () => handlers.onNewRun?.());
  on('menu-metashop', () => handlers.onOpenMetaShop?.());
  on('menu-settings', () => handlers.onOpenSettings?.());
  on('menu-achievements', () => handlers.onOpenAchievements?.());
  on('menu-stats', () => handlers.onOpenStats?.());
}

// The Stats screen: comprehensive player-facing analytics, derived by statsSummary (profile.js).
// Lives below Achievements in the menu. Pure formatting here; no rules.
export function renderStats(profile, config, allRelicIds = [], allModIds = [], ACHIEVEMENTS = []) {
  const sum = statsSummary(profile, config, { relicsTotal: allRelicIds.length, modsTotal: allModIds.length, achievementsTotal: (ACHIEVEMENTS || []).length });
  const pct = (x) => `${Math.round(x * 100)}%`;
  const d1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
  const dash = '&mdash;';
  const tile = (val, label, sub = '', cls = '') => `<div class="stat-tile${cls ? ' ' + cls : ''}"><span class="stat-val">${val}</span><span class="stat-label">${label}</span>${sub ? `<span class="stat-sub">${sub}</span>` : ''}</div>`;
  const nextName = config.LEVELS.names[sum.rank.index + 1];

  const rankBanner = `<div class="stat-rank">
    <div class="stat-rank-top"><span class="stat-rank-name">${sum.rank.name}</span><span class="stat-rank-score">${sum.lifetimeScore} lifetime Score</span></div>
    ${sum.rank.nextAt
      ? `<div class="stat-rank-bar"><span class="stat-rank-fill" style="width:${Math.round(sum.rank.progress * 100)}%"></span></div><div class="stat-rank-next">${Math.max(0, sum.rank.nextAt - sum.lifetimeScore)} Score to ${nextName}</div>`
      : `<div class="stat-rank-next">Top rank reached</div>`}
  </div>`;

  const runsSection = [
    tile(sum.runs, 'Runs played'),
    tile(pct(sum.winRate), 'Win rate', `${sum.wins} of ${sum.runs}`),
    tile(sum.bestRunScore, 'Best run'),
    tile(sum.roundsCleared, 'Rounds cleared'),
    tile(sum.runs ? d1(sum.avgRoundsPerRun) : dash, 'Avg rounds / run'),
  ].join('');

  const wordsSection = [
    tile(sum.wordsPlayed, 'Words played'),
    tile(sum.wordsPlayed ? d1(sum.avgWordLength) : dash, 'Avg word length'),
    tile(sum.longestWord ? sum.longestWord.toUpperCase() : dash, 'Longest word', sum.longestWordLen ? `${sum.longestWordLen} letters` : '', 'word'),
    tile(sum.bestWord ? sum.bestWord.toUpperCase() : dash, 'Best word', sum.bestWordScore ? `${sum.bestWordScore} Score` : '', 'word'),
    tile(sum.bestRoundScore, 'Best round'),
    tile(sum.wordsPlayed ? d1(sum.avgScorePerWord) : dash, 'Avg Score / word'),
  ].join('');

  const collectionSection = [
    tile(`${sum.relicsDiscovered}<span class="stat-of">/${sum.relicsTotal}</span>`, 'Relics found'),
    tile(`${sum.modsDiscovered}<span class="stat-of">/${sum.modsTotal}</span>`, 'Tile-mods found'),
    tile(`${sum.achievementsDone}<span class="stat-of">/${sum.achievementsTotal}</span>`, 'Achievements', `${sum.achievementsClaimed} collected`),
  ].join('');

  // "The wall": where runs end. A bar per round (runs that died there) + a final Won bar; bosses tinted.
  const totalRounds = config.ROUND_TARGETS.length;
  const counts = Array.from({ length: totalRounds }, (_, i) => sum.lossByRound[i] || 0);
  const maxBar = Math.max(1, sum.wins, ...counts);
  const cols = counts.map((c, i) => {
    const boss = i % 3 === 2;
    return `<div class="wall-col${boss ? ' boss' : ''}"><span class="wall-bar" style="height:${Math.round((c / maxBar) * 100)}%"${c ? ` title="${c} ended at round ${i + 1}"` : ''}></span><span class="wall-num">${i + 1}</span></div>`;
  }).join('');
  const wonCol = `<div class="wall-col won"><span class="wall-bar" style="height:${Math.round((sum.wins / maxBar) * 100)}%" title="${sum.wins} won"></span><span class="wall-num">&#10003;</span></div>`;
  const wallSection = sum.runs > 0
    ? `<div class="stat-section"><h3>Where runs end</h3>${sum.wall ? `<p class="wall-headline">Your wall: <b>Round ${sum.wall.roundIndex + 1}</b> &middot; Passage ${passageOf(sum.wall.roundIndex)} &middot; ${sum.wall.count} run${sum.wall.count === 1 ? '' : 's'} ended here</p>` : `<p class="wall-headline">No losses yet. ${sum.wins} win${sum.wins === 1 ? '' : 's'} so far.</p>`}<div class="wall-chart">${cols}${wonCol}</div></div>`
    : '';

  // Word-length usage histogram (reuses the bar-chart styles; .len tints the bars gold).
  const minLen = config.MIN_WORD_LEN || 3;
  const wlc = sum.wordLenCounts || {};
  // Span the full spellable range: minLen .. hand size (RACK_SIZE), extending if a longer word exists.
  const maxLen = Math.max(config.RACK_SIZE || 9, sum.longestWordLen || 0);
  const lenEntries = [];
  for (let L = minLen; L <= maxLen; L++) lenEntries.push([L, wlc[L] || 0]);
  const maxLenBar = Math.max(1, ...lenEntries.map(([, c]) => c));
  const modeLen = lenEntries.reduce((best, e) => (e[1] > best[1] ? e : best), [0, -1])[0];
  const lenCols = lenEntries.map(([L, c]) => `<div class="wall-col len"><span class="wall-bar" style="height:${Math.round((c / maxLenBar) * 100)}%"${c ? ` title="${c} word${c === 1 ? '' : 's'} of ${L} letters"` : ''}></span><span class="wall-num">${L}</span></div>`).join('');
  const lenSection = sum.wordsPlayed > 0
    ? `<div class="stat-section"><h3>Word length</h3><p class="wall-headline">Most of your words are <b>${modeLen}</b> letters</p><div class="wall-chart">${lenCols}</div></div>`
    : '';

  const section = (label, body) => `<div class="stat-section"><h3>${label}</h3><div class="stat-grid">${body}</div></div>`;
  const emptyNote = sum.runs === 0 ? `<p class="setup-sub">Play a run to start building your stats.</p>` : '';

  app().innerHTML = `
    ${backArrowHtml()}
    <div id="menu-screen" class="stats">
      <div class="menu-title small">Stats</div>
      ${emptyNote}
      ${rankBanner}
      ${section('Runs', runsSection)}
      ${wallSection}
      ${section('Words', wordsSection)}
      ${lenSection}
      ${section('Collection', collectionSection)}
    </div>`;
  wireBack();
}

// Dump the persistent stores (profile + balance telemetry + meta) as JSON, so phone play can feed
// the tuning loop without a backend: the author copies it and pastes it back for analysis.
function buildExportJSON() {
  const read = (k) => { try { return JSON.parse(window.localStorage.getItem(k)); } catch { return null; } };
  return JSON.stringify({
    letterRideExport: 1,
    exportedAt: new Date().toISOString(),
    profile: read('letterRide.profile'),
    telemetry: read('letterRide.telemetry'),
    meta: read('letterRide.meta'),
  }, null, 2);
}

function showExportOverlay() {
  document.getElementById('export-overlay')?.remove();
  const json = buildExportJSON();
  const overlay = document.createElement('div');
  overlay.id = 'export-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:200;padding:18px;';
  overlay.innerHTML = `
    <div style="font-family:var(--font-display);font-weight:700;color:var(--gold);font-size:1.15rem;">Export data</div>
    <div style="font-size:0.8rem;color:var(--ink-soft);max-width:520px;text-align:center;line-height:1.4;">Your stats + balance telemetry as JSON. Copy it or download the file, then send it back to feed the tuning loop.</div>
    <textarea readonly style="width:min(560px,92vw);height:44vh;background:var(--night-sunk);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:10px;font-family:monospace;font-size:0.72rem;resize:none;">${json.replace(/</g, '&lt;')}</textarea>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
      <button id="export-copy" class="menu-btn">Copy</button>
      <button id="export-download" class="menu-btn">Download .json</button>
      <button id="export-close" class="menu-btn">Close</button>
    </div>`;
  document.body.appendChild(overlay);
  const ta = overlay.querySelector('textarea');
  overlay.querySelector('#export-copy').onclick = async () => {
    const btn = overlay.querySelector('#export-copy');
    try { await navigator.clipboard.writeText(json); btn.textContent = 'Copied!'; }
    catch { ta.focus(); ta.select(); btn.textContent = 'Select + copy'; }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
  };
  overlay.querySelector('#export-download').onclick = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `letter-ride-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  overlay.querySelector('#export-close').onclick = () => overlay.remove();
}

export function renderSettings(hasRun) {
  const ts = getPref('textSize') === 'large' ? 'Large' : 'Normal';
  app().innerHTML = `
    ${backArrowHtml()}
    <div id="menu-screen">
      <div class="menu-title small">Settings</div>
      <h3 class="settings-h">Audio</h3>
      <div class="menu-buttons">
        <button id="set-sound" class="menu-btn">Sound effects: ${isMuted() ? 'Off' : 'On'}</button>
      </div>
      <h3 class="settings-h">Motion</h3>
      <div class="menu-buttons">
        <button id="set-motion" class="menu-btn">Reduced motion: ${getPref('reducedMotion') ? 'On' : 'Off'}</button>
        <button id="set-scoring" class="menu-btn">Scoring reveal: ${ { full: 'Full', fast: 'Fast', off: 'Off' }[getPref('scoringSpeed')] || 'Full' }</button>
      </div>
      <h3 class="settings-h">Display</h3>
      <div class="menu-buttons">
        <button id="set-textsize" class="menu-btn">Text size: ${ts}</button>
      </div>
      ${hasRun ? `<h3 class="settings-h">Run</h3><div class="menu-buttons"><button id="set-abandon" class="menu-btn danger">Abandon current run</button></div>` : ''}
      <h3 class="settings-h">Developer</h3>
      <div class="menu-buttons">
        <button id="set-telemetry" class="menu-btn">${lineIconHtml('chart-bar')}Balance telemetry</button>
        <button id="set-export" class="menu-btn">Export data (JSON)</button>
      </div>
      <h3 class="settings-h">App update</h3>
      ${updaterStatusHtml()}
      <div class="menu-buttons">
        <button id="set-update-check" class="menu-btn">Check for update now</button>
      </div>
    </div>`;
  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  on('set-sound', () => { toggleMuted(); renderSettings(hasRun); });
  on('set-motion', () => { togglePref('reducedMotion'); renderSettings(hasRun); });
  on('set-scoring', () => { const c = getPref('scoringSpeed') || 'full'; setPref('scoringSpeed', c === 'full' ? 'fast' : c === 'fast' ? 'off' : 'full'); renderSettings(hasRun); });
  on('set-textsize', () => { setPref('textSize', getPref('textSize') === 'large' ? 'normal' : 'large'); applyDisplayPrefs(); renderSettings(hasRun); });
  on('set-abandon', () => handlers.onAbandonRun?.());
  on('set-telemetry', () => handlers.onOpenTelemetry?.());
  on('set-export', () => showExportOverlay());
  on('set-update-check', async () => {
    const btn = document.getElementById('set-update-check');
    if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
    await checkNow();
    renderSettings(hasRun);
  });
  wireBack();
}

// OTA self-update diagnostics for Settings → Developer. Reads the persisted updater state so an
// on-device failure (download error, offline, stale bundle) is visible instead of silently swallowed.
function updaterStatusHtml() {
  const s = updaterState();
  if (!s.supported) {
    return `<p class="setup-sub">Over-the-air updates are Android-only. In a browser there is nothing to update.</p>`;
  }
  const label = {
    idle: 'Idle', checking: 'Checking…', 'up-to-date': 'Up to date', downloading: 'Downloading update…',
    applying: 'Applying update…', offline: 'Offline / cannot reach update server', error: 'Error', unsupported: 'Not supported',
  }[s.status] || s.status;
  const rows = [
    ['Status', label],
    ['Installed version', s.currentVersion ?? '—'],
    ['Latest version', s.remoteVersion ?? '—'],
    ['Last checked', s.lastCheck ? `${s.lastCheck}${s.trigger ? ` (${s.trigger})` : ''}` : 'never'],
  ];
  if (s.lastError) rows.push(['Last error', s.lastError]);
  const tr = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  return `<table class="telem-table">${tr}</table>`;
}

// Dev/author balance view: surfaces telemetry.summarize() - per-archetype play share + avg Score
// (the build-diversity meter) and per-item pick rate + win rate (the "joker win rate"). Local signal.
export function renderTelemetry(summary) {
  const pct = (x) => `${Math.round((x || 0) * 100)}%`;
  const nm = (id) => RELICS[id]?.name || getMod(id)?.name || id;

  const archRows = (summary.archetypes || [])
    .slice().sort((a, b) => b.plays - a.plays)
    .map(a => `<tr><td>${ARCHETYPES[a.id]?.name || a.id}</td><td>${a.plays}</td><td>${pct(a.playShare)}</td><td>${Math.round(a.avgScore)}</td></tr>`).join('');

  const itemRows = (summary.items || [])
    .filter(it => it.offered > 0 || it.runsWith > 0)
    .slice().sort((a, b) => (b.runsWith - a.runsWith) || (b.offered - a.offered))
    .map(it => `<tr><td>${nm(it.id)}</td><td>${pct(it.pickRate)}</td><td>${it.runsWith}</td><td>${it.runsWith ? pct(it.winRate) : '&mdash;'}</td></tr>`).join('');

  app().innerHTML = `
    ${backArrowHtml()}
    <div id="menu-screen" class="telemetry">
      <div class="menu-title small">Balance telemetry</div>
      <p class="setup-sub">Local-only tuning signal (dev). How do real runs compare to the eval harness? Resettable.</p>
      <p class="telem-overall">Runs <b>${summary.runs}</b> &middot; Win rate <b>${pct(summary.winRate)}</b> &middot; Avg word length <b>${(summary.avgWordLen || 0).toFixed(1)}</b></p>
      <h3 class="settings-h">Archetypes &middot; build diversity</h3>
      ${archRows ? `<table class="telem-table"><tr><th>Archetype</th><th>Plays</th><th>Share</th><th>Avg</th></tr>${archRows}</table>` : '<p class="none-label">No plays recorded yet.</p>'}
      <h3 class="settings-h">Relics &amp; mods &middot; pick + win rate</h3>
      ${itemRows ? `<table class="telem-table"><tr><th>Item</th><th>Pick</th><th>Runs</th><th>Win</th></tr>${itemRows}</table>` : '<p class="none-label">No offers recorded yet.</p>'}
    </div>`;
  wireBack();
}

export function renderAchievements(profile, config, ACHIEVEMENTS, allRelicIds = [], allModIds = []) {
  const done = new Set(profile?.completed || []);
  const claimed = new Set(profile?.claimedAchievements || []);
  const s = profile?.stats || {};
  const ach = config.META.achievement;
  const rewardFor = (a) => (ach.rewardOverride && ach.rewardOverride[a.id]) ?? ach.reward[a.bucket];
  // Minimal progress for the two countable discovery achievements (richer bars deferred to polish).
  const progressFor = (a) => {
    if (a.id === 'curator')   return `${(s.relicsEverUsed || []).length}/${allRelicIds.length}`;
    if (a.id === 'enchanter') return `${(s.modsEverApplied || []).length}/${allModIds.length}`;
    return '';
  };
  const buckets = [
    ['onboarding', 'First Proofs'],
    ['progression', 'Ranks'],
    ['mastery', 'Pressmanship'],
    ['diversity', 'The Repertoire'],
    ['discovery', 'Discovery'],
  ];
  // Feat-first rows. Completed-unclaimed rows get a Collect button (the only path that pays Meta).
  const rowsFor = (bucket) => (ACHIEVEMENTS || []).filter(a => a.bucket === bucket).map(a => {
    const isClaimed = claimed.has(a.id), isDone = done.has(a.id), earned = isDone || isClaimed;
    let right;
    if (isClaimed) right = `<span class="ach-claimed">collected</span>`;
    else if (isDone) right = `<button class="ach-collect" data-collect-ach="${a.id}">Collect +${rewardFor(a)}</button>`;
    else {
      const pr = progressFor(a);
      let bar = '';
      if (pr) { const [n, d] = pr.split('/').map(Number); const pct = d ? Math.max(0, Math.min(100, Math.round(100 * n / d))) : 0; bar = `<span class="ach-bar" title="${pr}"><span class="ach-bar-fill" style="width:${pct}%"></span></span>`; }
      right = `${bar}<span class="ach-reward">${pr ? pr + ' · ' : ''}+${rewardFor(a)} Meta</span>`;
    }
    return `<div class="ach-row ${isClaimed ? 'claimed' : isDone ? 'ready' : 'locked'}">
      ${bucketBadgeHtml(bucket, earned)}
      <span class="ach-name">${a.name}</span>
      <span class="ach-desc">${a.desc}</span>
      ${right}
    </div>`;
  }).join('');
  const sections = buckets.map(([k, label]) => `<div class="ach-section"><h3>${label}</h3>${rowsFor(k)}</div>`).join('');

  // Bounty grid: stakes x ALL decks. Earned-unclaimed cells are clickable to collect; claimed are filled.
  const stakes = config.STAKES.map(x => x.id);
  const decks = Object.keys(config.DECKS);
  const gridHead = `<tr><th></th>${stakes.map(x => `<th>S${x}</th>`).join('')}</tr>`;
  const gridRows = decks.map(d => {
    const cells = stakes.map(st => {
      const key = `${st}:${d}`;
      if (profile?.bountyClaimed?.[key]) return `<td class="bounty-cell claimed">&#9733;</td>`;
      if (profile?.bountyEarned?.[key]) return `<td class="bounty-cell ready"><button class="bounty-collect" data-collect-bounty="${key}">+${config.META.bounty[st] || 0}</button></td>`;
      return `<td class="bounty-cell locked">&middot;</td>`;
    }).join('');
    return `<tr><th>${config.DECKS[d].name}</th>${cells}</tr>`;
  }).join('');

  const lvl = levelFor(s.lifetimeScore || 0, config);
  const pending = pendingMeta(profile, config);
  const statsPanel = `<div class="ach-stats">
    <p>Rank <b>${lvl.name}</b>${lvl.nextAt ? ` &middot; next at ${lvl.nextAt} lifetime Score (now ${s.lifetimeScore || 0})` : ' &middot; max'}</p>
    <p>Achievements <b>${done.size} / ${ACHIEVEMENTS.length}</b> unlocked &middot; ${claimed.size} collected</p>
    <p>Runs <b>${s.runs || 0}</b> &middot; Wins <b>${s.wins || 0}</b> &middot; Rounds cleared <b>${s.roundsCleared || 0}</b></p>
    <p>Best word <b>${s.bestWord || '&mdash;'}</b> (${s.bestWordScore || 0}) &middot; Best run <b>${s.bestRunScore || 0}</b></p>
  </div>`;
  const pendingHtml = pending > 0 ? `<div class="ach-pending">${pending} Meta to collect</div>` : '';

  app().innerHTML = `
    ${backArrowHtml()}
    <div id="menu-screen" class="achievements">
      <div class="menu-title small">Achievements</div>
      ${statsPanel}
      ${pendingHtml}
      ${sections}
      <div class="ach-section"><h3>Bounties</h3><table class="bounty-grid">${gridHead}${gridRows}</table></div>
    </div>`;
  wireBack();
  app().querySelectorAll('[data-collect-ach]').forEach(b => { b.onclick = () => handlers.onCollectAchievement?.(b.dataset.collectAch); });
  app().querySelectorAll('[data-collect-bounty]').forEach(b => { b.onclick = () => handlers.onCollectBounty?.(b.dataset.collectBounty); });
}

// Feat-first unlock toast. Celebrates the achievement; the Meta is collected separately on the
// Achievements screen, so the toast never shows a payout. Queued so multiple unlocks don't collide.
let _toastQueue = [];
let _toastBusy = false;
export function achievementToast(a) {
  _toastQueue.push(a);
  if (!_toastBusy) _drainToasts();
}
function _drainToasts() {
  const a = _toastQueue.shift();
  if (!a) { _toastBusy = false; return; }
  _toastBusy = true;
  const el = document.createElement('div');
  el.className = 'ach-toast';
  el.innerHTML = `<span class="t-tag">Unlocked</span><span class="t-name">${a.name}</span>`;
  document.body.appendChild(el);
  try { sfx('cash'); } catch {}
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => { el.remove(); _drainToasts(); }, 300); }, 2000);
}

// Run Setup: pick the bag + stake for THIS run, then Start Run. No meta-shop here.
// Note: selectedDeckId/selectedStakeId are module-level (top of file); this screen owns them now,
// re-renders itself on a pick, and resets them on Start Run.
// The "Your run" panel: a peek at the chosen bag's tiles laid out, the run's starting numbers, and
// the first-round target at the chosen stake. UI-only (reads config/meta; no rules); recomputed on
// every bag/stake pick. The first target mirrors meta.applyStakeTargets (Math.ceil(base * mult)).
function runPreviewHtml(meta, config, deckId, stakeId) {
  const deck = config.DECKS[deckId];
  const bag = (deck && deck.startingBag) || config.STARTING_BAG || [];
  const stake = config.STAKES.find(s => s.id === stakeId) || { targetMult: 1, playsDelta: 0, discardsDelta: 0 };
  const TV = config.TILE_VALUES || {};
  const isV = (l) => 'AEIOU'.includes(l), isW = (l) => l === '*', isR = (l) => 'JQXZ'.includes(l);
  const cat = (l) => isW(l) ? 4 : isV(l) ? 0 : isR(l) ? 3 : 1;     // group vowels, consonants, rares, wilds
  const sorted = bag.slice().sort((a, b) => cat(a) - cat(b) || ((TV[a] || 0) - (TV[b] || 0)) || a.localeCompare(b));
  const tray = sorted.map((l) => l === '*'
    ? `<span class="run-tile wild">&#9733;</span>`
    : `<span class="run-tile">${l}<i>${TV[l] ?? 0}</i></span>`).join('');
  const v = bag.filter(isV).length, w = bag.filter(isW).length, r = bag.filter(isR).length, c = bag.length - v - w - r;
  const pct = (n) => (bag.length ? (n / bag.length * 100).toFixed(1) : 0) + '%';
  const plays = config.PLAYS_PER_ROUND + (stake.playsDelta || 0);
  const discards = config.DISCARDS_PER_ROUND + (stake.discardsDelta || 0) + (meta.loadout?.extraDiscards || 0);
  const startCoins = meta.loadout?.startCoins || 0;
  const base = config.ROUND_TARGETS[0];
  const target = Math.ceil(base * (stake.targetMult ?? 1));
  return `
    <div class="run-tray">${tray}</div>
    <div class="run-mixbar"><i class="mix-v" style="width:${pct(v)}"></i><i class="mix-c" style="width:${pct(c)}"></i><i class="mix-r" style="width:${pct(r)}"></i><i class="mix-w" style="width:${pct(w)}"></i></div>
    <div class="run-legend">${v} vowels &middot; ${c} consonants${r ? ` &middot; ${r} rare` : ''}${w ? ` &middot; ${w} wild` : ''}</div>
    <div class="run-stats">
      <div class="run-stat"><span>Bag size</span><b>${bag.length} tiles</b></div>
      <div class="run-stat"><span>Rack</span><b>${config.RACK_SIZE}</b></div>
      <div class="run-stat"><span>Plays / round</span><b>${plays}</b></div>
      <div class="run-stat"><span>Discards / round</span><b>${discards}</b></div>
      <div class="run-stat"><span>Starting $</span><b>${startCoins}</b></div>
      <div class="run-stat"><span>Difficulty</span><b>${stake.name || `Stake ${stakeId}`}</b></div>
    </div>
    <div class="run-target">First target: ${target !== base ? `<span class="base">${base}</span>` : ''}<b>${target}</b></div>`;
}

export function renderSetup(meta, config, profile) {
  if (selectedStakeId == null || !meta.unlockedStakes.includes(selectedStakeId)) {
    selectedStakeId = meta.unlockedStakes[0] ?? (config.STAKES[0]?.id ?? 0);
  }
  if (!selectedDeckId || !meta.unlockedDecks.includes(selectedDeckId)) {
    selectedDeckId = meta.unlockedDecks[0] ?? 'standard';
  }

  const deckButtonsHtml = meta.unlockedDecks.map(id => {
    const deck = config.DECKS[id];
    const name = deck?.name || id;
    const desc = deck?.desc || '';
    const active = id === selectedDeckId ? ' active' : '';
    return `<button class="pick-card deck-pick${active}" data-deck="${id}">${bagHtml(id)}<span class="deck-text"><b class="pick-name">${name}</b><div class="bag-desc">${desc}</div></span></button>`;
  }).join('');

  // Stake description derived from its effects (no separate copy to maintain).
  const stakeDesc = (s) => {
    const parts = [s.targetMult && s.targetMult !== 1 ? `Targets +${Math.round((s.targetMult - 1) * 100)}%` : 'Standard targets'];
    if (s.playsDelta) parts.push(`${s.playsDelta > 0 ? '+' : ''}${s.playsDelta} play/round`);
    if (s.discardsDelta) parts.push(`${s.discardsDelta > 0 ? '+' : ''}${s.discardsDelta} discard/round`);
    return parts.join(' · ');
  };
  const totalStakes = config.STAKES.length;
  const stakeButtonsHtml = meta.unlockedStakes.map(id => {
    const s = config.STAKES.find(x => x.id === id) || { id, name: `Stake ${id}` };
    const active = id === selectedStakeId ? ' active' : '';
    const danger = id >= 2 ? ' danger' : '';
    const filled = (Number(id) || 0) + 1;
    const meter = Array.from({ length: totalStakes }, (_, i) => `<span class="pip${i < filled ? ' on' : ''}${id >= 2 ? ' hot' : ''}"></span>`).join('');
    // Win bounty for (this stake, currently-selected bag): the one-time Meta the grid pays on first clear.
    const bountyAmt = config.META?.bounty?.[id] ?? 0;
    const claimed = profile?.bountyClaimed?.[`${id}:${selectedDeckId}`];
    const bountyHtml = bountyAmt
      ? `<div class="stake-bounty${claimed ? ' done' : ''}">${claimed ? '✓ Bounty claimed' : `Win bounty: +${bountyAmt} Meta`}</div>`
      : '';
    return `<button class="pick-card stake-pick${active}${danger}" data-stake="${id}">
      <span class="stake-head"><b class="pick-name">${s.name || `Stake ${id}`}</b><span class="stake-meter" title="Difficulty">${meter}</span></span>
      <div class="stake-desc">${stakeDesc(s)}</div>
      ${bountyHtml}
    </button>`;
  }).join('');

  app().innerHTML = `
    ${backArrowHtml()}
    <div id="meta-screen" class="setup-screen">
      <div class="menu-title small">New Run <button id="setup-help-btn" title="How it works" style="font-size:0.6em;padding:2px 8px;border-radius:50%;cursor:pointer;vertical-align:middle;">?</button></div>
      <p class="setup-sub">Pick a bag and a stake, then start your run.</p>
      <div class="setup-layout">
        <div class="setup-picks">
          <h3 class="settings-h">Bag</h3>
          <div id="deck-buttons">${deckButtonsHtml}</div>
          <h3 class="settings-h">Stake</h3>
          <div id="stake-buttons">${stakeButtonsHtml}</div>
        </div>
        <aside class="setup-aside">
          <h3 class="settings-h">Your run</h3>
          <div class="run-panel" id="run-preview">${runPreviewHtml(meta, config, selectedDeckId, selectedStakeId)}</div>
          <button id="start-run" class="cta-btn">Start Run &#9656;</button>
        </aside>
      </div>
    </div>`;

  app().querySelectorAll('.deck-pick').forEach(btn => {
    btn.onclick = () => { selectedDeckId = btn.dataset.deck; renderSetup(meta, config, profile); };
  });
  app().querySelectorAll('.stake-pick').forEach(btn => {
    btn.onclick = () => { selectedStakeId = Number(btn.dataset.stake); renderSetup(meta, config, profile); };
  });
  const startBtn = document.getElementById('start-run');
  if (startBtn) startBtn.onclick = () => {
    const deck = selectedDeckId, stake = selectedStakeId;
    selectedDeckId = meta.unlockedDecks[0] ?? 'standard';
    selectedStakeId = null;
    handlers.onStartRun?.(deck, stake);
  };
  const help = document.getElementById('setup-help-btn');
  if (help) help.onclick = () => showHelpOverlay();
  wireBack();
}

// Meta Shop: persistent unlocks, grouped into sections by offer type. No run setup here.
export function renderMetaShop(meta, config, allRelicIds, allModIds) {
  const offers = metaShopOffers(meta, config, allRelicIds, allModIds);

  // Name + description per offer (bags/stakes/loadout carry no description in config today).
  const offerInfo = (offer) => {
    switch (offer.type) {
      case 'unlockRelic': { const r = RELICS[offer.relicId]; return { name: r?.name || offer.relicId, desc: r?.desc || '' }; }
      case 'unlockMod':   { const m = getMod(offer.modId); return { name: m?.name || offer.modId, desc: m?.desc || '' }; }
      case 'unlockDeck':  return { name: config.DECKS[offer.deckId]?.name || offer.deckId, desc: config.DECKS[offer.deckId]?.desc || '' };
      case 'unlockStake': {
        const st = config.STAKES.find(s => s.id === offer.stakeId);
        const parts = [st && st.targetMult !== 1 ? `Targets +${Math.round((st.targetMult - 1) * 100)}%` : 'Standard targets'];
        if (st?.playsDelta) parts.push(`${st.playsDelta > 0 ? '+' : ''}${st.playsDelta} play/round`);
        if (st?.discardsDelta) parts.push(`${st.discardsDelta > 0 ? '+' : ''}${st.discardsDelta} discard/round`);
        return { name: st?.name || `Stake ${offer.stakeId}`, desc: parts.join(' · ') };
      }
      case 'loadout':     return { name: config.LOADOUT[offer.key]?.name || offer.key, desc: config.LOADOUT[offer.key]?.desc || '' };
      default:            return { name: offer.type, desc: '' };
    }
  };
  // Each offer's icon: the engraved relic seal / themed bag image, else a consistent letterpress badge.
  const offerIcon = (offer) => {
    switch (offer.type) {
      case 'unlockRelic': return relicSealHtml(offer.relicId, { size: 'md' });
      case 'unlockDeck':  return bagHtml(offer.deckId);
      case 'unlockMod':   return `<span class="meta-badge mod">${(getMod(offer.modId)?.name || '?').slice(0, 1)}</span>`;
      case 'unlockStake': return `<span class="meta-badge stake${offer.stakeId >= 2 ? ' hot' : ''}">${offer.stakeId}</span>`;
      case 'loadout':     return `<span class="meta-badge load">+</span>`;
      default:            return '';
    }
  };
  const card = (offer, i) => {
    const cant = meta.meta < offer.cost;
    const { name, desc } = offerInfo(offer);
    return `<button class="meta-card${cant ? ' cant' : ''}" data-idx="${i}"${cant ? ' disabled' : ''}>
      <span class="meta-card-icon">${offerIcon(offer)}</span>
      <span class="meta-card-body"><b class="meta-card-name">${name}</b>${desc ? `<span class="meta-card-desc">${desc}</span>` : ''}<span class="meta-card-cost">${offer.cost} Meta</span></span>
    </button>`;
  };

  const SECTIONS = [
    ['unlockRelic', 'Relics'],
    ['unlockMod', 'Tile-mods'],
    ['unlockDeck', 'Bags'],
    ['unlockStake', 'Stakes'],
    ['loadout', 'Loadout'],
  ];
  const known = new Set(SECTIONS.map(s => s[0]));
  let sectionsHtml = SECTIONS.map(([type, label]) => {
    const items = offers.map((o, i) => [o, i]).filter(([o]) => o.type === type);
    if (!items.length) return '';
    return `<div class="meta-section"><h3>${label}</h3><div class="meta-grid">${items.map(([o, i]) => card(o, i)).join('')}</div></div>`;
  }).join('');
  const extras = offers.map((o, i) => [o, i]).filter(([o]) => !known.has(o.type));
  if (extras.length) sectionsHtml += `<div class="meta-section"><h3>Other</h3><div class="meta-grid">${extras.map(([o, i]) => card(o, i)).join('')}</div></div>`;
  if (!offers.length) sectionsHtml = '<div class="none-label">All unlocked. Nothing left to buy.</div>';

  app().innerHTML = `
    ${backArrowHtml()}
    <div id="meta-screen" class="shop-screen">
      <div class="menu-title small">Meta Shop</div>
      <p class="setup-sub">Spend Meta to permanently unlock content. Relics, tile-mods, and bags you unlock join the pool you can find during a run; stakes and loadout apply at run start.</p>
      <div id="meta-balance">${metaSealHtml({ size: 'sm' })}<span>Meta: ${meta.meta}</span></div>
      <div id="meta-shop">${sectionsHtml}</div>
    </div>`;

  offers.forEach((offer, i) => {
    const btn = app().querySelector(`.meta-card[data-idx="${i}"]`);
    if (!btn || btn.disabled) return;
    btn.onclick = () => handlers.onMetaBuy?.(offer);
  });
  wireBack();
}
