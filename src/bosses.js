// src/bosses.js — boss content + pure warp helpers. A boss warps one Sentence encounter.
// Verbs (from the systems bible): disable (zero some tile values) · cap (clamp mult) ·
// tax (subtract points) · lock (encounter-setup, handled in run.js: discards or hand size).
// scoring.js is never touched.
// NOTE (2026-06-29): the hard mult-cap boss "The Ceiling" was REMOVED — a ×3 cap hard-counters the
// uncapped ×Mult engine fantasy in late rounds (anti-fun). The `cap` verb is kept as a primitive in
// case a future boss wants a SOFT cap (high ceiling that only trims degenerate spikes).
const VOWELS = ['A', 'E', 'I', 'O', 'U'];

export const BOSSES = {
  mute:     { id: 'mute',     name: 'The Mute',      desc: 'Vowels score 0',                       warp: { verb: 'disable', letters: 'vowels' } },
  censor:   { id: 'censor',   name: 'The Censor',    desc: 'A random letter scores 0',             warp: { verb: 'disable', letters: 'random' } },
  toll:     { id: 'toll',     name: 'The Toll',      desc: 'Each word scores 10 less',             warp: { verb: 'tax',     points: 10 } },
  vise:     { id: 'vise',     name: 'The Vise',      desc: 'No discards this round',               warp: { verb: 'lock',    lock: 'discard', keep: 0 } },
  margin:   { id: 'margin',   name: 'The Margin',    desc: 'Hold 2 fewer tiles this round',         warp: { verb: 'lock',    lock: 'hand',    delta: -2 } },
  oneLiner: { id: 'oneLiner', name: 'The One-Liner', desc: 'One play only, but the target is lower', warp: { verb: 'limit', plays: 1, targetMult: 0.6 } },
};

export const ALL_BOSS_IDS = Object.keys(BOSSES);

// hand-lock: how much this boss shrinks (or grows) the hand for its round. 0 for non-hand bosses.
// Applied in run.js refillHand and re-clamped to HAND_FLOOR, so a boss can never brick the hand.
export function bossHandDelta(boss) {
  return (boss && boss.warp.verb === 'lock' && boss.warp.lock === 'hand') ? (boss.warp.delta || 0) : 0;
}

// disable: return a tileValues copy with the disabled letters zeroed. Injected into scoreWord (pure DI).
// Returns the SAME reference when there is nothing to disable (so callers can cheaply detect no-op).
export function bossTileValues(tileValues, boss, censorLetter = null) {
  if (!boss || boss.warp.verb !== 'disable') return tileValues;
  if (boss.warp.letters === 'vowels') { const out = { ...tileValues }; for (const v of VOWELS) out[v] = 0; return out; }
  if (boss.warp.letters === 'random' && censorLetter) return { ...tileValues, [censorLetter]: 0 };   // The Censor: one chosen letter
  return tileValues;   // nothing to disable (e.g. Censor before a letter is chosen) → same ref
}

// cap + tax: adjust a scoreWord result. Pure; returns a NEW {points,mult,score}.
// disable is applied via bossTileValues; lock is applied at encounter setup; both no-op here.
export function applyBossToScore(scored, boss) {
  if (!boss) return scored;
  if (boss.warp.verb === 'cap') {
    const mult = Math.min(scored.mult, boss.warp.maxMult);
    return { ...scored, mult, score: scored.points * mult };
  }
  if (boss.warp.verb === 'tax') {
    return { ...scored, score: Math.max(0, scored.score - boss.warp.points) };
  }
  return scored;
}
