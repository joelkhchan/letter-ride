import { test } from 'node:test';
import assert from 'node:assert';
import { scoreWord } from '../src/scoring.js';
import { RELICS, ALL_RELIC_IDS } from '../src/relics.js';
import { makeTile, resetTileIds } from '../src/tiles.js';

const tv = { C:3, A:1, T:1, E:1, I:1, O:1, U:1, S:1, L:1, B:3, Q:10, Y:4, N:1 };
const sel = (word) => [...word].map(ch => ({ tile: makeTile(ch), letter: ch }));
const base = (word, opts = {}) => scoreWord(sel(word), { tileValues: tv, lengthBonusPerLetter: 0, ...opts });

test('vowelBonus: +2 Points per vowel', () => {
  resetTileIds();
  const b = base('CAT');                                   // 1 vowel (A)
  const r = base('CAT', { relics: [RELICS.vowelBonus] });
  assert.equal(r.points - b.points, 2);
});
test('rareHoarder: +30 Points if word uses J/Q/X/Z', () => {
  resetTileIds();
  assert.equal(base('QI', { relics: [RELICS.rareHoarder] }).points - base('QI').points, 30);
  assert.equal(base('CAT', { relics: [RELICS.rareHoarder] }).points - base('CAT').points, 0);
});
test('shortAndSweet: ×3 Mult for words <= 3 letters only', () => {
  resetTileIds();
  assert.equal(base('CAT', { relics: [RELICS.shortAndSweet] }).mult, 3);
  assert.equal(base('CATS', { relics: [RELICS.shortAndSweet] }).mult, 1);
});
test('lengthy: +1 Mult per letter beyond 4', () => {
  resetTileIds();
  assert.equal(base('CASTLE', { relics: [RELICS.lengthy] }).mult, 1 + 2);  // 6 letters -> +2
  assert.equal(base('CAT', { relics: [RELICS.lengthy] }).mult, 1);
});
test('doubleTrouble: +40 Points if a doubled letter', () => {
  resetTileIds();
  assert.equal(base('BALL', { relics: [RELICS.doubleTrouble] }).points - base('BALL').points, 40);
  assert.equal(base('CAT', { relics: [RELICS.doubleTrouble] }).points - base('CAT').points, 0);
});
test('freshStart: +2 Mult if first letter is a vowel', () => {
  resetTileIds();
  assert.equal(base('ICE', { relics: [RELICS.freshStart] }).mult, 1 + 2);
  assert.equal(base('CAT', { relics: [RELICS.freshStart] }).mult, 1);
});
test('comboCounter: +1 Mult per word already played this round', () => {
  resetTileIds();
  const r = scoreWord(sel('CAT'), { tileValues: tv, lengthBonusPerLetter: 0, relics: [RELICS.comboCounter], context: { wordsPlayedThisRound: 2 } });
  assert.equal(r.mult, 1 + 2);
});
test('recycler is an economy relic: no evaluate, has coinsOnRoundClear', () => {
  assert.equal(typeof RELICS.recycler.evaluate, 'undefined');
  assert.equal(RELICS.recycler.coinsOnRoundClear({ playsLeft: 3 }), 6);   // +2 per unused play
});

// ── Task 5: 8 new relics ─────────────────────────────────────────────────────

// tv covers Q, I, B, A, L, C, S, T, E but not X/Z/J — extend for rare-letter tests
const tv2 = { ...tv, X: 8, Z: 10, J: 8 };
const base2 = (word, opts = {}) => scoreWord(sel(word), { tileValues: tv2, lengthBonusPerLetter: 0, ...opts });

test('rareSurge: ×1.5 Mult when word uses a rare letter (Q)', () => {
  resetTileIds();
  const withRelic = base2('QI', { relics: [RELICS.rareSurge] });
  const without   = base2('QI');
  assert.equal(withRelic.mult / without.mult, 1.5);
});

test('echoChamber: ×2 Mult when word has a doubled letter (BALL)', () => {
  resetTileIds();
  const withRelic = base2('BALL', { relics: [RELICS.echoChamber] });
  const without   = base2('BALL');
  assert.equal(withRelic.mult / without.mult, 2);
});

test('echoChamber: no bonus when no doubled letter (CAT)', () => {
  resetTileIds();
  const withRelic = base2('CAT', { relics: [RELICS.echoChamber] });
  const without   = base2('CAT');
  assert.equal(withRelic.mult, without.mult);
});

test('longHaul: ×(1 + 0.25*(len-5)) Mult for 6-letter word', () => {
  resetTileIds();
  // CASTLE = 6 letters → 1 + 0.25*(6-5) = 1.25
  const withRelic = base2('CASTLE', { relics: [RELICS.longHaul] });
  const without   = base2('CASTLE');
  assert.equal(withRelic.mult / without.mult, 1.25);
});

test('longHaul: no bonus for 5-letter word', () => {
  resetTileIds();
  // BLAST = 5 letters → no bonus
  const withRelic = base2('BLAST', { relics: [RELICS.longHaul], tileValues: { ...tv2, B:3 } });
  const without   = base2('BLAST', { tileValues: { ...tv2, B:3 } });
  assert.equal(withRelic.mult, without.mult);
});

test('momentum: +10 Points per word already played this round', () => {
  resetTileIds();
  const r = scoreWord(sel('CAT'), {
    tileValues: tv, lengthBonusPerLetter: 0,
    relics: [RELICS.momentum],
    context: { wordsPlayedThisRound: 3 },
  });
  const base3 = scoreWord(sel('CAT'), { tileValues: tv, lengthBonusPerLetter: 0 });
  assert.equal(r.points - base3.points, 30);
});

