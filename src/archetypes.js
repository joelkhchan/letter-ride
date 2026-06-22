// src/archetypes.js — build archetypes: conditions + per-level hone increments.
// Numbers are difficulty-weighted STARTING POINTS (rare/doubled big, vowel small) — tune via playtest.
const VOWELS = new Set(['A','E','I','O','U']);
const RARE = new Set(['J','Q','X','Z']);
const isVowel = (c) => VOWELS.has(c);
const hasAdjacentDouble = (w) => { for (let i=1;i<w.length;i++) if (w[i]===w[i-1]) return true; return false; };
const hasRepeat = (letters) => { const seen={}; for (const l of letters){ seen[l]=(seen[l]||0)+1; if (seen[l]>=2) return true; } return false; };

// rare check honors the wildsAreRare enabler (a wild tile counts as rare).
// Exported so relics.js (Task 5) reuses the SAME predicate — one home.
export function hasRare(ctx) {
  if (ctx.letters.some(l => RARE.has(l))) return true;
  if ((ctx.enablers || []).includes('wildsAreRare') && (ctx.selection || []).some(s => s.tile?.letter === '*')) return true;
  return false;
}
// doubled check honors the looseDoubled enabler (any letter repeated, not just adjacent).
export function isDoubled(ctx) {
  if (hasAdjacentDouble(ctx.word.toUpperCase())) return true;
  if ((ctx.enablers || []).includes('looseDoubled') && hasRepeat(ctx.letters)) return true;
  return false;
}
// long threshold drops by 1 with the longReach enabler.
const longThreshold = (ctx) => (ctx.enablers || []).includes('longReach') ? 5 : 6;

export const ARCHETYPES = {
  shortWord: {
    id: 'shortWord', name: 'Short-word',
    matches: (ctx) => ctx.letters.length <= 3,
    honeBonus: (ctx, lvl) => ctx.letters.length <= 3 ? { addMult: lvl } : {},
  },
  longWord: {
    id: 'longWord', name: 'Long-word',
    matches: (ctx) => ctx.letters.length >= longThreshold(ctx),
    honeBonus: (ctx, lvl) => ctx.letters.length >= longThreshold(ctx) ? { addPoints: 5 * lvl } : {},
  },
  rareLetter: {
    id: 'rareLetter', name: 'Rare-letter',
    matches: (ctx) => hasRare(ctx),
    honeBonus: (ctx, lvl) => hasRare(ctx) ? { addPoints: 15 * lvl } : {},
  },
  doubled: {
    id: 'doubled', name: 'Doubled-letter',
    matches: (ctx) => isDoubled(ctx),
    honeBonus: (ctx, lvl) => isDoubled(ctx) ? { addPoints: 12 * lvl } : {},
  },
  vowelHeavy: {
    id: 'vowelHeavy', name: 'Vowel-heavy',
    matches: (ctx) => ctx.letters.filter(isVowel).length >= 3,
    honeBonus: (ctx, lvl) => { const v = ctx.letters.filter(isVowel).length; return v >= 3 ? { addPoints: 2 * lvl * v } : {}; },
  },
  escalation: {
    id: 'escalation', name: 'Escalation',
    matches: () => true,
    honeBonus: (ctx, lvl) => { const m = 0.5 * lvl * (ctx.wordsPlayedThisRound || 0); return m ? { addMult: m } : {}; },
  },
};

export const ALL_ARCHETYPE_IDS = Object.keys(ARCHETYPES);

export function honeModifiers(honeLevels = {}) {
  const mods = [];
  for (const id of ALL_ARCHETYPE_IDS) {
    const lvl = honeLevels[id] || 0;
    if (lvl <= 0) continue;
    const a = ARCHETYPES[id];
    mods.push({ id: `hone:${id}`, name: `Hone: ${a.name}`, evaluate: (ctx) => a.honeBonus(ctx, lvl) });
  }
  return mods;
}
