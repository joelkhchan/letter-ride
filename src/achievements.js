// src/achievements.js — achievement catalog (data + pure predicates) and checking logic.
// Predicates are pure functions of (profile, ctx, config). No DOM, no storage, no rng.
// Build-diversity predicates reuse the dominant-archetype tally produced in run.js.
import { levelFor } from './profile.js';

// Dominant build archetype this run, ignoring 'escalation' (which matches every play).
function dominantArchetype(tally = {}) {
  let best = null, bestN = 0;
  for (const [id, n] of Object.entries(tally)) {
    if (id === 'escalation') continue;
    if (n > bestN) { best = id; bestN = n; }
  }
  return best;
}

const levelIndex = (p, cfg) => levelFor((p.stats && p.stats.lifetimeScore) || 0, cfg).index;

const isPlay = (c) => c.phase === 'play';
const isEnd  = (c) => c.phase === 'end';
const has = (letters, ch) => (letters || []).includes(ch);

// Each entry: { id, bucket, name, desc, predicate(profile, ctx, config) }. The Meta reward
// is config-driven (no literals in the catalog): config.META.achievement.rewardOverride[id]
// if present, else config.META.achievement.reward[bucket]. This keeps every number in config.
export const ACHIEVEMENTS = [
  // --- Onboarding (small) ---
  { id: 'firstRound',     bucket: 'onboarding', name: 'First Impression', desc: 'Clear your first round.',
    predicate: (p, c) => isPlay(c) && c.status === 'roundCleared' },
  { id: 'firstWin',       bucket: 'onboarding', name: 'Off the Press',     desc: 'Win your first full run.',
    predicate: (p, c) => isEnd(c) && c.won },
  { id: 'firstRelic',     bucket: 'onboarding', name: 'Stocked',           desc: 'Finish a run owning a relic.',
    predicate: (p, c) => isEnd(c) && c.relicsCount >= 1 },
  { id: 'fiveLetter',     bucket: 'onboarding', name: 'Set in Type',       desc: 'Play a 5+ letter word.',
    predicate: (p, c) => isPlay(c) && (c.letters || []).length >= 5 },
  { id: 'reachPassage2',  bucket: 'onboarding', name: 'Type Founder',      desc: 'Reach Passage 2.',
    predicate: (p, c) => isPlay(c) && Math.floor((c.roundIndex || 0) / 3) + 1 >= 2 },

  // --- Mastery (bulk of the Meta budget) ---
  { id: 'winNoBuy',       bucket: 'mastery', name: 'Clean Sheet',  desc: 'Win a run buying nothing.',
    predicate: (p, c) => isEnd(c) && c.won && !c.boughtAnythingThisRun },
  { id: 'oneWordClear',   bucket: 'mastery', name: 'One and Done', desc: 'Clear a round in a single word.',
    predicate: (p, c) => isPlay(c) && c.status === 'roundCleared' && c.wordsPlayedThisRound === 1 },
  { id: 'bigWord',        bucket: 'mastery', name: 'Heavy Impression', desc: 'Play a single word worth a lot.',
    predicate: (p, c, cfg) => isPlay(c) && (c.score || 0) >= cfg.META.achievement.bigWordScore },
  { id: 'winStake1',      bucket: 'mastery', name: 'Pressrun',     desc: 'Win on Stake 1.',
    predicate: (p, c) => isEnd(c) && c.won && (c.stakeId || 0) >= 1 },
  { id: 'winStake2',      bucket: 'mastery', name: 'Master Printer', desc: 'Win on Stake 2.',  // reward via rewardOverride.winStake2
    predicate: (p, c) => isEnd(c) && c.won && (c.stakeId || 0) >= 2 },
  { id: 'bigRound',       bucket: 'mastery', name: 'Engine Room',  desc: 'Score big in a single round.',
    predicate: (p, c, cfg) => isPlay(c) && c.status === 'roundCleared' && (c.roundTotal || 0) >= cfg.META.achievement.bigRoundScore },
  { id: 'speedWin',       bucket: 'mastery', name: 'Speed Set',    desc: 'Win in few total words.',
    predicate: (p, c, cfg) => isEnd(c) && c.won && (c.totalWordsThisRun || 0) <= cfg.META.achievement.efficientWords },
  { id: 'winNoDiscard',   bucket: 'mastery', name: 'No Waste',     desc: 'Win without discarding.',
    predicate: (p, c) => isEnd(c) && c.won && !c.discardedThisRun },
  { id: 'clutch',         bucket: 'mastery', name: 'Comeback',     desc: 'Clear a round on your final play from behind.',
    predicate: (p, c) => isPlay(c) && c.status === 'roundCleared' && c.playsLeft <= 0 && (c.prevRoundTotal || 0) < c.target },
  { id: 'flawless',       bucket: 'mastery', name: 'Full Press',   desc: 'Win without ever clearing on your last play.',
    predicate: (p, c) => isEnd(c) && c.won && c.flawlessSoFar },

  // --- Build diversity (moderate) ---
  { id: 'winVowels',      bucket: 'diversity', name: 'Vowel Movement', desc: 'Win leaning vowels.',
    predicate: (p, c) => isEnd(c) && c.won && dominantArchetype(c.archetypeTally) === 'vowelHeavy' },
  { id: 'winRare',        bucket: 'diversity', name: 'Rare Earth',     desc: 'Win leaning rare letters.',
    predicate: (p, c) => isEnd(c) && c.won && dominantArchetype(c.archetypeTally) === 'rareLetter' },
  { id: 'winShort',       bucket: 'diversity', name: 'Short Stack',    desc: 'Win with a short-word build.',
    predicate: (p, c) => isEnd(c) && c.won && dominantArchetype(c.archetypeTally) === 'shortWord' },
  { id: 'winLong',        bucket: 'diversity', name: 'Long Hauler',    desc: 'Win with a long-word build.',
    predicate: (p, c) => isEnd(c) && c.won && dominantArchetype(c.archetypeTally) === 'longWord' },
  { id: 'winManyMods',    bucket: 'diversity', name: "Enchanter's Run", desc: 'Win using several tile-mods.',
    predicate: (p, c, cfg) => isEnd(c) && c.won && (c.modsCount || 0) >= cfg.META.achievement.manyMods },
  { id: 'winManyRelics',  bucket: 'diversity', name: 'Relic Hound',    desc: 'Win with several relics.',
    predicate: (p, c, cfg) => isEnd(c) && c.won && (c.relicsCount || 0) >= cfg.META.achievement.manyRelics },

  // --- Discovery / long-tail prestige (low) ---
  { id: 'curator',        bucket: 'discovery', name: 'Curator',  desc: 'Use every relic at least once.',
    predicate: (p, c) => isEnd(c) && (c.allRelicIds || []).length > 0 && (c.allRelicIds || []).every(id => p.stats.relicsEverUsed.includes(id)) },
  { id: 'enchanter',      bucket: 'discovery', name: 'Enchanter', desc: 'Apply every tile-mod at least once.',
    predicate: (p, c) => isEnd(c) && (c.allModIds || []).length > 0 && (c.allModIds || []).every(id => p.stats.modsEverApplied.includes(id)) },
  { id: 'qNoU',           bucket: 'discovery', name: 'Q Without U', desc: 'Play a word with Q and no U.',
    predicate: (p, c) => isPlay(c) && has(c.letters, 'Q') && !has(c.letters, 'U') },
  { id: 'fullHouse',      bucket: 'discovery', name: 'Full House', desc: 'Play a word using all five vowels.',
    predicate: (p, c) => isPlay(c) && ['A','E','I','O','U'].every(v => has(c.letters, v)) },

  // --- Progression / lifetime rank (Meta via rewardOverride; the level itself is prestige only) ---
  { id: 'reachApprentice', bucket: 'progression', name: 'Apprentice', desc: 'Reach the Apprentice rank.',
    predicate: (p, c, cfg) => levelIndex(p, cfg) >= 1 },
  { id: 'reachJourneyman', bucket: 'progression', name: 'Journeyman', desc: 'Reach the Journeyman rank.',
    predicate: (p, c, cfg) => levelIndex(p, cfg) >= 2 },
  { id: 'reachExpert',     bucket: 'progression', name: 'Expert',     desc: 'Reach the Expert rank.',
    predicate: (p, c, cfg) => levelIndex(p, cfg) >= 3 },
  { id: 'reachArtisan',    bucket: 'progression', name: 'Artisan',    desc: 'Reach the Artisan rank.',
    predicate: (p, c, cfg) => levelIndex(p, cfg) >= 4 },
];

