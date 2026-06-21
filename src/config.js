export const CONFIG = {
  STARTING_BAG: [
    'A','A','A','E','E','E','I','I','O','O','U',          // 11 vowels
    'R','S','T','L','N','D','C','M','B','P','G','H','F','Y','K' // 15 consonants
  ],
  TILE_VALUES: {                                           // base Wit per letter; WILD '*' = 0
    A:1,E:1,I:1,O:1,U:1,L:1,N:1,S:1,T:1,R:1,
    D:2,G:2, B:3,C:3,M:3,P:3, F:4,H:4,V:4,W:4,Y:4, K:5, J:8,X:8, Q:10,Z:10, '*':0
  },
  RACK_SIZE: 9,
  PLAYS_PER_ROUND: 4,
  DISCARDS_PER_ROUND: 2,
  MIN_WORD_LEN: 3,
  LENGTH_BONUS_PER_LETTER: 5,                              // +5 × (len - 3), min 0
  TIER0_TARGETS: [20, 35, 55, 80, 110, 145, 185, 230],     // beatable from base bag, no shop
  ROUND_TARGETS:  [40, 70, 110, 160, 230, 320, 440, 600],  // real run (Tier 1+; assumes shop scaling)
  COINS_ON_CLEAR: { base: 4, perUnusedPlay: 1, perUnusedDiscard: 1 }, // Tier 1
  SHOP: {
    offersPerShop: 4,
    rerollCost: 2,
    cost: { buyLetter: 3, buyEnchantedTile: 7, enchantTile: 6, upgradeLetter: 5, thinLetter: 3, buyRelic: 8 },
    upgradePlus: 1,                                  // +Wit per upgradeLetter purchase
    buyableLetters: ['E','A','R','T','S','N','L','D','G','C','K','J','Q','X','Z'],  // shop letter pool
  },
  META: {
    earn: { perRoundCleared: 2, winBonus: 10 },
    baseUnlocked: {
      relics: ['vowelBonus','shortAndSweet','lengthy','freshStart','comboCounter','recycler'],
      mods: ['resonator','polished','catalyst','anchor'],
      decks: ['standard'],
      stakes: [0],
    },
    unlockCost: { relic: 15, mod: 12, deck: 20, stake: 10 },
  },
  DECKS: {
    standard:   { id: 'standard',   name: 'Standard',    startingBag: null },  // null => CONFIG.STARTING_BAG
    vowelHeavy: { id: 'vowelHeavy', name: 'Vowel Heavy', startingBag: ['A','A','A','A','E','E','E','E','I','I','O','O','U','U','R','S','T','L','N','D','C','M','B','P','G','H'] },
    wildcard:   { id: 'wildcard',   name: 'Wildcard',    startingBag: ['A','A','A','E','E','E','I','I','O','O','U','R','S','T','L','N','D','C','M','B','P','G','H','F','*','*'] },
  },
  STAKES: [
    { id: 0, name: 'Stake 0', targetMult: 1.0,  playsDelta: 0,  discardsDelta: 0,  metaMult: 1.0 },
    { id: 1, name: 'Stake 1', targetMult: 1.25, playsDelta: 0,  discardsDelta: 0,  metaMult: 1.5 },
    { id: 2, name: 'Stake 2', targetMult: 1.5,  playsDelta: -1, discardsDelta: 0,  metaMult: 2.0 },
  ],
  LOADOUT: {
    extraDiscards: { name: '+1 Discard / round', max: 2, cost: 10 },
    startCoins:    { name: '+5 starting Coins',  max: 2, cost: 8 },   // each level = +5 coins
    startRelic:    { name: 'Start with Vowel Bonus', max: 1, cost: 25, relicId: 'vowelBonus' },
  },
  PROFANITY_FILTER: true,
  PROFANITY_BLOCKLIST: [ /* add slurs to reject; author may empty this */ ],
};
