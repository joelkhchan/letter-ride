// scripts/analyze-meta.js — meta-economy CAREER harness (the 7th harness).
// Simulates careers of full runs per archetype, across the "meta economy" dimension:
//   without = full pool unlocked from run 1 (no progression gating) — the skill ceiling.
//   with    = a career: start base-unlocked, earn Meta (drip + collected achievements + bounties),
//             spend it to unlock relics/stakes/loadout, so the pool grows over runs.
// Reports unlock / achievement / level / win-rate pacing → 6 archetypes x {with,without} = 12 cells.
// Read-only; prints tables, asserts nothing. Mirrors main.js's run-end orchestration headlessly.
// SLOW (greedy enumeration over ENABLE per play). Flags: --runs N --careers M --seed S.
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { makeDictionary } from '../src/dictionary.js';
import { bestPlay, buildPurchasePolicy, smartDiscard, PERSONAS } from '../src/sim.js';
import { newRun, playWord, discard, nextRound } from '../src/run.js';
import { makeMetaState, poolFromMeta, metaEarned, metaShopOffers, purchaseMeta } from '../src/meta.js';
import { checkAchievements, grantBounties, collectAchievement, collectBounty, ACHIEVEMENTS } from '../src/achievements.js';
import { makeProfile, recordPlay as profileRecordPlay, recordRunEnd as profileRecordRunEnd, levelFor } from '../src/profile.js';
import { ALL_RELIC_IDS } from '../src/relics.js';
import { ALL_MOD_IDS } from '../src/tiles.js';

const argNum = (name, def) => { const i = process.argv.indexOf(name); return i >= 0 ? Number(process.argv[i + 1]) : def; };
const RUNS = argNum('--runs', 30);        // runs per career
const CAREERS = argNum('--careers', 3);   // independent careers per cell (averaged)
const SEED0 = argNum('--seed', 1);

