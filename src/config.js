export const CONFIG = {
  STARTING_BAG: [                                          // 52-tile bag (2026-07-01): proportional 2x of the 06-29 26-tile mix. The 06-29 shrink fixed COMPOSITION (variety/rares diluted synergies); this fixes DEPTH - the round's tile budget IS the bag (nothing recycles mid-round), so 26 starved late-round hands (median best word ~6.8 letters). Doubling proportionally keeps the vowel:consonant ratio + letter set identical; the one real change is duplicate-consonant racks become possible (mild diversity down, mild doubled-synergy up; still ~0% dead racks per analyze:corpus). No rares in Standard (rares live in Rare Cache).
    'A','A','A','A','A','A','E','E','E','E','E','E','I','I','I','I','O','O','O','O','U','U',       // 22 vowels (~42%)
    'R','R','S','S','T','T','L','L','N','N','D','D','C','C','M','M','B','B','P','P','G','G','H','H','F','F','Y','Y','K','K'  // 30 consonants (2x commons + mid K/F/Y; NO J/Q/X/Z)
  ],
  TILE_VALUES: {                                           // base points per letter; WILD '*' = 0
    A:1,E:1,I:1,O:1,U:1,L:1,N:1,S:1,T:1,R:1,
    D:2,G:2, B:3,C:3,M:3,P:3, F:4,H:4,V:4,W:4,Y:4, K:5, J:8,X:8, Q:10,Z:10, '*':0
  },
  RACK_SIZE: 9,
  HAND_FLOOR: 6,        // effective hand size never drops below this - the -hand stack cap (tunable)
  PLAYS_PER_ROUND: 4,
  DISCARDS_PER_ROUND: 2,
  MIN_WORD_LEN: 2,                                        // 2-letter words allowed (2026-06-30); the dictionary's 2-letter set = the NWL2023 Scrabble-legal 107 (assets/two-letter-words.txt), so every 2-letter play is valid
  LENGTH_BONUS_PER_LETTER: 5,                              // +5 × (len - 3), min 0
  TIER0_TARGETS: [20, 35, 55, 80, 110, 145, 185, 230],     // beatable from base bag, no shop
  PASSAGES: 4,                                             // run = PASSAGES x (Word, Phrase, Sentence)
  // Tuned 2026-06-24 via the harness curve-sweep: ~1.22x/encounter, front-loaded. The full-toolkit
  // bot (enchants + retrigger + chain + upgrades) wins ~16% here; a smarter human clears around the
  // median ("skill beats luck"). Bosses provide the Sentence difficulty spikes, so targets stay
  // smooth (not inflated on Sentences). FLOOR-tuned starting point — refine via author playtest.
  ROUND_TARGETS: [
    40,  50,  70,      // Passage 1: Word, Phrase, Sentence(boss)
    100, 140, 190,     // Passage 2
    250, 320, 400,     // Passage 3
    490, 590, 700,     // Passage 4 (author-set 2026-06-27: steep round-number curve + strong engines = high-ceiling)
  ],
  // Endless mode (continue past the win): each round's target compounds off the previous by an
  // escalating factor f_n = startFactor + factorStep·(n−1)·n/2 → 1.25, 1.5, 2, 2.75, 3.75… rounded
  // to roundTo. Author-set 2026-06-30. TUNE for how fast the wall arrives.
  ENDLESS: { startFactor: 1.25, factorStep: 0.25, roundTo: 10 },
  // "The Proof" — Wordle-style event. Guess a hidden common word; reward $ (scales with speed) OR a
  // relic on solve. coins = coinsBase + coinsPerGuessSaved × (maxGuesses − guessesUsed). TUNE.
  WORDLE: { length: 5, maxGuesses: 6, coinsBase: 3, coinsPerGuessSaved: 3 },
  COINS_ON_CLEAR: { base: 4, perUnusedPlay: 1, perUnusedDiscard: 1 }, // Tier 1
  INTEREST: { enabled: true, per: 5, rate: 1, cap: 12 },            // $1 per $5 held, max $12 (raised 2026-06-29: rewards saving toward a keystone relic; soft ceiling now at $60 held)
  SHOP: {
    offersPerShop: 4,
    rerollCost: 2,                                   // reroll keeps a cost (author reverted free reroll 2026-06-29: free reroll removed shop tension). Acquisition reliability to be revisited (pity may return) if playtest shows it's too luck-gated.
    cost: { buyLetter: 3, buyEnchantedTile: 7, enchantTile: 6, enchantMulti: 10, upgradeLetter: 5, thinLetter: 3, buyRelic: 8, recastTile: 5, transferMods: 5 },
    upgradePlus: 3,                                  // +points per upgradeLetter purchase (was 1; +1 was dead weight vs xMult). TUNE.
    imprintCount: 2,                                 // "imprint" = spread one mod onto this many chosen tiles at once (enchantMulti). TUNE (2 vs 3).
    buyableLetters: ['E','A','R','T','S','N','L','D','G','C','K','J','Q','X','Z'],  // shop letter pool
  },
  META: {
    earn: { perRoundCleared: 2, winBonus: 10 },
    baseUnlocked: {
      relics: ['vowelBonus','shortAndSweet','lengthy','freshStart','comboCounter','recycler','wideMargins','tightLeading','suffixPress','ligature','royaltyPress','galleyProof'],
      mods: ['resonator','polished','catalyst','anchor','gilded'],
      decks: ['standard','classic','rareRich','doubled','lean'],   // Mystery + Staccato/Suffix/Monolith are ink-unlocks (not base): any DECKS entry not listed here is auto-offered in the meta-shop for META.unlockCost.deck
      stakes: [0],
    },
    unlockCost: { relic: 25, mod: 20, deck: 35, stake: 15 },   // TUNE: raised to absorb the larger faucet
    achievement: {
      reward: { onboarding: 3, mastery: 12, diversity: 8, discovery: 5, progression: 10 },  // TUNE: Meta by bucket
      rewardOverride: { winStake2: 25, criticsPick: 20, reachApprentice: 5, reachJourneyman: 10, reachExpert: 15, reachArtisan: 25 },  // TUNE
      bigWordScore: 150,    // TUNE
      bigRoundScore: 400,   // TUNE
      efficientWords: 20,   // TUNE: win in <= N total words (12 rounds, so <=20 ≈ 1.6 words/round)
      manyMods: 4,          // TUNE
      manyRelics: 4,        // TUNE
      discoverRelics: 12,   // TUNE: Curator - use N different relics across runs (keep the desc in sync)
      discoverMods: 6,      // TUNE: Enchanter - apply N different tile-mods across runs (keep the desc in sync)
      tidySumCoins: 30,     // TUNE: Tidy Sum - hold $N at once (keep the desc in sync)
      runOnChain: 4,        // TUNE: Run-on - reach a word-chain of N (keep the desc in sync)
      deepCutLevel: 3,      // TUNE: Deep Cut - Refine one build to Level N (keep the desc in sync)
    },
    bounty: { 0: 5, 1: 10, 2: 20 },   // TUNE: one-time per (stake,deck) cell, by stake tier
  },
  LEVELS: {
    names: ['Novice', 'Apprentice', 'Journeyman', 'Expert', 'Artisan'],   // TUNE names (branding owns final)
    thresholds: [0, 4000, 12000, 28000, 60000],                           // TUNE: cumulative lifetime Score per tier (raised from 3k/9k/20k/40k per analyze:meta; ~Apprentice 3 / Journeyman 9 / Expert 21 / Artisan 46 runs for a competent line)
  },
  // Bag size = the round's TILE BUDGET (the whole bag becomes the round's draw-pile; played + discarded
  // tiles do NOT recycle until next round). 2026-07-01: most bags are ~52 (a full 4-play + 2-discard
  // round never starves late-round hands). Lean stays SMALL (26) - scarcity is its identity. Rare Cache
  // is thinner (40) to keep "vowels run thin". Mystery is rolled fresh per run (see MYSTERY +
  // bag.buildMysteryBag). Rares (J/Q/X/Z) live ONLY in Rare Cache. Player-facing copy says "bag", not
  // "deck". Verify each bag's dead-rack% via analyze:corpus.
  DECKS: {
    standard:   { id: 'standard',   name: 'Standard',    desc: 'Balanced all-rounder. Best for learning any build.',  startingBag: null },  // null => CONFIG.STARTING_BAG (52, balanced, no rares)
    classic:    { id: 'classic',    name: 'Classic',     desc: 'Common letters, no surprises. The most consistent racks.', startingBag: [   // 52 tiles, rare-free, repeats commons (most consistent)
      'A','A','A','A','A','A','E','E','E','E','E','E','I','I','I','I','O','O','O','O','U','U',        // 22 vowels
      'R','R','R','R','S','S','S','S','T','T','T','T','N','N','L','L','D','D','G','G','C','C','M','M','B','B','P','P','H','H' ] },   // 30 common consonants (heavily doubled = predictable)
    vowelHeavy: { id: 'vowelHeavy', name: 'Vowel Heavy', desc: 'Vowel-rich. Few dead racks; favors vowel builds.',  startingBag: [        // 52 tiles, vowel-leaning
      'A','A','A','A','A','A','A','A','E','E','E','E','E','E','E','E','I','I','I','I','O','O','O','O','U','U','U','U',      // 28 vowels (~54%)
      'R','R','S','S','T','T','L','L','N','N','D','D','C','C','M','M','B','B','P','P','G','G','H','H' ] },                   // 24 consonants
    wildcard:   { id: 'wildcard',   name: 'Wildcard',    desc: 'Four wilds play as any letter. Flexible, big words.',  startingBag: [      // 52 tiles, 4 wilds
      'A','A','A','A','A','A','E','E','E','E','E','E','I','I','I','I','O','O','O','O','U','U',        // 22 vowels
      'R','R','S','S','T','T','L','L','N','N','D','D','C','C','M','M','B','B','P','P','G','G','H','H','F','F','*','*','*','*' ] },   // 26 consonants + 4 wilds
    rareRich:   { id: 'rareRich',   name: 'Rare Cache',  desc: 'Rares + wilds for J/Q/X/Z builds. Vowels run thin.',  startingBag: [        // 40 tiles, the ONLY bag with rares
      'A','A','A','E','E','E','I','I','O','U',                                  // 10 vowels (thin on purpose, ~25%)
      'R','R','S','S','T','T','L','L','N','N','D','D','C','M','B','P','G','H','F','Y',   // 20 consonants
      'J','Q','X','Z','K','K','*','*','*','*' ] },                              // 6 rares + 4 wilds
    doubled:    { id: 'doubled',    name: 'Echo Bag',    desc: 'Paired letters recur. Feeds doubled-letter builds.', startingBag: [        // 52 tiles, paired letters
      'A','A','A','A','E','E','E','E','E','E','I','I','I','I','O','O','O','O',                        // 18 vowels
      'S','S','S','S','T','T','T','T','L','L','L','L','N','N','N','N','R','R','R','R','D','D','D','D','C','C','M','M','B','B','P','P','G','G' ] },   // 34 consonants (heavily paired)
    lean:       { id: 'lean',       name: 'Lean Bag',    desc: 'Small, high-value bag. Thins fast; vowels run thin.', startingBag: [        // 26 tiles, intentionally SMALLEST (scarcity IS its identity)
      'A','A','E','E','I','O','U',                                             // 7 vowels (~27%)
      'R','R','S','S','T','T','N','N','L','D','C','M','B','P','K','F','H','Y','G' ] },   // 19 consonants (mid-value K/F/Y/H kept)
    mystery:    { id: 'mystery',    name: 'Mystery Bag', desc: 'A random mix, rolled fresh each run. Extra discard to dig; vowels guaranteed, size and letters vary.', startingBag: null, dynamic: 'mystery', discardsDelta: 1 },  // built by bag.buildMysteryBag from MYSTERY (seeded); +1 discard/round offsets the gamble's higher dead-rack risk
    staccato:   { id: 'staccato',   name: 'Staccato',    desc: 'High-value letters for punchy short words. Rewards a short-word build.', startingBag: [   // 44 tiles, high/mid-value leaning, no rares
      'A','A','A','E','E','E','E','I','I','I','O','O','O','U','U',              // 15 vowels (~34%)
      'S','S','R','R','T','T','N','N','L','L','D','D',                          // 12 core consonants
      'C','C','M','M','B','B','P','P','F','F','H','H','Y','Y','K','W','V' ] },   // 17 high/mid-value consonants (short words score big)
    suffix:     { id: 'suffix',     name: 'The Suffix',  desc: 'Endings galore (S, ED, ING). Builds word families and chains.', startingBag: [   // 48 tiles, ending-letter heavy
      'E','E','E','E','E','I','I','I','I','A','A','A','O','O','U',              // 15 vowels (E/I heavy)
      'S','S','S','S','S','S','R','R','R','R','R','N','N','N','N',              // S/R/N heavy (plurals, -ER)
      'T','T','T','T','T','D','D','D','D','D','G','G','G','L','L','C','M','P' ] },   // T/D/G heavy (-ED, -ING) + a few prefixers
    monolith:   { id: 'monolith',   name: 'Monolith',    desc: 'A few letters, many copies. Pairs everywhere; no rares, low ceiling.', startingBag: [   // 44 tiles, only 8 distinct letters, heavily repeated
      'A','A','A','A','A','A','E','E','E','E','E','E',                          // A/E only (12 vowels)
      'S','S','S','S','S','S','R','R','R','R','R','R','T','T','T','T','T',       // S/R/T
      'N','N','N','N','N','L','L','L','L','L','D','D','D','D','D' ] },            // N/L/D (near-guaranteed pairs; all low-value = low ceiling)
  },
  // Mystery Bag knobs (bag.buildMysteryBag). Both COUNTS and letter identities are rolled per run, so
  // size (vowelsMin+consMin .. vowelsMax+consMax = ~42-58, avg ~51) and mix vary. Vowels are FLOORED
  // (vowelsMin) so the bag is never vowel-starved - a COMPOSITION floor, allowed alongside the
  // "no drawn-rack vowel guarantee" rule. No rares (they live only in Rare Cache). Identities are
  // frequency-weighted so a roll rarely bricks; FLATTEN the weights for a wilder gamble. TUNE.
  MYSTERY: {
    vowelsMin: 12, vowelsMax: 16,
    consMin: 30, consMax: 42,
    vowelWeights: { A: 4, E: 4, I: 3, O: 3, U: 2 },
    consWeights: { R: 9, S: 8, T: 8, N: 7, L: 6, D: 5, C: 4, M: 4, B: 3, P: 3, G: 3, H: 3, F: 2, Y: 2, K: 2, V: 2, W: 2 },
  },
  STAKES: [
    { id: 0, name: 'First Edition',  targetMult: 1.0,  playsDelta: 0,  discardsDelta: 0 },
    { id: 1, name: 'Second Edition', targetMult: 1.25, playsDelta: 0,  discardsDelta: 0 },
    { id: 2, name: 'Third Edition',  targetMult: 1.5,  playsDelta: -1, discardsDelta: 0 },
  ],
  // Loadout perks are UNLOCKED with Meta here, then OPTED INTO per run (New Run toggles, default off).
  // Activating one cuts that run's Meta payout by metaPenalty × owned-level (flat). TUNE the penalties.
  LOADOUT: {
    extraDiscards: { name: '+1 Discard / round', max: 1, cost: 10, metaPenalty: 6, desc: 'Dig for better letters' },
    freeReroll:    { name: '+1 free reroll per shop', max: 2, cost: 8, metaPenalty: 4, desc: 'One free shop reroll each visit' },
    round1Play:    { name: '+1 Play on round 1', max: 1, cost: 8, metaPenalty: 4, desc: 'Open the run with an extra play' },
  },
  HONE: { cost: 6 },
  PROFANITY_FILTER: true,
  // Words rejected as plays even though ENABLE contains them. Lowercase, exact-match (see
  // dictionary.makeDictionary). Curated set of strong profanity + slurs; the author may extend or
  // empty this. Kept focused, not exhaustive.
  PROFANITY_BLOCKLIST: [
    // strong profanity
    'fuck', 'fucks', 'fucked', 'fucker', 'fuckers', 'shit', 'shits', 'shat', 'shitted',
    'cunt', 'cunts', 'twat', 'twats',
    // slurs (racial / ethnic / sexual-orientation / ableist)
    'nigger', 'niggers', 'nigga', 'niggas', 'kike', 'kikes', 'spic', 'spics', 'chink', 'chinks',
    'wop', 'wops', 'dago', 'dagos', 'gook', 'gooks', 'coon', 'coons', 'wetback', 'wetbacks',
    'faggot', 'faggots', 'fag', 'fags', 'dyke', 'dykes', 'tranny', 'trannies',
    'retard', 'retards', 'retarded', 'spaz', 'spazzes',
  ],
};
