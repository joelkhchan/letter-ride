// src/relics.js — relic content. Magnitudes are tunable here (relic = its effect).
import { hasDoubledLetter } from './patterns.js';
import { hasRare as hasRareCtx, isDoubled as isDoubledCtx } from './archetypes.js';

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const RARE = new Set(['J', 'Q', 'X', 'Z']);
const isVowel = (ch) => VOWELS.has(String(ch).toUpperCase());

export const RELICS = {
  vowelBonus: {
    id: 'vowelBonus', name: 'Vowel Bonus', desc: '+2 Points per vowel used',
    evaluate: (ctx) => ({ addPoints: 2 * ctx.letters.filter(isVowel).length }),
  },
  rareHoarder: {
    id: 'rareHoarder', name: 'Rare Hoarder', desc: '+30 Points if the word uses J, Q, X, or Z',
    evaluate: (ctx) => ({ addPoints: ctx.letters.some(l => RARE.has(l.toUpperCase())) ? 30 : 0 }),
  },
  shortAndSweet: {
    id: 'shortAndSweet', name: 'Short & Sweet', desc: 'Words of 3 letters or fewer: ×3 Mult',
    evaluate: (ctx) => (ctx.letters.length <= 3 ? { timesMult: 3 } : {}),
  },
  lengthy: {
    id: 'lengthy', name: 'Lengthy', desc: '+1 Mult per letter beyond 4',
    evaluate: (ctx) => ({ addMult: Math.max(0, ctx.letters.length - 4) }),
  },
  doubleTrouble: {
    id: 'doubleTrouble', name: 'Double Trouble', desc: '+40 Points if the word has a doubled letter',
    evaluate: (ctx) => ({ addPoints: hasDoubledLetter(ctx.word) ? 40 : 0 }),
  },
  freshStart: {
    id: 'freshStart', name: 'Fresh Start', desc: '+2 Mult if the word starts with a vowel',
    evaluate: (ctx) => ({ addMult: isVowel(ctx.letters[0]) ? 2 : 0 }),
  },
  comboCounter: {
    id: 'comboCounter', name: 'Combo Counter', desc: '+1 Mult per word already played this round',
    evaluate: (ctx) => ({ addMult: ctx.wordsPlayedThisRound || 0 }),
  },
  recycler: {
    id: 'recycler', name: 'Recycler', desc: '+$2 per unused play at round end',
    coinsOnRoundClear: (run) => 2 * run.playsLeft,
  },

  // ── Task 5: Mult engines, enablers, escalation ────────────────────────────

  // Rare-letter
  rareSurge: {
    id: 'rareSurge', name: 'Rare Surge', desc: '×1.5 Mult if the word uses a rare letter (J/Q/X/Z)',
    evaluate: (ctx) => hasRareCtx(ctx) ? { timesMult: 1.5 } : {},
  },
  wildcardRares: {
    id: 'wildcardRares', name: 'Wildcard Rares', desc: 'Wilds count as rare letters (J/Q/X/Z)',
    enabler: 'wildsAreRare', evaluate: () => ({}),
  },

  // Long-word
  longHaul: {
    id: 'longHaul', name: 'Long Haul', desc: '×Mult grows with length: ×(1 + 0.25 per letter beyond 5)',
    evaluate: (ctx) => ctx.letters.length > 5 ? { timesMult: 1 + 0.25 * (ctx.letters.length - 5) } : {},
  },
  longReach: {
    id: 'longReach', name: 'Long Reach', desc: 'Long-word bonuses trigger one letter sooner',
    enabler: 'longReach', evaluate: () => ({}),
  },

  // Pattern / doubled
  echoChamber: {
    id: 'echoChamber', name: 'Echo Chamber', desc: '×2 Mult if the word has a doubled letter',
    evaluate: (ctx) => isDoubledCtx(ctx) ? { timesMult: 2 } : {},
  },
  looseDoubles: {
    id: 'looseDoubles', name: 'Loose Doubles', desc: 'Any letter appearing 2+ times counts as doubled',
    enabler: 'looseDoubled', evaluate: () => ({}),
  },

  // Escalation / combo
  momentum: {
    id: 'momentum', name: 'Momentum', desc: '+10 Points per word already played this round',
    evaluate: (ctx) => ({ addPoints: 10 * (ctx.wordsPlayedThisRound || 0) }),
  },
  overtime: {
    id: 'overtime', name: 'Overtime', desc: '+1 play each round',
    extraPlays: 1, evaluate: () => ({}),
  },
};

export const ALL_RELIC_IDS = Object.keys(RELICS);