const raw = readFileSync(new URL('../assets/enable1.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const dictionary = makeDictionary(raw);
const words = raw.filter(w => w.length >= CONFIG.MIN_WORD_LEN && w.length <= CONFIG.RACK_SIZE).map(w => w.toUpperCase());

const TARGETS = CONFIG.ROUND_TARGETS;
const RANKS = CONFIG.LEVELS.names;
const CATALOG_N = ACHIEVEMENTS.length;

function resolveDeck(persona) {
  if (persona.bagId === 'standard') return { id: 'standard', startingBag: CONFIG.STARTING_BAG };
  const d = CONFIG.DECKS[persona.bagId];
  return { id: d.id, startingBag: d.startingBag };
}

function fullyUnlockedMeta() {
  const m = makeMetaState(CONFIG);
  m.unlockedRelics = [...ALL_RELIC_IDS];
  m.unlockedMods = [...ALL_MOD_IDS];
  m.unlockedDecks = Object.keys(CONFIG.DECKS);
  m.unlockedStakes = CONFIG.STAKES.map(s => s.id);
  return m;
}

// Greedy meta-shop spend at run end: target relics first, then a stake, loadout, any relic, target mod.
// Returns count purchased this call.
function spendMeta(meta, persona) {
  let bought = 0, progress = true;
  while (progress) {
    progress = false;
    const offers = metaShopOffers(meta, CONFIG, ALL_RELIC_IDS, ALL_MOD_IDS).filter(o => o.cost <= meta.meta);
    const pick =
      offers.find(o => o.type === 'unlockRelic' && persona.targetRelicIds.includes(o.relicId)) ||
      offers.find(o => o.type === 'unlockStake') ||
      offers.find(o => o.type === 'loadout') ||
      offers.find(o => o.type === 'unlockMod' && persona.targetModIds.includes(o.modId)) ||
      offers.find(o => o.type === 'unlockRelic') ||
      null;
    if (pick && purchaseMeta(meta, pick, CONFIG).ok) { bought++; progress = true; }
  }
  return bought;
}

// One full run, mirroring main.js orchestration (play-ctx + end-ctx achievement checks).
// Mutates `profile`; returns per-run facts.
function playRun({ seed, persona, pool, profile }) {
  const deck = resolveDeck(persona);
  const policy = buildPurchasePolicy({
    targetRelicIds: persona.targetRelicIds, targetHoneId: persona.targetHoneId,
    targetModIds: persona.targetModIds, reserve: 0, maxRerolls: 3, pool,
  });
  const run = newRun({ config: CONFIG, dictionary, seed, deck });
  const newlyCompleted = [];
  const mark = (list) => { for (const a of list) if (!profile.completed.includes(a.id)) { profile.completed.push(a.id); newlyCompleted.push(a.id); } };
  const scoreBefore = profile.stats.lifetimeScore;
  let iter = 0;
  while (run.status === 'playing' && iter < 1000) {
    iter++;
    const play = bestPlay(run, words);
    if (play) {
      const before = run.roundTotal;
      playWord(run, play.selection);
      const gained = run.roundTotal - before;
      const word = play.selection.map(s => s.letter).join('').toUpperCase();
      profileRecordPlay(profile, { word, score: gained });
      mark(checkAchievements(profile, {
        phase: 'play', letters: play.selection.map(s => s.letter.toUpperCase()), word,
        score: gained, wordsPlayedThisRound: run.wordsPlayedThisRound, status: run.status,
        playsLeft: run.playsLeft, prevRoundTotal: before, target: run.target,
        roundTotal: run.roundTotal, roundIndex: run.roundIndex,
      }, CONFIG));
    } else if (run.discardsLeft > 0 && run.rack.length > 0) {
      discard(run, smartDiscard(run));
    } else break;
    if (run.status === 'roundCleared') { policy(run); nextRound(run); }
  }
  if (run.status === 'playing') run.status = 'lost';
  const won = run.status === 'won';
  const roundsCleared = won ? TARGETS.length : run.roundIndex;
  const relicIds = run.relics.map(r => r.id);
  const modIds = [...new Set(run.bag.tiles.flatMap(t => t.mods.map(m => m.id)))];
  profileRecordRunEnd(profile, { won, roundsCleared, runScore: run.roundTotal, relicIds, modIds });
  mark(checkAchievements(profile, {
    phase: 'end', won, roundIndex: run.roundIndex,
    boughtAnythingThisRun: !!run.boughtAnythingThisRun, discardedThisRun: !!run.discardedThisRun,
    totalWordsThisRun: run.totalWordsThisRun || 0, flawlessSoFar: run.flawlessSoFar !== false,
    archetypeTally: run.archetypeTally || {}, relicsCount: relicIds.length, modsCount: modIds.length,
    stakeId: run.stake?.id ?? 0, allRelicIds: ALL_RELIC_IDS, allModIds: ALL_MOD_IDS,
  }, CONFIG));
  const bountyKeys = won ? grantBounties(profile, run.stake?.id ?? 0, run.deck?.id ?? null) : [];
  return { won, roundsCleared, runScore: profile.stats.lifetimeScore - scoreBefore, newlyCompleted, bountyKeys };
}

function runCareer({ persona, withMeta, careerSeed }) {
  const profile = makeProfile();
  const meta = withMeta ? makeMetaState(CONFIG) : fullyUnlockedMeta();
  const winFlags = [], metaPerRun = [], scorePerRun = [];
  const rankRun = {};            // rank index -> run number first reached
  let firstUnlockRun = null, allTargetRelicsRun = null;
  for (let i = 0; i < RUNS; i++) {
    const pool = withMeta ? poolFromMeta(meta) : {};
    const r = playRun({ seed: careerSeed * 100003 + i * 7 + 1, persona, pool, profile });
    const drip = metaEarned({ status: r.won ? 'won' : 'lost', roundIndex: r.roundsCleared, targets: TARGETS }, CONFIG);
    let collected = 0;
    for (const id of r.newlyCompleted) collected += collectAchievement(profile, id, CONFIG);
    for (const k of r.bountyKeys) collected += collectBounty(profile, k, CONFIG);
    meta.meta += drip + collected;
    winFlags.push(r.won); metaPerRun.push(drip + collected); scorePerRun.push(r.runScore);
    const lvl = levelFor(profile.stats.lifetimeScore, CONFIG).index;
    for (let k = 1; k <= lvl; k++) if (rankRun[k] == null) rankRun[k] = i + 1;
    if (withMeta) {
      const bought = spendMeta(meta, persona);
      if (firstUnlockRun == null && bought > 0) firstUnlockRun = i + 1;
      if (allTargetRelicsRun == null && persona.targetRelicIds.every(id => meta.unlockedRelics.includes(id))) allTargetRelicsRun = i + 1;
    }
  }
  return { profile, meta, winFlags, metaPerRun, scorePerRun, rankRun, firstUnlockRun, allTargetRelicsRun };
}

const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const pct = (flags) => flags.length ? (100 * flags.filter(Boolean).length / flags.length) : 0;

function cell(persona, withMeta) {
  const careers = Array.from({ length: CAREERS }, (_, c) => runCareer({ persona, withMeta, careerSeed: SEED0 + c }));
  const early = (cr) => cr.winFlags.slice(0, 5);
  const late = (cr) => cr.winFlags.slice(-5);
  const rankRunAvg = (k) => {
    const vals = careers.map(c => c.rankRun[k]).filter(v => v != null);
    return vals.length ? mean(vals).toFixed(0) : '—';
  };
  return {
    winAll: mean(careers.map(c => pct(c.winFlags))),
    winEarly: mean(careers.map(c => pct(early(c)))),
    winLate: mean(careers.map(c => pct(late(c)))),
    metaPerRun: mean(careers.flatMap(c => c.metaPerRun)),
    scorePerRun: mean(careers.flatMap(c => c.scorePerRun)),
    achDone: mean(careers.map(c => c.profile.completed.length)),
    rank: { 1: rankRunAvg(1), 2: rankRunAvg(2), 3: rankRunAvg(3), 4: rankRunAvg(4) },
    firstUnlock: withMeta ? mean(careers.map(c => c.firstUnlockRun).filter(v => v != null)).toFixed(1) : 'n/a',
    allRelics: withMeta ? (() => { const v = careers.map(c => c.allTargetRelicsRun).filter(x => x != null); return v.length ? mean(v).toFixed(0) : '>' + RUNS; })() : 'n/a',
  };
}

console.log(`\nLetter Ride — Meta-economy career harness (${CAREERS} careers x ${RUNS} runs per cell; greedy line)\n`);
console.log(`Dimension: "with" = unlock-gated career (pool grows); "without" = full pool from run 1.`);
console.log(`Rank cols = mean run# first reaching ${RANKS[1]}/${RANKS[2]}/${RANKS[3]}/${RANKS[4]} (lifetime Score). Catalog = ${CATALOG_N} achievements.\n`);
console.log('| Persona | meta | win% all | win% early(1-5) | win% late(last5) | Meta/run | Score/run | ach done | →' + RANKS[1] + ' | →' + RANKS[2] + ' | →' + RANKS[3] + ' | →' + RANKS[4] + ' | 1st unlock | all-target-relics |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const persona of PERSONAS) {
  for (const withMeta of [true, false]) {
    const r = cell(persona, withMeta);
    console.log(`| ${persona.name} | ${withMeta ? 'with' : 'without'} | ${r.winAll.toFixed(0)}% | ${r.winEarly.toFixed(0)}% | ${r.winLate.toFixed(0)}% | ${r.metaPerRun.toFixed(1)} | ${r.scorePerRun.toFixed(0)} | ${r.achDone.toFixed(0)}/${CATALOG_N} | ${r.rank[1]} | ${r.rank[2]} | ${r.rank[3]} | ${r.rank[4]} | ${r.firstUnlock} | ${r.allRelics} |`);
  }
}
console.log('\nReads: with-vs-without win% gap = how much unlock-gating suppresses early play (the "leash").');
console.log('Score/run x runs = lifetime-Score accrual → sanity-check LEVELS thresholds. Meta/run vs unlock costs → faucet pacing.');
console.log('Limits: Stake 0 only (no stake-climb, so stake-1/2 bounties + locked decks are NOT exercised); greedy line is a FLOOR (a human earns faster); auto-collects rewards. REPORTS only — no tuning applied.\n');
