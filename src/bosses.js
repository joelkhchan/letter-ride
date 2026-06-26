// src/bosses.js — boss content + pure warp helpers. A boss warps one Sentence encounter.
// Verbs (from the systems bible): disable (zero some tile values) · cap (clamp mult) ·
// tax (subtract points) · lock (encounter-setup, handled in run.js). scoring.js is never touched.
const VOWELS = ['A', 'E', 'I', 'O', 'U'];

export const BOSSES = {
  mute:    { id: 'mute',    name: 'The Mute',    desc: 'Vowels score 0',                   warp: { verb: 'disable', letters: 'vowels' } },
  ceiling: { id: 'ceiling', name: 'The Ceiling', desc: 'Mult is capped at x3',             warp: { verb: 'cap',     maxMult: 3 } },
  toll:    { id: 'toll',    name: 'The Toll',    desc: 'Each word scores 10 fewer Points', warp: { verb: 'tax',     points: 10 } },
  vise:    { id: 'vise',    name: 'The Vise',    desc: 'Only 1 discard this round',        warp: { verb: 'lock',    lock: 'discard', keep: 1 } },
};

export const ALL_BOSS_IDS = Object.keys(BOSSES);

// disable: return a tileValues copy with the disabled letters zeroed. Injected into scoreWord (pure DI).
// Returns the SAME reference when there is nothing to disable (so callers can cheaply detect no-op).
export function bossTileValues(tileValues, boss) {
  if (!boss || boss.warp.verb !== 'disable') return tileValues;
  const out = { ...tileValues };
  if (boss.warp.letters === 'vowels') for (const v of VOWELS) out[v] = 0;
  return out;
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
