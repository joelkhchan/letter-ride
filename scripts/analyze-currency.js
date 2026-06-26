// scripts/analyze-currency.js — CURRENCY economy harness (read-only). Two sections:
//   A) In-run $ : per persona (greedy + target-buy shop), coins earned by source, spent, rerolls,
//      leftover, purchases — split ALL / WON / LOST to test whether coin scarcity feeds the
//      engine-vs-flat bimodality (do losers simply have fewer coins to build an engine?).
//   B) Meta    : per-run Meta by SOURCE (drip / achievements / bounties) over a career, plus the
//      full-collection unlock cost vs the measured faucet → runs-to-unlock-everything.
// Mirrors main.js/analyze-meta orchestration. Asserts nothing; prints tables. Flags: --n --careers --runs
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { makeDictionary } from '../src/dictionary.js';
import { bestPlay, buildPurchasePolicy, smartDiscard, PERSONAS } from '../src/sim.js';
import { newRun, playWord, discard, nextRound } from '../src/run.js';
import { makeMetaState, poolFromMeta, metaEarned, metaShopOffers, purchaseMeta } from '../src/meta.js';
import { checkAchievements, grantBounties, collectAchievement, collectBounty } from '../src/achievements.js';
import { makeProfile, recordPlay as profileRecordPlay, recordRunEnd as profileRecordRunEnd, levelFor } from '../src/profile.js';
import { ALL_RELIC_IDS } from '../src/relics.js';
import { ALL_MOD_IDS } from '../src/tiles.js';

const argNum = (name, def) => { const i = process.argv.indexOf(name); return i >= 0 ? Number(process.argv[i + 1]) : def; };
const N = argNum('--n', 120);
const CAREERS = argNum('--careers', 3);
const RUNS = argNum('--runs', 25);

