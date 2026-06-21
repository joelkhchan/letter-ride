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

export function renderRun(run) {
  lastRun = run;
  const inRack = id => selection.some(s => s.tile.id === id);
  const staged = selection.map(s => s.letter).join('');
  const done = run.status !== 'playing';
  app().innerHTML = `
    <div id="hud">
      <div>Round ${run.roundIndex + 1}/${run.targets.length}</div>
      <div><b>${run.roundTotal}</b> / ${run.target} Points</div>
      <div>Plays ${run.playsLeft} · Discards ${run.discardsLeft}</div>
    </div>
    <div id="staging">${staged || '&nbsp;'}</div>
    <div id="rack">
      ${run.rack.map(t => `<button class="tile ${inRack(t.id) ? 'used' : ''}" data-id="${t.id}">${t.letter}</button>`).join('')}
    </div>
    <div id="msg"></div>
    <div id="controls">
      <button id="submit" ${done ? 'disabled' : ''}>Submit</button>
      <button id="back" ${done ? 'disabled' : ''}>⌫</button>
      <button id="clear" ${done ? 'disabled' : ''}>Clear</button>
      <button id="discard" ${done || run.discardsLeft <= 0 ? 'disabled' : ''}>Discard</button>
      ${run.status === 'roundCleared' ? '<button id="next">Next round →</button>' : ''}
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
  on('next', () => { selection = []; handlers.onNext?.(); });
  on('new', () => { selection = []; handlers.onNewRun?.(); });
}
