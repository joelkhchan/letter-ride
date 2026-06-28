// src/broadside.js
// The end-of-run trophy card ("broadside"), drawn to a Canvas so it can be saved or
// shared as an image. Presentation only: no game rules. It reads the LIVE theme tokens
// from CSS (getComputedStyle on :root) so it always matches the current palette
// (deep navy + antique gold + Zilla Slab) and tracks any future palette change for free.
//
// Win vs loss: a win gets a celebratory gold header ("Cleared the Press") + a gold seal;
// a loss gets a quieter muted header ("Press Stopped") + a muted mark. Rank, best line,
// and score appear on both. Header/rank copy is author-tunable.

import { passageOf, tierOf } from './run.js';

// `rank` is the player's LIFETIME rank (Novice..Artisan), passed in by the caller. Unified ladder
// (2026-06-26): the trophy shows your standing, not a separate per-run tier, so there is one rank
// vocabulary across the menu, achievements, and this card.
export function buildSummary(run, rank = '') {
  const won = run.status === 'won';
  const best = run.bestPlay || run.lastPlay || null;
  const N = run.config?.PASSAGES ?? 4;
  const common = { won, rank, bestWord: best?.word || '', bestScore: best?.score || 0 };
  if (won) {
    return { ...common, header: 'Cleared the Press', resultLine: `All ${N} Passages set` };
  }
  const p = passageOf(run.roundIndex), t = tierOf(run.roundIndex);
  return { ...common, header: 'Press Stopped', resultLine: `Fell at Passage ${p}, the ${t}` };
}

const tok = (cs, name, fb) => (cs.getPropertyValue(name).trim() || fb);
const spaced = str => str.toUpperCase().split('').join(' ');   // letter-spaced small caps

function rule(ctx, cx, y, halfW, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, y); ctx.lineTo(cx - 11, y);
  ctx.moveTo(cx + 11, y); ctx.lineTo(cx + halfW, y);
  ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(cx, y - 5); ctx.lineTo(cx + 5, y); ctx.lineTo(cx, y + 5); ctx.lineTo(cx - 5, y);
  ctx.closePath(); ctx.fill();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function star(ctx, cx, cy, outer, inner) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function drawBroadside(canvas, s) {
  const ctx = canvas && canvas.getContext && canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height, cx = W / 2;
  const cs = getComputedStyle(document.documentElement);
  const navy = tok(cs, '--night', '#0d182e'), navy2 = tok(cs, '--night-2', '#172741');
  const gold = tok(cs, '--gold', '#d9b25a'), ink = tok(cs, '--ink', '#f1ebd9'), inkSoft = tok(cs, '--ink-soft', '#a9b4c9');
  const tileA = tok(cs, '--tile-a', '#f4eed8'), tileInk = tok(cs, '--tile-ink', '#16203a');
  const goldBright = '#ecd693';
  const F = '"Zilla Slab", Georgia, serif';

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = navy;  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = navy2; ctx.fillRect(26, 26, W - 52, H - 52);
  ctx.strokeStyle = gold; ctx.lineWidth = 3; ctx.strokeRect(34, 34, W - 68, H - 68);
  ctx.lineWidth = 1; ctx.strokeRect(42, 42, W - 84, H - 84);

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

  // colophon (brand mark)
  ctx.fillStyle = gold; ctx.font = `700 20px ${F}`;
  ctx.fillText(spaced('Letter Ride'), cx, 78);
  rule(ctx, cx, 102, 140, gold);

  // win/loss header: celebratory gold on a win, quiet muted on a loss
  if (s.won) {
    ctx.fillStyle = goldBright; ctx.font = `700 40px ${F}`;
    ctx.fillText(s.header.toUpperCase(), cx, 158);
  } else {
    ctx.fillStyle = inkSoft; ctx.font = `700 32px ${F}`;
    ctx.fillText(s.header.toUpperCase(), cx, 156);
  }

  // seal band: a gold medallion on a win, a quiet muted mark on a loss
  const sy = 238;
  if (s.won) {
    ctx.strokeStyle = gold; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, sy, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, sy, 38, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = goldBright; star(ctx, cx, sy, 21, 9); ctx.fill();
  } else {
    rule(ctx, cx, sy, 70, inkSoft);
  }

  // rank (the award name) — gold for both
  ctx.fillStyle = gold; ctx.font = `700 38px ${F}`;
  ctx.fillText(s.rank.toUpperCase(), cx, 340);

  // result line
  ctx.fillStyle = ink; ctx.font = `400 23px ${F}`;
  ctx.fillText(s.resultLine, cx, 378);

  // best line label + plate (best word set on an ivory sort)
  ctx.fillStyle = inkSoft; ctx.font = `700 16px ${F}`;
  ctx.fillText(spaced('Best Line'), cx, 450);

  const word = (s.bestWord || '—').toUpperCase();
  let fs = word.length > 9 ? 40 : (word.length > 6 ? 50 : 60);
  ctx.font = `700 ${fs}px ${F}`;
  while (ctx.measureText(word).width > W - 170 && fs > 20) { fs -= 2; ctx.font = `700 ${fs}px ${F}`; }
  const plateW = Math.min(W - 120, ctx.measureText(word).width + 70), plateH = 94, plateY = 476;
  ctx.fillStyle = tileA;
  roundRect(ctx, cx - plateW / 2, plateY, plateW, plateH, 8); ctx.fill();
  ctx.fillStyle = tileInk; ctx.textBaseline = 'middle';
  ctx.fillText(word, cx, plateY + plateH / 2 + 2);
  ctx.textBaseline = 'alphabetic';

  // score
  ctx.fillStyle = gold; ctx.font = `700 32px ${F}`;
  ctx.fillText(`${s.bestScore} Score`, cx, 622);

  // footer
  rule(ctx, cx, H - 92, 140, gold);
  ctx.fillStyle = inkSoft; ctx.font = `400 17px ${F}`;
  ctx.fillText('A word-builder roguelike', cx, H - 58);
}

// Save or share the card as a PNG. Web Share API (with files) on supporting devices
// (Android/mobile), download fallback elsewhere.
export async function shareBroadside(canvas) {
  if (!canvas || !canvas.toBlob) return;
  const blob = await new Promise(res => { try { canvas.toBlob(res, 'image/png'); } catch { res(null); } });
  if (!blob) return;
  const file = new File([blob], 'letter-ride.png', { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Letter Ride', text: 'My Letter Ride run' });
      return;
    }
  } catch { /* user canceled or unsupported: fall through to download */ }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'letter-ride.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
