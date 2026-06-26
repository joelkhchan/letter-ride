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
  // Earnable through exploration (was "use EVERY relic/mod" - which never fired; with the larger
  // roster it was an unreachable grind, so the discovery bucket's Meta went unpaid). Now a breadth
  // count across runs; thresholds are tunable in config.
  { id: 'curator',        bucket: 'discovery', name: 'Curator',  desc: 'Use 12 different relics across your runs.',
    predicate: (p, c, cfg) => isEnd(c) && p.stats.relicsEverUsed.length >= cfg.META.achievement.discoverRelics },
  { id: 'enchanter',      bucket: 'discovery', name: 'Enchanter', desc: 'Apply 6 different tile-mods across your runs.',
    predicate: (p, c, cfg) => isEnd(c) && p.stats.modsEverApplied.length >= cfg.META.achievement.discoverMods },
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

const bountyReward = (key, config) => config.META.bounty[Number(key.split(':')[0])] || 0;

// Rewards are NOT paid automatically. Completing an achievement or winning a bounty cell marks it
// "earned"; the player collects the Meta on the Achievements screen (collectAchievement /
// collectBounty), which is the only path that adds Meta.

// Mark the (stake,deck) cell and all lower stakes for that deck as EARNED (no Meta paid yet).
// Returns the newly-earned keys.
export function grantBounties(profile, stakeId, deckId) {
  if (deckId == null) return [];
  const earned = [];
  for (let s = 0; s <= stakeId; s++) {
    const key = cellKey(s, deckId);
    if (!profile.bountyEarned[key]) { profile.bountyEarned[key] = true; earned.push(key); }
  }
  return earned;
}

// Collect one achievement's Meta. Returns the reward (0 if not completed or already claimed).
export function collectAchievement(profile, id, config) {
  if (!profile.completed.includes(id) || profile.claimedAchievements.includes(id)) return 0;
  const def = ACHIEVEMENTS.find(a => a.id === id);
  if (!def) return 0;
  profile.claimedAchievements.push(id);
  return rewardFor(def, config);
}

// Collect one bounty cell's Meta. Returns the reward (0 if not earned or already claimed).
export function collectBounty(profile, key, config) {
  if (!profile.bountyEarned[key] || profile.bountyClaimed[key]) return 0;
  profile.bountyClaimed[key] = true;
  return bountyReward(key, config);
}

// UI helpers: what is collectable right now, and the total pending Meta (for a menu badge).
export function collectableAchievements(profile, config) {
  const claimed = new Set(profile.claimedAchievements);
  return profile.completed.filter(id => !claimed.has(id)).map(id => {
    const def = ACHIEVEMENTS.find(a => a.id === id);
    return def ? { id, name: def.name, reward: rewardFor(def, config) } : null;
  }).filter(Boolean);
}

export function collectableBounties(profile, config) {
  return Object.keys(profile.bountyEarned)
    .filter(k => !profile.bountyClaimed[k])
    .map(k => ({ key: k, reward: bountyReward(k, config) }));
}

export function pendingMeta(profile, config) {
  const a = collectableAchievements(profile, config).reduce((s, x) => s + x.reward, 0);
  const b = collectableBounties(profile, config).reduce((s, x) => s + x.reward, 0);
  return a + b;
}