test('momentum: +0 Points when no words played yet', () => {
  resetTileIds();
  const r = scoreWord(sel('CAT'), {
    tileValues: tv, lengthBonusPerLetter: 0,
    relics: [RELICS.momentum],
  });
  const base3 = scoreWord(sel('CAT'), { tileValues: tv, lengthBonusPerLetter: 0 });
  assert.equal(r.points - base3.points, 0);
});

test('overtime: extraPlays === 1', () => {
  assert.equal(RELICS.overtime.extraPlays, 1);
});

test('wildcardRares: enabler flag fires rareSurge on a wild tile', () => {
  resetTileIds();
  // Simulate a wild tile used as a rare: selection has a wild tile, enablers includes 'wildsAreRare'
  const wildSel = [
    { tile: makeTile('*'), letter: 'Q' },  // wild tile, played as Q
    { tile: makeTile('I'), letter: 'I' },
  ];
  const withBoth = scoreWord(wildSel, {
    tileValues: tv2, lengthBonusPerLetter: 0,
    relics: [RELICS.rareSurge],
    context: { enablers: ['wildsAreRare'] },
  });
  const without = scoreWord(wildSel, {
    tileValues: tv2, lengthBonusPerLetter: 0,
  });
  // rareSurge should fire because enablers includes 'wildsAreRare' and selection has a wild
  assert.equal(withBoth.mult / without.mult, 1.5);
});

test('wildcardRares: enabler field is set correctly', () => {
  assert.equal(RELICS.wildcardRares.enabler, 'wildsAreRare');
});

test('longReach: enabler field is set correctly', () => {
  assert.equal(RELICS.longReach.enabler, 'longReach');
});

test('looseDoubles: enabler field is set correctly', () => {
  assert.equal(RELICS.looseDoubles.enabler, 'looseDoubled');
});

// ── Task 1: Snowball infrastructure + Avalanche ──────────────────────────────

test('rareAvalanche: ×Mult grows with its stacks, applies to every word', () => {
  const av = RELICS.rareAvalanche;
  // 0 stacks → timesMult 1 (no-op)
  assert.deepEqual(av.evaluate({ relicState: {} }), { timesMult: 1 });
  // 3 stacks → timesMult 1 + 0.2*3 = 1.6, regardless of the current word
  assert.deepEqual(av.evaluate({ relicState: { rareAvalanche: { stacks: 3 } } }), { timesMult: 1 + 0.2 * 3 });
});

test('rareAvalanche: condition is "word uses a rare letter"', () => {
  const av = RELICS.rareAvalanche;
  assert.equal(av.snowball.condition({ letters: ['J', 'A', 'R'] }), true);
  assert.equal(av.snowball.condition({ letters: ['R', 'A', 'T'] }), false);
});

test('all six snowball relics: condition + ×Mult-from-stacks', () => {
  const cases = [
    ['flywheel',        { letters: ['C','A','T'] },             { letters: ['C','A','T','S'] }],          // short ≤3 vs not
    ['juggernaut',      { letters: ['A','B','C','D','E','F'] },  { letters: ['C','A','T'] }],              // long ≥6 vs not
    ['resonanceEngine', { word: 'BOOK', letters: ['B','O','O','K'] }, { word: 'CAT', letters: ['C','A','T'] }], // doubled vs not
    ['risingTide',      { letters: ['A','E','I','T'] },          { letters: ['C','A','T'] }],              // ≥3 vowels vs not
  ];
  for (const [id, yes, no] of cases) {
    assert.equal(RELICS[id].snowball.condition({ enablers: [], selection: [], ...yes }), true, `${id} yes`);
    assert.equal(RELICS[id].snowball.condition({ enablers: [], selection: [], ...no }), false, `${id} no`);
  }
  // perpetualEngine fires on every word
  assert.equal(RELICS.perpetualEngine.snowball.condition({ letters: ['C','A','T'] }), true);
  // stacks read (flywheel perStack 0.3)
  assert.deepEqual(RELICS.flywheel.evaluate({ relicState: { flywheel: { stacks: 2 } } }), { timesMult: 1 + 0.3 * 2 });
});

test('pressLead retriggers only the first tile', () => {
  const rel = RELICS.pressLead;
  const selection = [{ tile: { letter: 'A' }, letter: 'A' }, { tile: { letter: 'B' }, letter: 'B' }];
  const ctx = { selection };
  assert.equal(rel.retriggerTile(selection[0].tile, ctx), 1);
  assert.equal(rel.retriggerTile(selection[1].tile, ctx), 0);
  assert.ok(ALL_RELIC_IDS.includes('pressLead'));
});

test('rareReprint retriggers only rare-letter tiles (J/Q/X/Z)', () => {
  const rel = RELICS.rareReprint;
  const ctx = { selection: [] };
  assert.equal(rel.retriggerTile({ letter: 'Q' }, ctx), 1);
  assert.equal(rel.retriggerTile({ letter: 'q' }, ctx), 1);   // case-insensitive
  assert.equal(rel.retriggerTile({ letter: 'A' }, ctx), 0);
  assert.ok(ALL_RELIC_IDS.includes('rareReprint'));
});

test('rareReprint doubles a rare tile base value through scoreWord', () => {
  const r = scoreWord(
    [{ tile: { letter: 'Q', mods: [] }, letter: 'Q' }, { tile: { letter: 'A', mods: [] }, letter: 'A' }],
    { tileValues: { Q: 10, A: 1 }, lengthBonusPerLetter: 1, relics: [RELICS.rareReprint], context: {} }
  );
  assert.equal(r.breakdown.base, 21);   // Q=10 printed twice (20) + A=1 once
});
