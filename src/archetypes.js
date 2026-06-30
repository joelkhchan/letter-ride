// src/archetypes.js — build archetypes: conditions + per-level hone increments.
// Numbers are difficulty-weighted STARTING POINTS (rare/doubled big, vowel small) — tune via playtest.
const VOWELS = new Set(['A','E','I','O','U']);
const RARE = new Set(['J','Q','X','Z']);
const isVowel = (c) => VOWELS.has(c);
const hasRepeat = (letters) => { const seen={}; for (const l of letters){ seen[l]=(seen[l]||0)+1; if (seen[l]>=2) return true; } return false; };

// rare check honors the wildsAreRare enabler (a wild tile counts as rare).
// Exported so relics.js (Task 5) reuses the SAME predicate — one home.
export function hasRare(ctx) {
  if (ctx.letters.some(l => RARE.has(l))) return true;
  if ((ctx.enablers || []).includes('wildsAreRare') && (ctx.selection || []).some(s => s.tile?.letter === '*')) return true;
  return false;
}
// doubled = any letter appearing 2+ times in the word. Relaxed 2026-06-30 from adjacent-only
// (so ENCHASE's two separated E's now count); the old looseDoubled enabler is therefore retired.
export function isDoubled(ctx) {
  if (hasRepeat(ctx.letters)) return true;
  if ((ctx.selection || []).some(s => (s.tile?.mods || []).some(m => m.id === 'twin'))) return true;  // engineered double (Twin mod)
  return false;
}
// long threshold drops by 1 with the longReach enabler.
const longThreshold = (ctx) => (ctx.enablers || []).includes('longReach') ? 5 : 6;

// Hone ×Mult kicker: high Hone levels add a multiplicative bonus (the scaling-investment wincon).
// Starting value is tunable. Applies only when the archetype's condition matches (caller gates it).
const honeXMult = (lvl) => (lvl >= 3 ? 1 + 0.25 * (lvl - 2) : 1);

export const ARCHETYPES = {
  shortWord: {
    id: 'shortWord', name: 'Short-word',
    desc: 'Words ≤3 letters: +Mult per level (plus ×Mult from Lv 3). Build a short-word engine.',
    matches: (ctx) => ctx.letters.length <= 3,
    honeBonus: (ctx, lvl) => ctx.letters.length <= 3 ? { addMult: lvl, timesMult: honeXMult(lvl) } : {},
  },
  longWord: {
    id: 'longWord', name: 'Long-word',
    desc: 'Words 6+ letters: +Mult per level (plus ×Mult from Lv 3).',
    matches: (ctx) => ctx.letters.length >= longThreshold(ctx),
    honeBonus: (ctx, lvl) => ctx.letters.length >= longThreshold(ctx) ? { addMult: 0.5 * lvl, timesMult: honeXMult(lvl) } : {},
  },
  rareLetter: {
    id: 'rareLetter', name: 'Rare-letter',
    desc: 'Words with J/Q/X/Z: +Points per level (plus ×Mult from Lv 3).',
    matches: (ctx) => hasRare(ctx),
    honeBonus: (ctx, lvl) => hasRare(ctx) ? { addPoints: 15 * lvl, timesMult: honeXMult(lvl) } : {},
  },
  doubled: {
    id: 'doubled', name: 'Doubled-letter',
    desc: 'Words with a doubled letter: +Points per level (plus ×Mult from Lv 3).',
    matches: (ctx) => isDoubled(ctx),
    honeBonus: (ctx, lvl) => isDoubled(ctx) ? { addPoints: 12 * lvl, timesMult: honeXMult(lvl) } : {},
  },
  vowelHeavy: {
    id: 'vowelHeavy', name: 'Vowel-heavy',
    desc: 'Words with 3+ vowels: +Points per vowel per level (plus ×Mult from Lv 3).',
    matches: (ctx) => ctx.letters.filter(isVowel).length >= 3,
    honeBonus: (ctx, lvl) => { const v = ctx.letters.filter(isVowel).length; return v >= 3 ? { addPoints: 2 * lvl * v, timesMult: honeXMult(lvl) } : {}; },
  },
  escalation: {
    id: 'escalation', name: 'Escalation',
    desc: 'Each word after the 1st this round: +Mult per level; chained words count too (plus ×Mult from Lv 3).',
    // Real condition (was () => true, the universal fallback that diluted its identity): escalation
    // applies once momentum has started — the 2nd+ word of a round, or a chained word. This also
    // folds in the chain mechanic (chainReaction / throughLine): a chained word counts as escalation,
    // so chain play benefits from the escalation Hone/identity instead of being an orphan mechanic.
    matches: (ctx) => (ctx.wordsPlayedThisRound || 0) >= 1 || (ctx.chainLength || 0) >= 1,
    // Lv3+ ×Mult kicker scales with the combo (words played), not just level — escalation's wincon
    // is multiplicative so it keeps pace with ×Mult engines. Magnitude tunable.
    honeBonus: (ctx, lvl) => {
      const n = ctx.wordsPlayedThisRound || 0;
      const m = 0.5 * lvl * n;
      const x = lvl >= 3 ? 1 + 0.1 * (lvl - 2) * n : 1;
      return (m || x !== 1) ? { addMult: m, timesMult: x } : {};
    },
  },
};

export const ALL_ARCHETYPE_IDS = Object.keys(ARCHETYPES);

export function honeModifiers(honeLevels = {}) {
  const mods = [];
  for (const id of ALL_ARCHETYPE_IDS) {
    const lvl = honeLevels[id] || 0;
    if (lvl <= 0) continue;
    const a = ARCHETYPES[id];
    mods.push({ id: `hone:${id}`, name: `Refine: ${a.name}`, evaluate: (ctx) => a.honeBonus(ctx, lvl) });   // id stays 'hone:' (internal); display name is Refine
  }
  return mods;
}

// Human description of the ACTUAL hone effect at a given level (real numbers, not the generic
// archetype flavour) — so the in-run hone popover shows what the level does.
export function honeDescription(id, lvl) {
  const kicker = lvl >= 3 ? ` and ×${honeXMult(lvl)} Mult to the word` : '';
  switch (id) {
    case 'shortWord':  return `+${lvl} Mult on words of 3 letters or fewer${kicker}`;
    case 'longWord':   return `+${0.5 * lvl} Mult on words of 6+ letters${kicker}`;
    case 'rareLetter': return `+${15 * lvl} Points on words using J, Q, X, or Z${kicker}`;
    case 'doubled':    return `+${12 * lvl} Points on words with a doubled letter${kicker}`;
    case 'vowelHeavy': return `+${2 * lvl} Points per vowel on words with 3+ vowels${kicker}`;
    case 'escalation': {
      const xk = lvl >= 3 ? `, plus ×Mult +${(0.1 * (lvl - 2)).toFixed(2)}/word` : '';
      return `+${0.5 * lvl} Mult per word played this round${xk}`;
    }
    default:           return ARCHETYPES[id]?.desc || '';
  }
}
