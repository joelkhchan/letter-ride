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
  META_EARN: { perRoundCleared: 2, winBonus: 10 },         // Tier 2
  PROFANITY_FILTER: true,
  PROFANITY_BLOCKLIST: [ /* add slurs to reject; author may empty this */ ],
};
