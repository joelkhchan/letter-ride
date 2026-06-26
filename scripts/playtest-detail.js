// scripts/playtest-detail.js — DETAILED per-run play-test logger (read-only, no tuning).
// Drives full runs with a chosen agent (greedy | lookahead) + each archetype's target-buy shop
// policy, and records a granular narrative the aggregate harnesses don't: every word played
// (word, score, length, running total vs target), every discard, exactly where each run died
// (encounter, boss, shortfall, reason), the relics/hones/mods it ended with, the purchases it
// made, and which achievements fired. Mirrors main.js run-end orchestration (same achievement ctx
// as analyze-meta.js) so the achievement/Meta reads are faithful.
//
// Flags:
//   --persona=<id|all>   which archetype(s) (default all). ids: shortWord longWord rareLetter doubled vowelHeavy escalation
//   --agent=<greedy|lookahead>   play policy (default lookahead — the skilled line)
//   --k=<n> --branch=<n>         lookahead depth/branch (default k=2 branch=4; cheap iterate setting)
//   --n=<n>              aggregate seeds per persona (default 60)
//   --detail=<n>         full narratives to print per persona (default 2)
//   --seed0=<n>          first seed (default 1)
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { makeDictionary } from '../src/dictionary.js';
import { PERSONAS, buildPurchasePolicy, smartDiscard, bestPlay, pickEnchantTarget } from '../src/sim.js';
import { greedyAgent, lookaheadAgent } from '../src/agents.js';
import { newRun, playWord, discard, nextRound, passageOf, tierOf, isBossRound } from '../src/run.js';
import { BOSSES } from '../src/bosses.js';
import { checkAchievements, ACHIEVEMENTS } from '../src/achievements.js';
import { makeProfile, recordPlay as profileRecordPlay, recordRunEnd as profileRecordRunEnd } from '../src/profile.js';
import { ALL_RELIC_IDS } from '../src/relics.js';
import { ALL_MOD_IDS } from '../src/tiles.js';