const raw = readFileSync(new URL('../assets/enable1.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const dictionary = makeDictionary(raw);
const words = raw.filter(w => w.length >= CONFIG.MIN_WORD_LEN && w.length <= CONFIG.RACK_SIZE).map(w => w.toUpperCase());
const TARGETS = CONFIG.ROUND_TARGETS;

function resolveDeck(persona) {
  if (persona.bagId === 'standard') return { id: 'standard', startingBag: CONFIG.STARTING_BAG };
  const d = CONFIG.DECKS[persona.bagId];
  return { id: d.id, startingBag: d.startingBag };
}

// Cost of a purchaseLog entry (purchase() pushes 'relic:X' | 'hone:X' | offer.type).
const COST = CONFIG.SHOP.cost;
function purchaseCost(entry) {
  if (entry.startsWith('relic:')) return COST.buyRelic;
  if (entry.startsWith('hone:')) return CONFIG.HONE.cost;
  return COST[entry] ?? 0;
}
// Normalize an awardCoins line label into a stable bucket.
function earnBucket(label) {
  if (label === 'Round clear') return 'clear';
  if (label === 'Interest') return 'interest';
  if (/unused play/.test(label)) return 'unusedPlays';
  if (/unused discard/.test(label)) return 'unusedDiscards';
  return 'relic';   // recycler / any coin-on-clear relic
}

const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

// ── Section A: in-run $ ───────────────────────────────────────────────────────
function runEconomy(persona, seed) {
  const deck = resolveDeck(persona);
  const policy = buildPurchasePolicy({
    targetRelicIds: persona.targetRelicIds, targetHoneId: persona.targetHoneId,
    targetModIds: persona.targetModIds, reserve: 0, maxRerolls: 3, pool: {},
  });
  const run = newRun({ config: CONFIG, dictionary, seed, deck });
  run.purchaseLog = [];
  const earn = { clear: 0, unusedPlays: 0, unusedDiscards: 0, interest: 0, relic: 0 };
  let spend = 0, iter = 0;
  while (run.status === 'playing' && iter < 1000) {
    iter++;
    const play = bestPlay(run, words);
    if (play) playWord(run, play.selection);
    else if (run.discardsLeft > 0 && run.rack.length > 0) discard(run, smartDiscard(run));
    else break;
    if (run.status === 'roundCleared') {
      for (const item of run.lastAward || []) earn[earnBucket(item.label)] += item.amount;
      const before = run.coins;
      policy(run);
      spend += before - run.coins;
      nextRound(run);
    }
  }
  if (run.status === 'playing') run.status = 'lost';
  const purchases = run.purchaseLog.length;
  const purchSpend = run.purchaseLog.reduce((s, e) => s + purchaseCost(e), 0);
  const earnTotal = Object.values(earn).reduce((a, b) => a + b, 0);
  return {
    won: run.status === 'won', roundsCleared: run.status === 'won' ? TARGETS.length : run.roundIndex,
    earn, earnTotal, spend, rerollSpend: Math.max(0, spend - purchSpend), purchases,
    leftover: run.coins, relics: run.relics.length,
  };
}

function summarizeEcon(rows) {
  return {
    n: rows.length,
    earnTotal: mean(rows.map(r => r.earnTotal)),
    earnPerRound: mean(rows.map(r => r.earnTotal / Math.max(1, r.roundsCleared))),
    clear: mean(rows.map(r => r.earn.clear)),
    unusedPlays: mean(rows.map(r => r.earn.unusedPlays)),
    unusedDiscards: mean(rows.map(r => r.earn.unusedDiscards)),
    interest: mean(rows.map(r => r.earn.interest)),
    spend: mean(rows.map(r => r.spend)),
    rerollSpend: mean(rows.map(r => r.rerollSpend)),
    purchases: mean(rows.map(r => r.purchases)),
    relics: mean(rows.map(r => r.relics)),
    leftover: mean(rows.map(r => r.leftover)),
    roundsCleared: mean(rows.map(r => r.roundsCleared)),
  };
}

console.log(`\n=== Letter Ride — CURRENCY economy ===`);
console.log(`Config: COINS_ON_CLEAR ${JSON.stringify(CONFIG.COINS_ON_CLEAR)} | INTEREST ${JSON.stringify(CONFIG.INTEREST)} | relic $${COST.buyRelic}, enchTile $${COST.buyEnchantedTile}, enchant $${COST.enchantTile}, upgrade $${COST.upgradeLetter}, reroll $${CONFIG.SHOP.rerollCost}`);
console.log(`\n── A. In-run $ economy (greedy + target-buy, ${N} seeds/persona) ──`);
console.log(`Per run: $ earned (by source), spent, rerolls, leftover, #buys. Split ALL / WON / LOST.`);
console.log(`| Persona | grp | $/run | $/round | clear | plays | disc | int | spent | reroll$ | buys | relics | leftover |`);
console.log(`|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
const seeds = Array.from({ length: N }, (_, i) => i + 1);
for (const persona of PERSONAS) {
  const rows = seeds.map(s => runEconomy(persona, s));
  const groups = [['all', rows], ['won', rows.filter(r => r.won)], ['lost', rows.filter(r => !r.won)]];
  for (const [grp, rs] of groups) {
    if (!rs.length) { console.log(`| ${persona.name} | ${grp} | (none) |`); continue; }
    const s = summarizeEcon(rs);
    console.log(`| ${persona.name} | ${grp} | ${s.earnTotal.toFixed(0)} | ${s.earnPerRound.toFixed(1)} | ${s.clear.toFixed(0)} | ${s.unusedPlays.toFixed(0)} | ${s.unusedDiscards.toFixed(0)} | ${s.interest.toFixed(0)} | ${s.spend.toFixed(0)} | ${s.rerollSpend.toFixed(1)} | ${s.purchases.toFixed(1)} | ${s.relics.toFixed(1)} | ${s.leftover.toFixed(0)} |`);
  }
}
console.log(`\nRead: if WON rows have much higher $/run + #buys + relics than LOST, coin access (not just draw luck) gates the engine → the $ faucet is part of the bimodality. High leftover = coins outpace useful buys (faucet too loose or shop too thin).`);

// ── Section B: Meta sources + full-collection timeline ─────────────────────────
function playRunMeta({ seed, persona, pool, profile }) {
  const deck = resolveDeck(persona);
  const policy = buildPurchasePolicy({ targetRelicIds: persona.targetRelicIds, targetHoneId: persona.targetHoneId, targetModIds: persona.targetModIds, reserve: 0, maxRerolls: 3, pool });
  const run = newRun({ config: CONFIG, dictionary, seed, deck });
  const newly = [];
  const mark = (list) => { for (const a of list) if (!profile.completed.includes(a.id)) { profile.completed.push(a.id); newly.push(a.id); } };
  let iter = 0;
  while (run.status === 'playing' && iter < 1000) {
    iter++;
    const play = bestPlay(run, words);
    if (play) {
      const before = run.roundTotal; playWord(run, play.selection);
      const word = play.selection.map(s => s.letter).join('').toUpperCase();
      profileRecordPlay(profile, { word, score: run.roundTotal - before });
      mark(checkAchievements(profile, { phase: 'play', letters: play.selection.map(s => s.letter.toUpperCase()), word, score: run.roundTotal - before, wordsPlayedThisRound: run.wordsPlayedThisRound, status: run.status, playsLeft: run.playsLeft, prevRoundTotal: before, target: run.target, roundTotal: run.roundTotal, roundIndex: run.roundIndex }, CONFIG));
    } else if (run.discardsLeft > 0 && run.rack.length > 0) discard(run, smartDiscard(run));
    else break;
    if (run.status === 'roundCleared') { policy(run); nextRound(run); }
  }
  if (run.status === 'playing') run.status = 'lost';
  const won = run.status === 'won';
  const relicIds = run.relics.map(r => r.id);
  const modIds = [...new Set(run.bag.tiles.flatMap(t => t.mods.map(m => m.id)))];
  profileRecordRunEnd(profile, { won, roundsCleared: won ? TARGETS.length : run.roundIndex, runScore: run.roundTotal, relicIds, modIds });
  mark(checkAchievements(profile, { phase: 'end', won, roundIndex: run.roundIndex, boughtAnythingThisRun: !!run.boughtAnythingThisRun, discardedThisRun: !!run.discardedThisRun, totalWordsThisRun: run.totalWordsThisRun || 0, flawlessSoFar: run.flawlessSoFar !== false, archetypeTally: run.archetypeTally || {}, relicsCount: relicIds.length, modsCount: modIds.length, stakeId: run.stake?.id ?? 0, allRelicIds: ALL_RELIC_IDS, allModIds: ALL_MOD_IDS }, CONFIG));
  const bountyKeys = won ? grantBounties(profile, run.stake?.id ?? 0, run.deck?.id ?? null) : [];
  return { won, roundsCleared: won ? TARGETS.length : run.roundIndex, newly, bountyKeys };
}

// Spend-everything policy (cheapest-first) to measure full-collection unlock speed.
function spendAll(meta) {
  let bought = 0, progress = true;
  while (progress) {
    progress = false;
    const offers = metaShopOffers(meta, CONFIG, ALL_RELIC_IDS, ALL_MOD_IDS).filter(o => o.cost <= meta.meta).sort((a, b) => a.cost - b.cost);
    if (offers.length && purchaseMeta(meta, offers[0], CONFIG).ok) { bought++; progress = true; }
  }
  return bought;
}

function fullCollectionCost() {
  const c = CONFIG.META.unlockCost, b = CONFIG.META.baseUnlocked;
  const relics = (ALL_RELIC_IDS.length - b.relics.length) * c.relic;
  const mods = (ALL_MOD_IDS.length - b.mods.length) * c.mod;
  const decks = (Object.keys(CONFIG.DECKS).length - b.decks.length) * c.deck;
  const stakes = (CONFIG.STAKES.length - b.stakes.length) * c.stake;
  const loadout = Object.keys(CONFIG.LOADOUT).reduce((s, k) => s + CONFIG.LOADOUT[k].max * CONFIG.LOADOUT[k].cost, 0);
  return { relics, mods, decks, stakes, loadout, total: relics + mods + decks + stakes + loadout };
}

console.log(`\n── B. Meta economy (${CAREERS} careers x ${RUNS} runs/persona; greedy floor; spend-everything) ──`);
console.log(`earn: perRoundCleared ${CONFIG.META.earn.perRoundCleared}, winBonus ${CONFIG.META.earn.winBonus} | unlockCost ${JSON.stringify(CONFIG.META.unlockCost)}`);
const fc = fullCollectionCost();
console.log(`Full-collection unlock cost: relics ${fc.relics} + mods ${fc.mods} + decks ${fc.decks} + stakes ${fc.stakes} + loadout ${fc.loadout} = ${fc.total} Meta`);
console.log(`| Persona | Meta/run | drip | ach | bounty | early(1-5)/run | late(last5)/run | runs-to-full |`);
console.log(`|---|---|---|---|---|---|---|---|`);
for (const persona of PERSONAS) {
  const careerRows = Array.from({ length: CAREERS }, (_, c) => {
    const profile = makeProfile(); const meta = makeMetaState(CONFIG);
    const perRun = [], dripA = [], achA = [], bountyA = [];
    let fullRun = null;
    for (let i = 0; i < RUNS; i++) {
      const r = playRunMeta({ seed: (c + 1) * 100003 + i * 7 + 1, persona, pool: poolFromMeta(meta), profile });
      const drip = metaEarned({ status: r.won ? 'won' : 'lost', roundIndex: r.roundsCleared, targets: TARGETS }, CONFIG);
      let ach = 0, bounty = 0;
      for (const id of r.newly) ach += collectAchievement(profile, id, CONFIG);
      for (const k of r.bountyKeys) bounty += collectBounty(profile, k, CONFIG);
      meta.meta += drip + ach + bounty;
      perRun.push(drip + ach + bounty); dripA.push(drip); achA.push(ach); bountyA.push(bounty);
      spendAll(meta);
      const fullyUnlocked = meta.unlockedRelics.length === ALL_RELIC_IDS.length && meta.unlockedMods.length === ALL_MOD_IDS.length
        && meta.unlockedDecks.length === Object.keys(CONFIG.DECKS).length && meta.unlockedStakes.length === CONFIG.STAKES.length;
      if (fullRun == null && fullyUnlocked) fullRun = i + 1;
    }
    return { perRun, dripA, achA, bountyA, fullRun };
  });
  const all = (sel) => mean(careerRows.flatMap(sel));
  const fulls = careerRows.map(c => c.fullRun).filter(v => v != null);
  console.log(`| ${persona.name} | ${all(c => c.perRun).toFixed(1)} | ${all(c => c.dripA).toFixed(1)} | ${all(c => c.achA).toFixed(1)} | ${all(c => c.bountyA).toFixed(1)} | ${mean(careerRows.flatMap(c => c.perRun.slice(0, 5))).toFixed(1)} | ${mean(careerRows.flatMap(c => c.perRun.slice(-5))).toFixed(1)} | ${fulls.length ? mean(fulls).toFixed(0) : '>' + RUNS} |`);
}
console.log(`\nRead: 'ach' should be front-loaded (one-time) then drip-dominated. 'runs-to-full' = how long the full collection takes at this faucet (Stake 0 only; bounties/decks/stakes only partly exercised). REPORTS only — no tuning applied.\n`);