function rewardFor(def, config) {
  const a = config.META.achievement;
  return (a.rewardOverride && a.rewardOverride[def.id]) ?? a.reward[def.bucket];
}

// Pure: returns newly-completed achievements (not already in profile.completed). No mutation.
export function checkAchievements(profile, ctx, config) {
  const done = new Set(profile.completed);
  const out = [];
  for (const def of ACHIEVEMENTS) {
    if (done.has(def.id)) continue;
    let ok = false;
    try { ok = def.predicate(profile, ctx, config); } catch { ok = false; }
    if (ok) out.push({ id: def.id, name: def.name, desc: def.desc, bucket: def.bucket, reward: rewardFor(def, config) });
  }
  return out;
}

export function cellKey(stakeId, deckId) { return `${stakeId}:${deckId}`; }

// Mutates profile.bountyGrid: grants the (stake,deck) cell and all lower stakes for that deck.
// Returns the newly granted keys and the total Meta to award.
export function grantBounties(profile, stakeId, deckId, config) {
  if (deckId == null) return { granted: [], meta: 0 };
  const granted = [];
  let meta = 0;
  for (let s = 0; s <= stakeId; s++) {
    const key = cellKey(s, deckId);
    if (!profile.bountyGrid[key]) {
      profile.bountyGrid[key] = true;
      granted.push(key);
      meta += config.META.bounty[s] || 0;
    }
  }
  return { granted, meta };
}
