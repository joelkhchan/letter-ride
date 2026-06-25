export const CONFIG = {
  STARTING_BAG: [
    'A','A','A','E','E','E','I','I','O','O','U',          // 11 vowels
    'R','S','T','L','N','D','C','M','B','P','G','H','F','Y','K' // 15 consonants
  ],
  TILE_VALUES: {                                           // base points per letter; WILD '*' = 0
    A:1,E:1,I:1,O:1,U:1,L:1,N:1,S:1,T:1,R:1,
    D:2,G:2, B:3,C:3,M:3,P:3, F:4,H:4,V:4,W:4,Y:4, K:5, J:8,X:8, Q:10,Z:10, '*':0
  },
  RACK_SIZE: 9,
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
    40,  50,  60,      // Passage 1: Word, Phrase, Sentence(boss)
    75,  90,  110,     // Passage 2
    130, 160, 195,     // Passage 3
    240, 290, 355,     // Passage 4 (final boss)
  ],
  COINS_ON_CLEAR: { base: 4, perUnusedPlay: 1, perUnusedDiscard: 1 }, // Tier 1
  INTEREST: { enabled: true, per: 5, rate: 1, cap: 5 },             // $1 per $5 held, max $5
  SHOP: {
    offersPerShop: 4,
    rerollCost: 2,
    cost: { buyLetter: 3, buyEnchantedTile: 7, enchantTile: 6, upgradeLetter: 5, thinLetter: 3, buyRelic: 8, recastTile: 5, transferMods: 5 },
    upgradePlus: 1,                                  // +points per upgradeLetter purchase
    buyableLetters: ['E','A','R','T','S','N','L','D','G','C','K','J','Q','X','Z'],  // shop letter pool
  },
  META: {
    earn: { perRoundCleared: 2, winBonus: 10 },
    baseUnlocked: {
      relics: ['vowelBonus','shortAndSweet','lengthy','freshStart','comboCounter','recycler'],
      mods: ['resonator','polished','catalyst','anchor'],
      decks: ['standard','rareRich','doubled','lean'],
      stakes: [0],
    },
    unlockCost: { relic: 25, mod: 20, deck: 35, stake: 15 },   // TUNE: raised to absorb the larger faucet
    achievement: {
      reward: { onboarding: 3, mastery: 12, diversity: 8, discovery: 5, progression: 10 },  // TUNE: Meta by bucket
      rewardOverride: { winStake2: 25, reachApprentice: 5, reachJourneyman: 10, reachExpert: 15, reachArtisan: 25 },  // TUNE
      bigWordScore: 150,    // TUNE
      bigRoundScore: 400,   // TUNE
      efficientWords: 12,   // TUNE: win in <= N total words
      manyMods: 4,          // TUNE
      manyRelics: 4,        // TUNE
    },
    bounty: { 0: 5, 1: 10, 2: 20 },   // TUNE: one-time per (stake,deck) cell, by stake tier
  },
  LEVELS: {
    names: ['Novice', 'Apprentice', 'Journeyman', 'Expert', 'Artisan'],   // TUNE names (branding owns final)
    thresholds: [0, 3000, 9000, 20000, 40000],                            // TUNE: cumulative lifetime Score per tier
  },
  DECKS: {
    standard:   { id: 'standard',   name: 'Standard',    desc: 'Balanced starter. Good for learning.',                                                              startingBag: null },  // null => CONFIG.STARTING_BAG
    vowelHeavy: { id: 'vowelHeavy', name: 'Vowel Heavy', desc: 'Vowel-rich. Keeps racks playable.',                                                              startingBag: ['A','A','A','A','E','E','E','E','I','I','O','O','U','U','R','S','T','L','N','D','C','M','B','P','G','H'] },
    wildcard:   { id: 'wildcard',   name: 'Wildcard',    desc: 'Has wild tiles that play as any letter.',                                               startingBag: ['A','A','A','E','E','E','I','I','O','O','U','R','S','T','L','N','D','C','M','B','P','G','H','F','*','*'] },
    rareRich:   { id: 'rareRich',   name: 'Rare Cache',  desc: 'Rare letters and wilds. Vowels can run dry.',                          startingBag: ['A','A','E','E','I','O','U','R','S','T','L','N','D','C','M','B','P','G','H','J','Q','X','Z','*','*','K'] },
    doubled:    { id: 'doubled',    name: 'Echo Bag',    desc: 'Duplicate-heavy. Doubled letters come up often.',                                           startingBag: ['A','A','E','E','E','I','I','O','O','S','S','T','T','L','L','N','N','R','R','D','D','C','M','B','P','G'] },
    lean:       { id: 'lean',       name: 'Lean Bag',    desc: 'Fewer, high-value tiles. Vowels can run dry.',                               startingBag: ['A','E','I','O','U','R','S','T','N','L','D','C','M','B','P','K','F','H','Y','G'] },
  },
  STAKES: [
    { id: 0, name: 'Stake 0', targetMult: 1.0,  playsDelta: 0,  discardsDelta: 0,  metaMult: 1.0 },
    { id: 1, name: 'Stake 1', targetMult: 1.25, playsDelta: 0,  discardsDelta: 0,  metaMult: 1.5 },
    { id: 2, name: 'Stake 2', targetMult: 1.5,  playsDelta: -1, discardsDelta: 0,  metaMult: 2.0 },
  ],
  LOADOUT: {
    extraDiscards: { name: '+1 Discard / round', max: 2, cost: 10 },
  },
  HONE: { cost: 6 },
  PROFANITY_FILTER: true,
  PROFANITY_BLOCKLIST: [ /* add slurs to reject; author may empty this */ ],
};
