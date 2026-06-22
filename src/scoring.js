// src/scoring.js
export function scoreWord(selection, { tileValues, lengthBonusPerLetter, relics = [], context = {} }) {
  const letters = selection.map(s => s.letter.toUpperCase());
  const word = letters.join('');
  const ctx = { word, letters, selection, ...context };

  // Phase 1 — base Wit
  const base = selection.reduce(
    (s, { tile, letter }) => s + (tile.letter === '*' ? 0 : (tileValues[letter.toUpperCase()] || 0)),
    0
  );
  const lengthBonus = Math.max(0, letters.length - 3) * lengthBonusPerLetter;
  let wit = base + lengthBonus;

  let addMult = 0, timesMult = 1;

  // Breakdown tracking
  const witParts = [];
  const addMultParts = [];
  const timesMultParts = [];

  const apply = (d, label) => {
    if (!d) return;
    if (d.addWit) { wit += d.addWit; witParts.push({ label, amount: d.addWit }); }
    if (d.addMult) { addMult += d.addMult; addMultParts.push({ label, amount: d.addMult }); }
    if (d.timesMult && d.timesMult !== 1) { timesMult *= d.timesMult; timesMultParts.push({ label, amount: d.timesMult }); }
  };

  for (const relic of relics) apply(relic.evaluate?.(ctx), relic.name || relic.id);   // global
  for (const { tile } of selection)                                                     // tile-mods
    for (const mod of (tile.mods || [])) apply(mod.evaluate?.(tile, ctx), mod.name || mod.id);

  const mult = (1 + addMult) * timesMult;                            // +Mult then ×Mult
  const breakdown = { base, lengthBonus, witParts, addMultParts, timesMultParts };
  return { wit, mult, points: wit * mult, breakdown };
}
