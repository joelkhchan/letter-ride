// src/events.js — run nodes: events are a between-encounter choice vs the Shop.
// One-shot events resolve on pick; The Press (Task 2) is interactive. Seeded mutators (draw from run.rng).
import { makeTile, WILD } from './tiles.js';
import { RELICS, ALL_RELIC_IDS } from './relics.js';
import { shuffle, makeRng } from './rng.js';
import { scoreGuess, isSolved, wordleCoins, pickTarget } from './wordle.js';

// helper: pick N distinct random tiles from the bag via run.rng
function pickRandomTiles(run, n) {
  return shuffle([...run.bag.tiles], run.rng).slice(0, n);
}

export const EVENTS = {
  theBlank: {
    id: 'theBlank', name: 'The Blank',
    desc: 'Swap 3 random tiles in your bag for 1 Wild',
    autoResolve: true,   // single option, no player input: resolves on pick (no confirm click)
    options: [{ label: 'Swap 3 tiles for a Wild', apply: (run) => {
      const victims = pickRandomTiles(run, 3);
      for (const t of victims) run.bag.remove(t.id);
      run.bag.add(makeTile(WILD));
    } }],
    canOffer: (run) => run.bag.tiles.length > run.config.RACK_SIZE + 3,
  },
  wordsmith: {
    id: 'wordsmith', name: 'Wordsmith',
    desc: 'Gain a free Refine level for a build path you choose',
    options: [{ label: 'Refine a build (free)', apply: (run, opts) => {
      const arch = opts?.archetypeId;
      if (!arch) return { ok: false, reason: 'no-target' };
      if (!run.honeLevels) run.honeLevels = {};
      run.honeLevels[arch] = (run.honeLevels[arch] || 0) + 1;
    } }],
    canOffer: () => true,
  },
  redaction: {
    id: 'redaction', name: 'Redaction',
    desc: 'Remove up to 2 tiles of your choice from your bag',
    options: [{ label: 'Remove up to 2 tiles (free)', apply: (run, opts) => {
      const ids = opts?.tileIds || [];
      if (ids.length < 1 || ids.length > 2) return { ok: false, reason: 'bad-count' };
      for (const id of ids) run.bag.remove(id);
    } }],
    canOffer: (run) => run.bag.tiles.length > run.config.RACK_SIZE + 2,
  },
  inkMerchant: {
    id: 'inkMerchant', name: 'Ink Merchant',
    desc: 'Pay $5: gain a random relic you do not own',
    autoResolve: true,   // single option, no player input: buys on pick (no confirm click)
    options: [{ label: 'Pay $5 for a random relic', apply: (run) => {
      if (run.coins < 5) return { ok: false, reason: 'broke' };
      const owned = new Set(run.relics.map(r => r.id));
      const pool = ALL_RELIC_IDS.filter(id => !owned.has(id));
      if (!pool.length) return { ok: false, reason: 'all-owned' };
      const pick = shuffle(pool, run.rng)[0];
      run.coins -= 5;
      run.relics.push(RELICS[pick]);
    } }],
    canOffer: (run) => run.coins >= 5 && run.relics.length < ALL_RELIC_IDS.length,
  },
  thePress: {
    id: 'thePress', name: 'The Press', interactive: true,
    desc: 'Draw letters for $. Bank to keep the pot or Press your luck; bust on a repeat and lose it all.',
    canOffer: () => true,
  },
  theProof: {
    id: 'theProof', name: 'The Proof', interactive: true,
    desc: 'Guess the hidden 5-letter word in 6 tries. Solve it to claim $ (more for fewer guesses) or a relic.',
    canOffer: () => true,
  },
};

export const ALL_EVENT_IDS = Object.keys(EVENTS);

export function applyEventOption(run, eventId, optionIndex, opts = {}) {
  const ev = EVENTS[eventId];
  if (!ev) return { ok: false, reason: 'unknown' };
  const opt = ev.options?.[optionIndex];
  if (!opt) return { ok: false, reason: 'no-option' };
  const r = opt.apply(run, opts);
  return r && r.ok === false ? r : { ok: true };
}

// --- The Press: interactive push-your-luck state machine ---

export function pressStart(run) {
  run.press = { drawn: [], pot: 0, busted: false };
}

export function pressDraw(run) {
  const st = run.press;
  if (!st || st.busted) return st;
  const pool = Object.keys(run.tileValues).filter(l => l !== '*');
  // forcedNext is a test hook: set run.press.forcedNext = 'X' to deterministically draw that letter.
  const letter = st.forcedNext || shuffle([...pool], run.rng)[0];
  st.forcedNext = null;
  if (st.drawn.includes(letter)) {
    st.busted = true;
    st.pot = 0;
    return st;
  }
  st.drawn.push(letter);
  st.pot += run.tileValues[letter] || 0;
  return st;
}

export function pressBank(run) {
  const st = run.press;
  if (!st || st.busted) { run.press = null; return run; }
  run.coins += st.pot;
  run.press = null;
  return run;
}

// --- The Proof: a Wordle-style guess-the-word event ---

// Begin the event: pick a target from the supplied common-word pool via a SEPARATE seeded stream
// (constant 0x7f4a7c15, distinct from bossOrder/event-pick), so it never desyncs run.rng.
export function wordleStart(run, answers) {
  const cfg = run.config.WORDLE;
  const stream = makeRng((run.seed ^ 0x7f4a7c15 ^ run.roundIndex) >>> 0);
  run.wordle = {
    target: pickTarget(answers, stream),
    guesses: [],                 // [{ word, statuses }]
    maxGuesses: cfg.maxGuesses,
    length: cfg.length,
    status: 'playing',           // 'playing' | 'solved' | 'failed'
  };
  return run.wordle;
}

export function wordleGuess(run, word) {
  const st = run.wordle;
  if (!st || st.status !== 'playing') return { ok: false, reason: 'done' };
  const g = String(word || '').toLowerCase();
  if (g.length !== st.length) return { ok: false, reason: 'length' };
  if (!run.dictionary.isValid(g)) return { ok: false, reason: 'invalid' };
  const statuses = scoreGuess(g, st.target);
  st.guesses.push({ word: g, statuses });
  if (isSolved(statuses)) st.status = 'solved';
  else if (st.guesses.length >= st.maxGuesses) st.status = 'failed';
  return { ok: true, statuses, status: st.status };
}

// Claim the solve reward: 'coins' (scales with speed) or 'relic' (a random unowned relic).
export function wordleClaim(run, choice) {
  const st = run.wordle;
  if (!st || st.status !== 'solved' || st.claimed) return { ok: false, reason: 'not-claimable' };
  const cfg = run.config.WORDLE;
  let granted = { type: 'coins', amount: 0 };
  const owned = new Set(run.relics.map(r => r.id));
  const pool = ALL_RELIC_IDS.filter(id => !owned.has(id));
  if (choice === 'relic' && pool.length) {
    const pick = shuffle(pool, run.rng)[0];
    run.relics.push(RELICS[pick]);
    granted = { type: 'relic', id: pick };
  } else {
    const amount = wordleCoins(st.guesses.length, cfg);   // fall back to coins if 'relic' but all owned
    run.coins += amount;
    granted = { type: 'coins', amount };
  }
  st.claimed = true;
  return { ok: true, granted };
}
