export const CONFIG = {
  STARTING_BAG: [                                          // 26-tile scarcity model (2026-06-29): shrunk back from 54 - a small focused bag = engine consistency (the variety enlargement diluted synergies). No rares in Standard (rares live in Rare Cache).
    'A','A','A','E','E','E','I','I','O','O','U',            // 11 vowels (~42%)
    'R','S','T','L','N','D','C','M','B','P','G','H','F','Y','K'  // 15 consonants (common + mid K/F/Y; NO J/Q/X/Z)
  ],
  TILE_VALUES: {                                           // base points per letter; WILD '*' = 0
    A:1,E:1,I:1,O:1,U:1,L:1,N:1,S:1,T:1,R:1,
    D:2,G:2, B:3,C:3,M:3,P:3, F:4,H:4,V:4,W:4,Y:4, K:5, J:8,X:8, Q:10,Z:10, '*':0
  },
  RACK_SIZE: 9,
  HAND_FLOOR: 6,        // effective hand size never drops below this - the -hand stack cap (tunable)
  PLAYS_PER_ROUND: 4,
  DISCARDS_PER_ROUND: 2,
  MIN_WORD_LEN: 3,
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
      relics: ['vowelBonus','shortAndSweet','lengthy','freshStart','comboCounter','recycler','wideMargins','tightLeading'],
      mods: ['resonator','polished','catalyst','anchor'],
      decks: ['standard','classic','rareRich','doubled','lean'],
      stakes: [0],
    },
    unlockCost: { relic: 25, mod: 20, deck: 35, stake: 15 },   // TUNE: raised to absorb the larger faucet
    achievement: {
      reward: { onboarding: 3, mastery: 12, diversity: 8, discovery: 5, progression: 10 },  // TUNE: Meta by bucket
      rewardOverride: { winStake2: 25, reachApprentice: 5, reachJourneyman: 10, reachExpert: 15, reachArtisan: 25 },  // TUNE
      bigWordScore: 150,    // TUNE
      bigRoundScore: 400,   // TUNE
      efficientWords: 20,   // TUNE: win in <= N total words (12 rounds, so <=20 ≈ 1.6 words/round)
      manyMods: 4,          // TUNE
      manyRelics: 4,        // TUNE
      discoverRelics: 12,   // TUNE: Curator - use N different relics across runs (keep the desc in sync)
      discoverMods: 6,      // TUNE: Enchanter - apply N different tile-mods across runs (keep the desc in sync)
    },
    bounty: { 0: 5, 1: 10, 2: 20 },   // TUNE: one-time per (stake,deck) cell, by stake tier
  },
  LEVELS: {
    names: ['Novice', 'Apprentice', 'Journeyman', 'Expert', 'Artisan'],   // TUNE names (branding owns final)
    thresholds: [0, 4000, 12000, 28000, 60000],                           // TUNE: cumulative lifetime Score per tier (raised from 3k/9k/20k/40k per analyze:meta; ~Apprentice 3 / Journeyman 9 / Expert 21 / Artisan 46 runs for a competent line)
  },
  // Each tile bag is a small, focused ~26-tile identity (2026-06-29 scarcity model: a small bag =
  // engine CONSISTENCY; enlarging to 52 diluted count-synergies + clunked racks, so we shrank back).
  // Rares (J/Q/X/Z) live ONLY in Rare Cache. Lean stays smallest (its identity IS scarcity).
  // Player-facing copy says "bag", not "deck". Verify each bag's dead-rack% via analyze:corpus.
  DECKS: {
    standard:   { id: 'standard',   name: 'Standard',    desc: 'Balanced starter bag. Good for learning.',         startingBag: null },  // null => CONFIG.STARTING_BAG (26, balanced, no rares)
    classic:    { id: 'classic',    name: 'Classic',     desc: 'Common letters only, fewer types. Clean and predictable.', startingBag: [   // 26 tiles, rare-free, repeats commons (most consistent)
      'A','A','A','E','E','E','I','I','O','O','U',                              // 11 vowels
      'R','R','S','S','T','T','N','L','D','G','C','M','B','P','H' ] },           // 15 common consonants (doubled R/S/T = predictable)
    vowelHeavy: { id: 'vowelHeavy', name: 'Vowel Heavy', desc: 'Vowel-rich bag. Racks stay playable.',             startingBag: [        // 26 tiles, vowel-leaning
      'A','A','A','A','E','E','E','E','I','I','O','O','U','U',                  // 14 vowels (~54%)
      'R','S','T','L','N','D','C','M','B','P','G','H' ] },                       // 12 consonants
    wildcard:   { id: 'wildcard',   name: 'Wildcard',    desc: 'Has wild tiles that play as any letter.',          startingBag: [        // 26 tiles, 2 wilds
      'A','A','A','E','E','E','I','I','O','O','U',                              // 11 vowels
      'R','S','T','L','N','D','C','M','B','P','G','H','F','*','*' ] },           // 13 consonants + 2 wilds
    rareRich:   { id: 'rareRich',   name: 'Rare Cache',  desc: 'Rares and wilds, but vowels can run dry.',         startingBag: [        // 26 tiles, the ONLY bag with rares
      'A','A','E','E','I','O','U',                                              // 7 vowels (thin on purpose)
      'R','S','T','L','N','D','C','M','B','P','G','H',                          // 12 consonants
      'J','Q','X','Z','K','*','*' ] },                                          // 5 rares + 2 wilds
    doubled:    { id: 'doubled',    name: 'Echo Bag',    desc: 'Duplicate-heavy bag. Doubled letters recur.',      startingBag: [        // 26 tiles, paired letters
      'A','A','E','E','E','I','I','O','O',                                      // 9 vowels
      'S','S','T','T','L','L','N','N','R','R','D','D','C','M','B','P','G' ] },   // 17 consonants (many paired)
    lean:       { id: 'lean',       name: 'Lean Bag',    desc: 'Few, high-value tiles. Vowels can run dry.',       startingBag: ['A','E','I','O','U','R','S','T','N','L','D','C','M','B','P','K','F','H','Y','G'] },  // intentionally SMALLEST (20)
  },
  STAKES: [
    { id: 0, name: 'First Edition',  targetMult: 1.0,  playsDelta: 0,  discardsDelta: 0 },
    { id: 1, name: 'Second Edition', targetMult: 1.25, playsDelta: 0,  discardsDelta: 0 },
    { id: 2, name: 'Third Edition',  targetMult: 1.5,  playsDelta: -1, discardsDelta: 0 },
  ],
  LOADOUT: {
    extraDiscards: { name: '+1 Discard / round', max: 2, cost: 10, desc: 'More discards each round to dig for better letters' },
    freeReroll:    { name: '+1 free reroll per shop', max: 2, cost: 8, desc: 'Reroll the shop once per visit at no cost' },
    round1Play:    { name: '+1 Play on round 1', max: 1, cost: 8, desc: 'An extra play to open the run strong' },
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