const arg = (name, def) => { const a = process.argv.find(x => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : def; };
const argNum = (name, def) => { const v = arg(name, null); return v == null ? def : Number(v); };

const PERSONA_SEL = arg('persona', 'all');
const AGENT = arg('agent', 'lookahead');
const K = argNum('k', 2), BRANCH = argNum('branch', 4);
const N = argNum('n', 60);
const DETAIL = argNum('detail', 2);
const SEED0 = argNum('seed0', 1);

const raw = readFileSync(new URL('../assets/enable1.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const dictionary = makeDictionary(raw);
const words = raw.filter(w => w.length >= CONFIG.MIN_WORD_LEN && w.length <= CONFIG.RACK_SIZE).map(w => w.toUpperCase());
const TARGETS = CONFIG.ROUND_TARGETS;

function resolveDeck(persona) {
  if (persona.bagId === 'standard') return { id: 'standard', startingBag: CONFIG.STARTING_BAG };
  const d = CONFIG.DECKS[persona.bagId];
  return { id: d.id, startingBag: d.startingBag };
}

function agentFor(policy) {
  return AGENT === 'greedy' ? greedyAgent(policy) : lookaheadAgent(policy, { k: K, branch: BRANCH });
}

function encounterLabel(roundIndex, boss) {
  const p = passageOf(roundIndex), t = tierOf(roundIndex);
  const b = boss ? ` [BOSS: ${BOSSES[boss].name}]` : '';
  return `P${p}.${t} (enc ${roundIndex + 1}/${TARGETS.length})${b}`;
}

// One full run with detailed tracing. Mirrors analyze-meta.js playRun's orchestration + achievement ctx.
function playRunDetailed({ seed, persona, profile }) {
  const deck = resolveDeck(persona);
  const policy = buildPurchasePolicy({
    targetRelicIds: persona.targetRelicIds, targetHoneId: persona.targetHoneId,
    targetModIds: persona.targetModIds, reserve: 0, maxRerolls: 3, pool: {},
  });
  const agent = agentFor(policy);
  const run = newRun({ config: CONFIG, dictionary, seed, deck });
  run.purchaseLog = [];   // opt in to purchase logging (shop.purchase pushes only if this exists)

  const newlyCompleted = [];
  const mark = (list) => { for (const a of list) if (!profile.completed.includes(a.id)) { profile.completed.push(a.id); newlyCompleted.push(a.id); } };

  // Trace: one entry per encounter.
  const encounters = [];
  let cur = { idx: run.roundIndex, label: encounterLabel(run.roundIndex, run.boss), target: run.target, boss: run.boss, plays: [], discards: 0, cleared: false, endTotal: 0 };
  const allWords = [];   // {word, score, len, boss}
  let iter = 0;
  let deathReason = null;

  while (run.status === 'playing' && iter < 1000) {
    iter++;
    const play = agent.choosePlay(run, words);
    if (play) {
      const before = run.roundTotal;
      const r = playWord(run, play.selection);
      const gained = run.roundTotal - before;
      const word = play.selection.map(s => s.letter).join('').toUpperCase();
      cur.plays.push({ word, score: gained, len: word.length, total: run.roundTotal });
      allWords.push({ word, score: gained, len: word.length, boss: cur.boss });
      profileRecordPlay(profile, { word, score: gained });
      mark(checkAchievements(profile, {
        phase: 'play', letters: play.selection.map(s => s.letter.toUpperCase()), word,
        score: gained, wordsPlayedThisRound: run.wordsPlayedThisRound, status: run.status,
        playsLeft: run.playsLeft, prevRoundTotal: before, target: run.target,
        roundTotal: run.roundTotal, roundIndex: run.roundIndex,
      }, CONFIG));
    } else if (run.discardsLeft > 0 && run.rack.length > 0) {
      cur.discards++;
      discard(run, smartDiscard(run));
    } else {
      // Stuck: no playable word and no discard left → loss on this encounter.
      deathReason = run.rack.length === 0 ? 'empty-rack' : 'dead-hand (no word, no discard)';
      break;
    }
    if (run.status === 'lost') {
      deathReason = deathReason || (run.playsLeft <= 0 ? 'out-of-plays (short of target)' : 'dead-hand');
    }
    if (run.status === 'roundCleared') {
      cur.cleared = true; cur.endTotal = run.roundTotal;
      encounters.push(cur);
      policy(run);
      nextRound(run);
      if (run.status === 'playing') {
        cur = { idx: run.roundIndex, label: encounterLabel(run.roundIndex, run.boss), target: run.target, boss: run.boss, plays: [], discards: 0, cleared: false, endTotal: 0 };
      }
    }
  }
  if (run.status === 'playing') run.status = 'lost';
  if (!cur.cleared && run.status !== 'won') { cur.endTotal = run.roundTotal; encounters.push(cur); }

  const won = run.status === 'won';
  const deathEncounter = won ? null : run.roundIndex;
  const shortfall = won ? 0 : (run.target - run.roundTotal);
  const relicIds = run.relics.map(r => r.id);
  const honeLevels = { ...run.honeLevels };
  const modCounts = {};
  for (const t of run.bag.tiles) for (const m of t.mods) modCounts[m.id] = (modCounts[m.id] || 0) + 1;
  const modIds = Object.keys(modCounts);

  profileRecordRunEnd(profile, { won, roundsCleared: won ? TARGETS.length : run.roundIndex, runScore: run.roundTotal, relicIds, modIds });
  mark(checkAchievements(profile, {
    phase: 'end', won, roundIndex: run.roundIndex,
    boughtAnythingThisRun: !!run.boughtAnythingThisRun, discardedThisRun: !!run.discardedThisRun,
    totalWordsThisRun: run.totalWordsThisRun || 0, flawlessSoFar: run.flawlessSoFar !== false,
    archetypeTally: run.archetypeTally || {}, relicsCount: relicIds.length, modsCount: modIds.length,
    stakeId: run.stake?.id ?? 0, allRelicIds: ALL_RELIC_IDS, allModIds: ALL_MOD_IDS,
  }, CONFIG));

  return {
    seed, won, deathEncounter, deathReason, shortfall,
    roundsCleared: won ? TARGETS.length : run.roundIndex,
    encounters, allWords, relicIds, honeLevels, modCounts, modIds,
    purchaseLog: run.purchaseLog || [], totalWords: run.totalWordsThisRun || 0,
    finalStacks: Object.values(run.relicState || {}).reduce((a, s) => a + (s.stacks || 0), 0),
    newlyCompleted,
  };
}

function pct(n, d) { return d ? (100 * n / d).toFixed(0) + '%' : '—'; }

function printNarrative(res, persona) {
  console.log(`\n  ── seed ${res.seed} — ${res.won ? 'WON ✓' : `LOST ✗ at ${encounterLabel(res.deathEncounter, res.encounters[res.encounters.length-1]?.boss)}`} ──`);
  for (const e of res.encounters) {
    const status = e.cleared ? `cleared (${e.endTotal}/${e.target})` : `FAILED (${e.endTotal}/${e.target}, short ${e.target - e.endTotal})`;
    const playStr = e.plays.map(p => `${p.word}(${p.score})`).join(' ');
    const dsc = e.discards ? ` +${e.discards}d` : '';
    console.log(`     ${e.label.padEnd(34)} ${status.padEnd(26)} ${playStr}${dsc}`);
  }
  if (!res.won) console.log(`     death: ${res.deathReason}`);
  const hones = Object.entries(res.honeLevels).map(([k, v]) => `${k} L${v}`).join(', ') || 'none';
  const mods = Object.entries(res.modCounts).map(([k, v]) => `${k}x${v}`).join(', ') || 'none';
  console.log(`     relics: ${res.relicIds.join(', ') || 'none'}`);
  console.log(`     hones: ${hones}   mods: ${mods}   snowball stacks: ${res.finalStacks}`);
  console.log(`     purchases (${res.purchaseLog.length}): ${res.purchaseLog.join(', ') || 'none'}`);
}

const personasToRun = PERSONA_SEL === 'all' ? PERSONAS : PERSONAS.filter(p => p.id === PERSONA_SEL);

console.log(`\n=== Letter Ride — DETAILED play-test log ===`);
console.log(`agent=${AGENT}${AGENT === 'lookahead' ? ` (k=${K} branch=${BRANCH})` : ''}  seeds=${N} (from ${SEED0})  narratives=${DETAIL}/persona`);
console.log(`Run = ${TARGETS.length} encounters, targets ${TARGETS.join('/')}. Bosses on every Sentence (enc 3,6,9,12).\n`);

for (const persona of personasToRun) {
  const seeds = Array.from({ length: N }, (_, i) => SEED0 + i);
  const profile = makeProfile();   // fresh career-less profile; accumulates discovery achievements across seeds
  const results = seeds.map(seed => playRunDetailed({ seed, persona, profile }));

  const wins = results.filter(r => r.won).length;
  // Death histogram by encounter index.
  const deathHist = {};
  for (const r of results) if (!r.won) deathHist[r.deathEncounter] = (deathHist[r.deathEncounter] || 0) + 1;
  // Boss-encounter failure: did the run die ON a boss encounter (enc idx 2,5,8,11)?
  const bossDeaths = results.filter(r => !r.won && isBossRound(r.deathEncounter)).length;
  // Word frequency + the words on FAILED final encounters ("messed up on").
  const wordFreq = {};
  for (const r of results) for (const w of r.allWords) wordFreq[w.word] = (wordFreq[w.word] || 0) + 1;
  const topWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const failWords = {};
  for (const r of results) if (!r.won) { const last = r.encounters[r.encounters.length - 1]; for (const p of (last?.plays || [])) failWords[p.word] = (failWords[p.word] || 0) + 1; }
  const topFailWords = Object.entries(failWords).sort((a, b) => b[1] - a[1]).slice(0, 10);
  // Relic acquisition frequency, hone reach, avg total words, avg shortfall at death.
  const relicFreq = {};
  for (const r of results) for (const id of r.relicIds) relicFreq[id] = (relicFreq[id] || 0) + 1;
  const honeReach = {};
  for (const r of results) for (const [id, lv] of Object.entries(r.honeLevels)) honeReach[id] = Math.max(honeReach[id] || 0, lv);
  const avgWords = (results.reduce((a, r) => a + r.totalWords, 0) / N).toFixed(1);
  const losers = results.filter(r => !r.won);
  const avgShortfall = losers.length ? (losers.reduce((a, r) => a + r.shortfall, 0) / losers.length).toFixed(0) : '—';
  const avgReached = (results.reduce((a, r) => a + r.roundsCleared, 0) / N).toFixed(1);
  const avgStacks = (results.reduce((a, r) => a + r.finalStacks, 0) / N).toFixed(0);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`### ${persona.name}  (deck ${persona.bagId}, targets relics ${persona.targetRelicIds.join('/')}, hone ${persona.targetHoneId})`);
  console.log(`win-rate ${pct(wins, N)} (${wins}/${N})   avg encounters cleared ${avgReached}/${TARGETS.length}   avg words/run ${avgWords}   avg snowball stacks ${avgStacks}`);
  console.log(`deaths on boss encounters: ${bossDeaths}/${losers.length} losses   avg shortfall at death: ${avgShortfall} pts`);
  const dh = Object.entries(deathHist).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => `${encounterLabel(Number(k)).split(' ')[0]}:${v}`).join('  ');
  console.log(`death histogram (by encounter): ${dh || '— (all won)'}`);
  console.log(`relic acquisition: ${Object.entries(relicFreq).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `${k}(${v})`).join(', ') || 'none'}`);
  console.log(`hone reach (max L): ${Object.entries(honeReach).map(([k,v]) => `${k} L${v}`).join(', ') || 'none'}`);
  console.log(`top words: ${topWords.map(([w, n]) => `${w}(${n})`).join(' ')}`);
  console.log(`words on failed final encounters: ${topFailWords.map(([w, n]) => `${w}(${n})`).join(' ') || '—'}`);
  console.log(`achievements fired across ${N} runs: ${profile.completed.length}/${ACHIEVEMENTS.length} → ${profile.completed.join(', ') || 'none'}`);

  for (let i = 0; i < Math.min(DETAIL, results.length); i++) printNarrative(results[i], persona);
}
console.log('\n(REPORTS ONLY — no config changed. Greedy is a floor; lookahead is the skilled-line proxy.)\n');
