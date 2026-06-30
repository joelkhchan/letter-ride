// src/profile.js — persisted, player-facing profile: lifetime stats, completed achievements,
// and the stake x deck bounty grid. Pure functions; storage injected. Distinct from telemetry
// (which is dev-only/resettable); the profile is the authoritative player-facing store.
const PROFILE_KEY = 'letterRide.profile';

export function makeProfile() {
  return {
    stats: {
      runs: 0, wins: 0, roundsCleared: 0, wordsPlayed: 0,
      lettersPlayed: 0,
      wordLenCounts: {},        // {length: count} histogram of words played, by length
      lifetimeScore: 0,
      bestWordScore: 0, bestWord: '', bestRunScore: 0, bestRoundScore: 0,
      longestWord: '', longestWordLen: 0,
      lossByRound: {},          // {roundIndex: count} of runs that DIED at each round - the "wall"
      archetypePlays: {},       // {archetypeId: lifetime match count} - drives the signature build
      relicsEverUsed: [], modsEverApplied: [],
      bossesBeaten: [],         // distinct boss ids cleared across runs (for Critic's Pick)
      maxCoinsHeld: 0,          // peak $ ever held in one run (for Tidy Sum)
      bestEndlessRound: 0,      // furthest endless round reached across runs
    },
    completed: [],            // achievement ids whose predicate fired (Meta uncollected by default)
    claimedAchievements: [],  // achievement ids whose Meta has been collected
    bountyEarned: {},         // `${stake}:${deck}` cells won (Meta uncollected)
    bountyClaimed: {},        // `${stake}:${deck}` cells whose Meta has been collected
  };
}

export function loadProfile(storage) {
  const raw = storage.getItem(PROFILE_KEY);
  if (!raw) return makeProfile();
  try {
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return makeProfile();
    const base = makeProfile();
    const obj = (v) => (v && typeof v === 'object') ? v : {};
    return {
      stats: { ...base.stats, ...(data.stats || {}) },
      completed: Array.isArray(data.completed) ? data.completed : [],
      claimedAchievements: Array.isArray(data.claimedAchievements) ? data.claimedAchievements : [],
      bountyEarned: obj(data.bountyEarned),
      bountyClaimed: obj(data.bountyClaimed),
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
  const word = ctx.word || '';
  s.wordsPlayed += 1;
  s.lettersPlayed = (s.lettersPlayed || 0) + word.length;
  if (word.length) { s.wordLenCounts = s.wordLenCounts || {}; s.wordLenCounts[word.length] = (s.wordLenCounts[word.length] || 0) + 1; }
  s.lifetimeScore += ctx.score || 0;
  if ((ctx.score || 0) > s.bestWordScore) { s.bestWordScore = ctx.score || 0; s.bestWord = word; }
  if (word.length > (s.longestWordLen || 0)) { s.longestWordLen = word.length; s.longestWord = word; }
  if ((ctx.roundTotal || 0) > (s.bestRoundScore || 0)) s.bestRoundScore = ctx.roundTotal || 0;
}

export function recordRunEnd(profile, summary) {
  const s = profile.stats;
  s.runs += 1;
  if (summary.won) s.wins += 1;
  else {
    // On a loss, roundsCleared is the round the run died on (run.roundIndex). Tally the wall.
    const r = summary.roundsCleared || 0;
    s.lossByRound = s.lossByRound || {};
    s.lossByRound[r] = (s.lossByRound[r] || 0) + 1;
  }
  s.roundsCleared += summary.roundsCleared || 0;
  if ((summary.runScore || 0) > s.bestRunScore) s.bestRunScore = summary.runScore || 0;
  for (const id of summary.relicIds || []) addUnique(s.relicsEverUsed, id);
  for (const id of summary.modIds || []) addUnique(s.modsEverApplied, id);
  // Lifetime archetype lean (from this run's per-archetype match tally) -> signature build.
  s.archetypePlays = s.archetypePlays || {};
  const tally = summary.archetypeTally || {};
  for (const id of Object.keys(tally)) s.archetypePlays[id] = (s.archetypePlays[id] || 0) + (tally[id] || 0);
}

// Lifetime rank derived from cumulative Score. Pure; tier names + thresholds come from config.LEVELS.
// The level is prestige only (no currency, no power); Meta is paid by "reach level X" achievements.
export function levelFor(lifetimeScore, config) {
  const t = config.LEVELS.thresholds, names = config.LEVELS.names;
  let i = 0;
  for (let k = 0; k < t.length; k++) if (lifetimeScore >= t[k]) i = k;
  return { index: i, name: names[i], nextAt: t[i + 1] ?? null };
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// The archetype the player leans on most (by lifetime match count). null if no data yet.
function topArchetype(plays) {
  const entries = Object.entries(plays || {});
  if (!entries.length) return null;
  const total = entries.reduce((a, [, n]) => a + n, 0);
  const [id, n] = entries.reduce((best, e) => (e[1] > best[1] ? e : best));
  return { id, plays: n, share: total ? n / total : 0 };
}

// The round most runs die on (the "wall"). null if no losses recorded.
function topLossRound(lossByRound) {
  const entries = Object.entries(lossByRound || {});
  if (!entries.length) return null;
  const [idx, count] = entries.reduce((best, e) => (Number(e[1]) > Number(best[1]) ? e : best));
  return { roundIndex: Number(idx), count: Number(count) };
}

// Pure, player-facing analytics derived from the profile. The Stats screen formats this; the
// derivation (averages, rates, rank progress) lives here so it stays testable and DOM-free.
// totals: { relicsTotal, modsTotal, achievementsTotal } supplied from the catalogs.
export function statsSummary(profile, config, totals = {}) {
  const s = profile?.stats || {};
  const runs = s.runs || 0, wins = s.wins || 0, words = s.wordsPlayed || 0;
  const lifetimeScore = s.lifetimeScore || 0;
  const rank = levelFor(lifetimeScore, config);
  const tierAt = config.LEVELS.thresholds[rank.index] || 0;
  const per = (n, d) => (d > 0 ? n / d : 0);
  return {
    rank: {
      name: rank.name, index: rank.index, lifetimeScore, nextAt: rank.nextAt,
      progress: rank.nextAt ? clamp01((lifetimeScore - tierAt) / (rank.nextAt - tierAt)) : 1,
    },
    runs, wins, winRate: per(wins, runs),
    roundsCleared: s.roundsCleared || 0, avgRoundsPerRun: per(s.roundsCleared || 0, runs),
    bestRunScore: s.bestRunScore || 0,
    wordsPlayed: words, avgWordLength: per(s.lettersPlayed || 0, words),
    wordLenCounts: s.wordLenCounts || {},
    longestWord: s.longestWord || '', longestWordLen: s.longestWordLen || 0,
    bestWord: s.bestWord || '', bestWordScore: s.bestWordScore || 0,
    bestRoundScore: s.bestRoundScore || 0, avgScorePerWord: per(lifetimeScore, words),
    lifetimeScore,
    relicsDiscovered: (s.relicsEverUsed || []).length, relicsTotal: totals.relicsTotal || 0,
    modsDiscovered: (s.modsEverApplied || []).length, modsTotal: totals.modsTotal || 0,
    achievementsDone: (profile?.completed || []).length,
    achievementsClaimed: (profile?.claimedAchievements || []).length,
    achievementsTotal: totals.achievementsTotal || 0,
    signatureArchetype: topArchetype(s.archetypePlays),   // { id, plays, share } or null
    lossByRound: s.lossByRound || {},                      // { roundIndex: count }
    wall: topLossRound(s.lossByRound),                     // { roundIndex, count } or null
  };
}
