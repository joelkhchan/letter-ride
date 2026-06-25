// src/ui.js
import { metaShopOffers } from './meta.js';
import { RELICS } from './relics.js';
import { getMod } from './tiles.js';
import { scoreWord } from './scoring.js';
import { ARCHETYPES, honeModifiers } from './archetypes.js';
import { passageOf, tierOf, isBossRound } from './run.js';
import { BOSSES, bossTileValues, applyBossToScore } from './bosses.js';
import { EVENTS } from './events.js';
import { play as sfx, isMuted, toggleMuted } from './audio.js';

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
  const el = document.getElementById('msg');
  if (el) el.textContent = reason === 'short' ? 'Too short (min 3).' : 'Not a word.';
}

function tapTile(tile) {
  if (selection.some(s => s.tile.id === tile.id)) return;   // each rack tile once
  let letter = tile.letter;
  if (letter === '*') {
    const choice = (window.prompt('Wild: choose a letter') || '').toUpperCase().slice(0, 1);
    if (!/[A-Z]/.test(choice)) return;
    letter = choice;
  }
  selection.push({ tile, letter });
  sfx('tap');
  renderRun(lastRun);
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

  // Insert popover right after the anchor in the DOM.
  anchorEl.insertAdjacentElement('afterend', popover);

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
// stagedBreakdown: optional breakdown object from scoreWord when a word is staged.
function relicsModsPanelHtml(run, stagedBreakdown) {
  let relicsText;
  if (run.relics && run.relics.length) {
    if (stagedBreakdown) {
      // Merge all labeled parts from the breakdown into a lookup.
      const contributions = {};
      for (const p of stagedBreakdown.pointParts)    contributions[p.label] = `+${p.amount} Points`;
      for (const p of stagedBreakdown.addMultParts)  contributions[p.label] = `+${p.amount} Mult`;
      for (const p of stagedBreakdown.timesMultParts) contributions[p.label] = `×${p.amount} Mult`;
      relicsText = run.relics.map(r => {
        const contrib = contributions[r.name] || '·';
        const safeDesc = (r.desc || '').replace(/"/g, '&quot;');
        const safeName = (r.name || '').replace(/"/g, '&quot;');
        return `<span class="relic-entry tappable-chip" data-pop-name="${safeName}" data-pop-desc="${safeDesc}">${r.name}: <b>${contrib}</b></span>`;
      }).join(' · ');
    } else {
      relicsText = run.relics.map(r => {
        const safeDesc = (r.desc || '').replace(/"/g, '&quot;');
        const safeName = (r.name || '').replace(/"/g, '&quot;');
        return `<span class="relic-entry tappable-chip" data-pop-name="${safeName}" data-pop-desc="${safeDesc}">${r.name}</span>`;
      }).join(' · ');
    }
  } else {
    relicsText = '<span class="none-label">none yet</span>';
  }

  // Collect all rack + bag tiles with mods
  const allTiles = [
    ...(run.rack || []),
    ...(run.bag?.tiles || []),
  ];
  const moddedTiles = allTiles.filter(t => t.mods && t.mods.length);
  const modsText = moddedTiles.length
    ? moddedTiles.map(t => {
        const modsLabel = t.mods.map(m => m.name || m.id).join('+');
        const modsDesc = t.mods.map(m => `${m.name || m.id}: ${m.desc || ''}`).join('; ');
        const safeDesc = modsDesc.replace(/"/g, '&quot;');
        const safeName = (`${t.letter}: ${modsLabel}`).replace(/"/g, '&quot;');
        return `<span class="mod-chip tappable-chip" data-pop-name="${safeName}" data-pop-desc="${safeDesc}">${t.letter}:${modsLabel}</span>`;
      }).join(', ')
    : '<span class="none-label">none yet</span>';

  // Hone levels: show only archetypes with level > 0.
  const honeLevels = run.honeLevels || {};
  const activeHones = Object.entries(honeLevels).filter(([, lvl]) => lvl > 0);
  const honeText = activeHones.length
    ? activeHones.map(([id, lvl]) => {
        const a = ARCHETYPES[id];
        const safeDesc = (a?.desc || '').replace(/"/g, '&quot;');
        const safeName = (a?.name || id).replace(/"/g, '&quot;');
        return `<span class="hone-entry tappable-chip" data-pop-name="${safeName} Lv${lvl}" data-pop-desc="${safeDesc}">${a?.name || id} Lv${lvl}</span>`;
      }).join(', ')
    : '<span class="none-label">none yet</span>';

  return `<div id="relics-mods-panel">
    <div class="rp-row"><span class="rp-label">Relics:</span> ${relicsText}</div>
    <div class="rp-row"><span class="rp-label">Tile-mods:</span> ${modsText}</div>
    <div class="rp-row"><span class="rp-label">Hone:</span> ${honeText}</div>
  </div>`;
}

// Show the help overlay (Feature 4).
function showHelpOverlay() {
  const old = document.getElementById('help-overlay');
  if (old) { old.remove(); return; }

  const overlay = document.createElement('div');
  overlay.id = 'help-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:200;padding:16px;box-sizing:border-box;';

  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:10px;padding:20px 24px;max-width:380px;width:100%;font-size:0.97em;line-height:1.5;';
  box.innerHTML = `
    <h3 style="margin:0 0 10px;">How it works</h3>
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
  closeBtn.style.cssText = 'padding:10px 28px;font-size:1em;border-radius:6px;cursor:pointer;';
  closeBtn.onclick = () => overlay.remove();
  overlay.appendChild(closeBtn);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
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

// Animate the commit->score reveal in place, then onDone() to settle (re-render).
export function animatePull(sel, scored, onDone) {
  sfx('chunk');                                   // the platen comes down (plays even in reduced-motion)
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bug = document.getElementById('scorebug');
  const stage = document.getElementById('staging');
  if (reduce || !scored || !bug) { if (onDone) onDone(); return; }

  _pulling = true;
  let finished = false;
  let flourished = false;
  const flourish = () => { if (!flourished) { flourished = true; sfx('flourish'); } };
  const intFmt = v => String(Math.round(v));
  const bd = scored.breakdown || {};
  const hasMult = ((bd.addMultParts || []).length + (bd.timesMultParts || []).length) > 0;

  bug.classList.add('pulling');
  bug.innerHTML =
    `<span class="sb-word">${sel.map(s => s.letter).join('')}</span>` +
    `<span class="sb-formula"><span id="pull-pts">0</span> Points <span id="pull-mult">×1</span> Mult = <b><span id="pull-score">0</span></b> Score</span>` +
    `<span class="sb-detail" id="pull-detail">${_pullDetail(bd)}</span>`;
  const ptsEl = document.getElementById('pull-pts');
  const multEl = document.getElementById('pull-mult');
  const scoreEl = document.getElementById('pull-score');
  const detailEl = document.getElementById('pull-detail');
  if (detailEl) detailEl.style.opacity = '0';

  const settle = () => {
    if (finished) return;
    finished = true;
    _clearPullTimers();
    document.removeEventListener('click', onTap, { capture: true });
    _pulling = false;
    if (onDone) onDone();
  };
  const showFinals = () => {
    flourish();
    if (ptsEl) ptsEl.textContent = intFmt(scored.points);
    if (multEl) multEl.textContent = _multStr(scored.mult);
    if (scoreEl) { scoreEl.textContent = intFmt(scored.score); scoreEl.classList.add('pull-pop'); }
    if (detailEl) detailEl.style.opacity = '1';
  };
  function onTap(e) {
    e.stopPropagation(); e.preventDefault();
    _clearPullTimers();
    showFinals();
    _pullAfter(PULL.skipHold, settle);
  }
  document.addEventListener('click', onTap, { capture: true });

  if (stage) { stage.classList.add('pull-pressing'); _pullAfter(PULL.press, () => stage.classList.remove('pull-pressing')); }

  let t = PULL.press;
  _pullAfter(t, () => _pullTween(ptsEl, 0, scored.points, PULL.points, intFmt));
  t += PULL.points;
  _pullAfter(t, () => {
    if (detailEl) detailEl.style.opacity = '1';
    if (hasMult) _pullTween(multEl, 1, scored.mult, PULL.mult, _multStr);
    else if (multEl) multEl.textContent = _multStr(scored.mult);
  });
  t += hasMult ? PULL.mult : 80;
  _pullAfter(t, () => { flourish(); _pullTween(scoreEl, 0, scored.score, PULL.score, intFmt); });
  t += PULL.score;
  _pullAfter(t, () => { if (scoreEl) scoreEl.classList.add('pull-pop'); });
  _pullAfter(t + PULL.hold, settle);
}

export function renderRun(run) {
  lastRun = run;

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

  // Currency counter (only in Tier 1; coins field exists on run after Task 10).
  const coinsHtml = (typeof run.coins === 'number')
    ? `<div id="coins">$${run.coins}</div>`
    : '';

  // Last play result
  const lastPlayHtml = run.lastPlay
    ? `<div id="last-play">Last: <b>${run.lastPlay.word}</b> = ${run.lastPlay.score} Score</div>`
    : '';

  // Live score preview (only when playing and selection non-empty).
  // Also extract the breakdown for per-relic contributions in the relics panel.
  let preview = '';
  let stagedBreakdown = null;
  if (!done && selection.length) {
    // Faithful preview: mirror playWord's scoring (boss warp, hone, snowball stacks, and the
    // prospective chain length) so the previewed Score equals what you actually get on submit.
    const boss = run.boss ? BOSSES[run.boss] : null;
    const cf = selection[0]?.letter?.toUpperCase();
    const chainLength = (run.lastWord && run.lastWord.lastLetter === cf) ? (run.chainLength || 0) + 1 : 1;
    const scored0 = scoreWord(selection, {
      tileValues: bossTileValues(run.tileValues, boss),
      lengthBonusPerLetter: run.config.LENGTH_BONUS_PER_LETTER,
      relics: [...(run.relics || []), ...honeModifiers(run.honeLevels)],
      context: {
        wordsPlayedThisRound: run.wordsPlayedThisRound,
        enablers: (run.relics || []).filter(r => r.enabler).map(r => r.enabler),
        relicState: run.relicState,
        chainLength,
      },
    });
    const scored = applyBossToScore(scored0, boss);
    let bossNote = '';
    if (boss?.warp.verb === 'tax') bossNote = `&minus;${boss.warp.points} (${boss.name})`;
    else if (boss?.warp.verb === 'cap' && scored0.mult > boss.warp.maxMult) bossNote = `(${boss.name}: Mult capped &times;${boss.warp.maxMult})`;
    else if (boss?.warp.verb === 'disable') bossNote = `(${boss.name})`;
    stagedBreakdown = scored.breakdown;
    preview = scorePreviewHtml(selection, scored, bossNote);
  }

  app().innerHTML = `
    <div id="hud">
      <div>Passage ${passageOf(run.roundIndex)}/${run.config.PASSAGES} &middot; encounter ${(run.roundIndex % 3) + 1}/3 &middot; ${tierOf(run.roundIndex)}${isBossRound(run.roundIndex) ? ' (boss)' : ''}</div>
      <div><span id="score-total">${run.roundTotal}</span> / ${run.target} Score</div>
      <div>Plays ${run.playsLeft} · Discards ${run.discardsLeft}</div>
      ${coinsHtml}
      <button id="help-btn" title="How it works" style="font-size:0.85em;padding:2px 7px;border-radius:50%;cursor:pointer;">?</button>
      <button id="mute-btn" class="${isMuted() ? 'muted' : ''}" title="${isMuted() ? 'Sound off (tap for on)' : 'Sound on (tap for off)'}" style="font-size:0.95em;padding:2px 8px;border-radius:50%;cursor:pointer;">&#9834;</button>
    </div>
    ${relicsModsPanelHtml(run, stagedBreakdown)}
    ${lastPlayHtml}
    <div id="staging">${staged || '&nbsp;'}</div>
    ${preview}
    ${run.boss && BOSSES[run.boss] ? `<div id="boss-banner"><b>${BOSSES[run.boss].name}</b> &middot; ${BOSSES[run.boss].desc}</div>` : ''}
    ${run.chainLength > 1 ? `<div id="chain-banner">Chain &times;${run.chainLength}${run.lastWord ? ` &middot; continue with ${run.lastWord.lastLetter}` : ''}</div>` : ''}
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
      <button id="discard" ${done || run.discardsLeft <= 0 || selection.length === 0 ? 'disabled' : ''}>${`Discard${selection.length ? ' (' + selection.length + ')' : ''}`}</button>
      <button id="shuffle" ${done || run.rack.length === 0 ? 'disabled' : ''}>Shuffle</button>
      ${run.status === 'won' ? `<div class="end">🎉 Run cleared!${run.lastMetaEarned ? ` +${run.lastMetaEarned} Meta earned` : ''}</div><button id="new">Back to menu</button>` : ''}
      ${run.status === 'lost' ? `<div class="end">💀 Out of plays.${run.lastMetaEarned ? ` +${run.lastMetaEarned} Meta earned` : ''}</div><button id="new">Back to menu</button>` : ''}
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
  on('mute-btn', () => { toggleMuted(); renderRun(run); });
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
      ${eventCardHtml ? `<div class="node-prompt">Choose one stop. Taking the event <b>skips the shop</b> this round.</div>` : ''}
      <button class="node-card" id="pick-shop">
        <div class="node-card-title">Shop</div>
        <div class="node-card-desc">${shopDesc}</div>
      </button>
      ${eventCardHtml}
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
      <div id="event-options">${optionsHtml}</div>
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
          if (msg) msg.textContent = r.reason === 'need-2' ? 'Pick exactly 2 tiles.' : 'Could not remove tiles.';
        } else {
          renderEventDone(run, ev);
        }
      });
    } else if (ev.id === 'wordsmith') {
      // Wordsmith: show archetype picker
      btn.onclick = () => showArchetypePicker(run, (archetypeId) => {
        const r = handlers.onEventOption?.(i, { archetypeId });
        if (r && !r.ok) {
          const msg = document.getElementById('msg');
          if (msg) msg.textContent = 'Could not apply hone.';
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
  wireDescPopovers(document.getElementById('relics-mods-panel'));
}

function renderEventDone(run, ev) {
  const coins = run.coins || 0;
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
      <p style="font-weight:700;color:#27ae60;">Done!</p>
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
  title.textContent = `Pick ${count} tiles to remove:`;
  title.style.cssText = 'color:#fff;font-weight:bold;font-size:1.1em;';
  overlay.appendChild(title);

  const selected = new Set();

  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:320px;';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = `Remove ${count} tiles`;
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
      confirmBtn.disabled = selected.size !== count;
      confirmBtn.textContent = selected.size === count ? `Remove ${count} tiles` : `Pick ${count - selected.size} more`;
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

// Show an overlay for picking an archetype (used by Wordsmith event).
function showArchetypePicker(run, onConfirm) {
  const old = document.getElementById('archetype-picker-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'archetype-picker-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;z-index:100;padding:16px;box-sizing:border-box;';

  const title = document.createElement('div');
  title.textContent = 'Choose an archetype to hone:';
  title.style.cssText = 'color:#fff;font-weight:bold;font-size:1.1em;';
  overlay.appendChild(title);

  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-direction:column;gap:8px;max-width:320px;width:100%;';

  Object.values(ARCHETYPES).forEach(arch => {
    const currentLevel = (run.honeLevels?.[arch.id] || 0);
    const btn = document.createElement('button');
    btn.style.cssText = 'padding:10px 14px;font-size:1em;border-radius:6px;cursor:pointer;text-align:left;';
    btn.innerHTML = `<b>${arch.name}</b> (Lv ${currentLevel} &rarr; ${currentLevel + 1})<br><span style="font-size:0.85em;color:#666;">${arch.desc}</span>`;
    btn.onclick = () => {
      overlay.remove();
      onConfirm(arch.id);
    };
    grid.appendChild(btn);
  });
  overlay.appendChild(grid);

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

function renderShop(run) {
  const shop = run.shop;
  const coins = run.coins || 0;
  const canAfford = (cost) => coins >= cost;

  const offersHtml = shop.offers.map((offer, i) => {
    const label = offerLabel(offer);
    const disabled = !canAfford(offer.cost) ? 'disabled' : '';
    // The offer label already states the effect + cost inline, so no separate info button is needed.
    return `<div class="shop-offer-row"><button class="shop-offer" data-idx="${i}" ${disabled}>${label}</button></div>`;
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
      <div>Passage ${passageOf(run.roundIndex)}/${run.config.PASSAGES} &middot; ${tierOf(run.roundIndex)} &middot; Shop</div>
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
  box.style.cssText = 'background:#fff;border-radius:10px;padding:20px 24px;max-width:420px;width:100%;font-size:0.93em;line-height:1.5;max-height:80vh;overflow-y:auto;';

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
    <h3 style="margin:0 0 10px;">Balance Stats</h3>
    <p>Runs: <b>${summary.runs}</b> &nbsp; Wins: <b>${summary.wins}</b> &nbsp; Win rate: <b>${pct(summary.winRate)}</b></p>
    <p>Avg word length: <b>${summary.avgWordLen.toFixed(1)}</b></p>
    <table style="width:100%;border-collapse:collapse;font-size:0.9em;">
      <thead><tr style="border-bottom:1px solid #ccc;">
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
  closeBtn.style.cssText = 'padding:10px 28px;font-size:1em;border-radius:6px;cursor:pointer;';
  closeBtn.onclick = () => overlay.remove();
  overlay.appendChild(closeBtn);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

export function renderMeta(meta, config, allRelicIds, allModIds, getStats) {
  // Reset selectedStakeId if null or no longer valid.
  if (!selectedStakeId || !meta.unlockedStakes.includes(selectedStakeId)) {
    selectedStakeId = meta.unlockedStakes[0] ?? (config.STAKES[0]?.id || null);
  }

  // Meta-shop offers.
  const offers = metaShopOffers(meta, config, allRelicIds, allModIds);

  // Build deck picker buttons HTML.
  const deckButtonsHtml = meta.unlockedDecks.map(id => {
    const deck = config.DECKS[id];
    const name = deck?.name || id;
    const desc = deck?.desc || '';
    const active = id === selectedDeckId ? ' style="font-weight:bold;outline:2px solid #333;"' : '';
    const titleAttr = desc ? ` title="${desc}"` : '';
    const descHtml = desc ? `<div class="bag-desc">${desc}</div>` : '';
    return `<button class="deck-pick" data-deck="${id}"${active}${titleAttr}>${name}${descHtml}</button>`;
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
        return `Unlock relic: ${relic?.name || offer.relicId} · ${relic?.desc || ''} · ${offer.cost}`;
      }
      case 'unlockMod': {
        const mod = getMod(offer.modId);
        return `Unlock mod: ${mod?.name || offer.modId} · ${mod?.desc || ''} · ${offer.cost}`;
      }
      case 'unlockDeck':   return `Unlock bag: ${config.DECKS[offer.deckId]?.name || offer.deckId} · ${offer.cost}`;
      case 'unlockStake':  return `Unlock stake: ${config.STAKES.find(s => s.id === offer.stakeId)?.name || offer.stakeId} · ${offer.cost}`;
      case 'loadout':      return `${config.LOADOUT[offer.key]?.name || offer.key} · ${offer.cost}`;
      default:             return `${offer.type} · ${offer.cost}`;
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
      <h2>Letter Ride <button id="meta-help-btn" title="How it works" style="font-size:0.6em;padding:2px 8px;border-radius:50%;cursor:pointer;vertical-align:middle;">?</button></h2>
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
      <button id="stats-btn">Stats</button>
      <hr>
      <div id="meta-shop">
        <div><b>Meta Shop</b></div>
        <div id="meta-offers">${shopHtml}</div>
      </div>
    </div>`;

  // Wire deck picker.
  app().querySelectorAll('.deck-pick').forEach(btn => {
    btn.onclick = () => { selectedDeckId = btn.dataset.deck; renderMeta(meta, config, allRelicIds, allModIds, getStats); };
  });

  // Wire stake picker.
  app().querySelectorAll('.stake-pick').forEach(btn => {
    btn.onclick = () => { selectedStakeId = btn.dataset.stake; renderMeta(meta, config, allRelicIds, allModIds, getStats); };
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

  // Wire help button on meta screen.
  const metaHelpBtn = document.getElementById('meta-help-btn');
  if (metaHelpBtn) metaHelpBtn.onclick = () => showHelpOverlay();

  // Wire stats button on meta screen.
  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  on('stats-btn', () => showStatsOverlay(getStats?.()));
}
