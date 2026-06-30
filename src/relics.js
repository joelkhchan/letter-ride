// src/relics.js — relic content. Magnitudes are tunable here (relic = its effect).
import { hasRare as hasRareCtx, isDoubled as isDoubledCtx } from './archetypes.js';

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const RARE = new Set(['J', 'Q', 'X', 'Z']);
const isVowel = (ch) => VOWELS.has(String(ch).toUpperCase());

// ── Scaling / snowball relics ─────────────────────────────────────────────
// A snowball ratchets its OWN ×Mult as you play qualifying words. Per-relic state lives on
// run.relicState[id] = { stacks }. playWord increments stacks on each qualifying play (before
// scoring); evaluate reads the current stacks. timesMult = 1 + perStack*stacks, so the accumulated
// multiplier applies to EVERY word and only GROWS on a qualifying play (Balatro scaling-joker model).
// perStack values are tunable starting points.
function snowball({ id, name, desc, perStack, condition }) {
  return {
    id, name, desc,
    snowball: { condition },
    evaluate: (ctx) => ({ timesMult: 1 + perStack * (ctx.relicState?.[id]?.stacks || 0) }),
  };
}

export const RELICS = {
  vowelBonus: {
    id: 'vowelBonus', name: 'Vowel Bonus', desc: '+2 Points per vowel used',
    evaluate: (ctx) => ({ addPoints: 2 * ctx.letters.filter(isVowel).length }),
  },
  rareHoarder: {
    id: 'rareHoarder', name: 'Rare Hoarder', desc: '+40 Points if the word uses J, Q, X, or Z',
    evaluate: (ctx) => ({ addPoints: ctx.letters.some(l => RARE.has(l.toUpperCase())) ? 40 : 0 }),
  },
  shortAndSweet: {
    id: 'shortAndSweet', name: 'Short & Sweet', desc: 'Words of 3 letters or fewer: ×3 Mult',
    evaluate: (ctx) => (ctx.letters.length <= 3 ? { timesMult: 3 } : {}),
  },
  pithy: {
    id: 'pithy', name: 'Pithy', desc: '+15 Points if the word is 3 letters or fewer',
    evaluate: (ctx) => (ctx.letters.length <= 3 ? { addPoints: 15 } : {}),
  },
  lengthy: {
    id: 'lengthy', name: 'Lengthy', desc: '+1 Mult per letter beyond 4',
    evaluate: (ctx) => ({ addMult: Math.max(0, ctx.letters.length - 4) }),
  },
  doubleTrouble: {
    id: 'doubleTrouble', name: 'Double Trouble', desc: '+40 Points if the word has a doubled letter',
    evaluate: (ctx) => ({ addPoints: isDoubledCtx(ctx) ? 40 : 0 }),
  },
  freshStart: {
    id: 'freshStart', name: 'Fresh Start', desc: '+2 Mult if the word starts with a vowel',
    evaluate: (ctx) => ({ addMult: isVowel(ctx.letters[0]) ? 2 : 0 }),
  },
  comboCounter: {
    id: 'comboCounter', name: 'Combo Counter',
    desc: '+1 Mult and ×1.1 Mult per word played this round',
    // The ×Mult kicker is escalation's wincon: it stacks multiplicatively with ×Mult engines
    // (Echo Chamber, Refine kickers) instead of falling behind them late-round. Magnitude tunable.
    evaluate: (ctx) => {
      const n = ctx.wordsPlayedThisRound || 0;
      return n ? { addMult: n, timesMult: Math.pow(1.1, n) } : {};
    },
  },
  recycler: {
    id: 'recycler', name: 'Recycler', desc: '+$2 per unused play at round end',
    coinsOnRoundClear: (run) => 2 * run.playsLeft,
  },

  // ── Task 5: Mult engines, enablers, escalation ────────────────────────────

  // Rare-letter
  rareSurge: {
    id: 'rareSurge', name: 'Rare Surge', desc: '×1.8 Mult if the word uses a rare letter (J/Q/X/Z)',
    evaluate: (ctx) => hasRareCtx(ctx) ? { timesMult: 1.8 } : {},
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
    id: 'looseDoubles', name: 'Loose Doubles', desc: '+1 Mult per repeated letter (BOOKKEEPER = +3)',
    evaluate: (ctx) => {
      const c = {};
      for (const l of ctx.letters) c[l] = (c[l] || 0) + 1;
      const reps = Object.values(c).filter(n => n >= 2).length;
      return reps ? { addMult: reps } : {};
    },
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

  // ── Task 1: Snowball relics ───────────────────────────────────────────────
  rareAvalanche: snowball({
    id: 'rareAvalanche', name: 'Avalanche',
    desc: 'Grows +0.2 Mult per rare letter played (this run)',
    perStack: 0.2, condition: (ctx) => hasRareCtx(ctx),
  }),

  // ── Task 2: Five more snowball relics ──────────────────────────────────────
  flywheel: snowball({
    id: 'flywheel', name: 'Flywheel',
    desc: 'Grows +0.3 Mult per word of 3 letters or fewer (this run)',
    perStack: 0.3, condition: (ctx) => ctx.letters.length <= 3,
  }),
  juggernaut: snowball({
    id: 'juggernaut', name: 'Juggernaut',
    desc: 'Grows +0.2 Mult per word of 6+ letters (this run)',
    perStack: 0.2, condition: (ctx) => ctx.letters.length >= 6,
  }),
  resonanceEngine: snowball({
    id: 'resonanceEngine', name: 'Resonance',
    desc: 'Grows +0.2 Mult per doubled-letter word (this run)',
    perStack: 0.2, condition: (ctx) => isDoubledCtx(ctx),
  }),
  risingTide: snowball({
    id: 'risingTide', name: 'Rising Tide',
    desc: 'Grows +0.1 Mult per word with 3+ vowels (this run)',
    perStack: 0.1, condition: (ctx) => ctx.letters.filter(isVowel).length >= 3,
  }),
  perpetualEngine: snowball({
    id: 'perpetualEngine', name: 'Perpetual Engine',
    desc: 'Grows +0.1 Mult every word you play (this run)',
    perStack: 0.1, condition: () => true,
  }),

  // ── Phase 3 SP1: Retrigger relics ──────────────────────────────────────────
  pressLead: {
    id: 'pressLead', name: 'Press Lead', desc: 'The first letter of the word prints one extra time',
    evaluate: () => ({}),
    retriggerTile: (tile, ctx) => (ctx.selection[0]?.tile === tile ? 1 : 0),
  },
  rareReprint: {
    id: 'rareReprint', name: 'Rare Reprint', desc: 'Each J, Q, X, or Z prints one extra time',
    evaluate: () => ({}),
    retriggerTile: (tile) => (RARE.has(String(tile.letter).toUpperCase()) ? 1 : 0),
  },

  // ── Phase 3 SP3: Chaining relics (read ctx.chainLength, the letter-chain length this round) ──
  chainReaction: {
    id: 'chainReaction', name: 'Chain Reaction',
    desc: '×Mult grows +0.5 per chained word',
    evaluate: (ctx) => ({ timesMult: 1 + 0.5 * Math.max(0, (ctx.chainLength || 1) - 1) }),
  },
  throughLine: {
    id: 'throughLine', name: 'Through-Line',
    desc: '+8 Points per Word Chain link after the first',
    evaluate: (ctx) => ({ addPoints: 8 * Math.max(0, (ctx.chainLength || 1) - 1) }),
  },

  // ── Hand-size relics (handDelta is read by handSizeFor in run.js; the floor/clamp lives there) ──
  wideMargins: {
    id: 'wideMargins', name: 'Wide Margins', desc: 'Hold 1 more tile in hand',
    handDelta: 1, evaluate: () => ({}),
  },
  tightLeading: {
    id: 'tightLeading', name: 'Tight Leading', desc: '+1 Mult per word, but hold 1 fewer tile in hand. Stacks.',
    handDelta: -1, stackable: true, evaluate: () => ({ addMult: 1 }),
  },

  // ── Word-shape relics (affix / digraph — the missing shape family) ──
  suffixPress: {
    id: 'suffixPress', name: 'Suffix Press', desc: '+25 Points if the word ends in -ING, -ED, or -ER',
    evaluate: (ctx) => {
      const w = ctx.letters.join('').toUpperCase();
      return { addPoints: (w.endsWith('ING') || w.endsWith('ED') || w.endsWith('ER')) ? 25 : 0 };
    },
  },
  ligature: {
    id: 'ligature', name: 'Ligature', desc: '+2 Mult per digraph (TH, CH, SH, QU, PH) in the word',
    evaluate: (ctx) => {
      const w = ctx.letters.join('').toUpperCase();
      const n = (w.match(/TH|CH|SH|QU|PH/g) || []).length;
      return { addMult: 2 * n };
    },
  },

  // ── Economy relic (feeds the money engine; pairs with Recycler + interest + the Gilded mod) ──
  royaltyPress: {
    id: 'royaltyPress', name: 'Royalty Press', desc: '+$2 each word you play',
    coinsPerWord: 2, evaluate: () => ({}),
  },

  // ── Foresight relic (the Scrabble bag-tracking lever; `peek` is read by the UI, not scoring) ──
  galleyProof: {
    id: 'galleyProof', name: 'Galley Proof', desc: 'See the next 2 tiles you will draw',
    peek: 2, evaluate: () => ({}),
  },
};

export const ALL_RELIC_IDS = Object.keys(RELICS);
