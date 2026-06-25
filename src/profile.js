// src/profile.js — persisted, player-facing profile: lifetime stats, completed achievements,
// and the stake x deck bounty grid. Pure functions; storage injected. Distinct from telemetry
// (which is dev-only/resettable); the profile is the authoritative player-facing store.
const PROFILE_KEY = 'letterRide.profile';

export function makeProfile() {
  return {
    stats: {
      runs: 0, wins: 0, roundsCleared: 0, wordsPlayed: 0,
      lifetimeScore: 0,
      bestWordScore: 0, bestWord: '', bestRunScore: 0,
      relicsEverUsed: [], modsEverApplied: [],
    },
    completed: [],
    bountyGrid: {},
  };
}

export function loadProfile(storage) {
  const raw = storage.getItem(PROFILE_KEY);
  if (!raw) return makeProfile();
  try {
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return makeProfile();
    const base = makeProfile();
    return {
      stats: { ...base.stats, ...(data.stats || {}) },
      completed: Array.isArray(data.completed) ? data.completed : [],
      bountyGrid: (data.bountyGrid && typeof data.bountyGrid === 'object') ? data.bountyGrid : {},
    };
  } catch {
    return makeProfile();
  }
}

export function saveProfile(profile, storage) {
  storage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

const addUnique = (arr, id) => { if (!arr.includes(id)) arr.push(id); };

export function recordPlay(profile, ctx) {
  const s = profile.stats;
  s.wordsPlayed += 1;
  s.lifetimeScore += ctx.score || 0;
  if ((ctx.score || 0) > s.bestWordScore) { s.bestWordScore = ctx.score || 0; s.bestWord = ctx.word || ''; }
}

export function recordRunEnd(profile, summary) {
  const s = profile.stats;
  s.runs += 1;
  if (summary.won) s.wins += 1;
  s.roundsCleared += summary.roundsCleared || 0;
  if ((summary.runScore || 0) > s.bestRunScore) s.bestRunScore = summary.runScore || 0;
  for (const id of summary.relicIds || []) addUnique(s.relicsEverUsed, id);
  for (const id of summary.modIds || []) addUnique(s.modsEverApplied, id);
}

// Lifetime rank derived from cumulative Score. Pure; tier names + thresholds come from config.LEVELS.
// The level is prestige only (no currency, no power); Meta is paid by "reach level X" achievements.
export function levelFor(lifetimeScore, config) {
  const t = config.LEVELS.thresholds, names = config.LEVELS.names;
  let i = 0;
  for (let k = 0; k < t.length; k++) if (lifetimeScore >= t[k]) i = k;
  return { index: i, name: names[i], nextAt: t[i + 1] ?? null };
}
