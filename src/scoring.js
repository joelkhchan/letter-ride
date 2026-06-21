// src/scoring.js
export function scoreWord(selection, { tileValues, lengthBonusPerLetter, relics = [], context = {} }) {
  const letters = selection.map(s => s.letter.toUpperCase());
  const word = letters.join('');
  const ctx = { word, letters, selection, ...context };

  // Phase 1 — base Wit
  let wit = selection.reduce(
    (s, { tile, letter }) => s + (tile.letter === '*' ? 0 : (tileValues[letter.toUpperCase()] || 0)),
    0
  );
  wit += Math.max(0, letters.length - 3) * lengthBonusPerLetter;

  let addMult = 0, timesMult = 1;
  const apply = (d) => {
    if (!d) return;
    wit += d.addWit ?? 0;
    addMult += d.addMult || 0;
    timesMult *= (d.timesMult ?? 1);
  };

  for (const relic of relics) apply(relic.evaluate?.(ctx));          // global (none in Tier 0)
  for (const { tile } of selection)                                  // tile-mods (none in Tier 0)
    for (const mod of (tile.mods || [])) apply(mod.evaluate?.(tile, ctx));

  const mult = (1 + addMult) * timesMult;                            // +Mult then ×Mult
  return { wit, mult, points: wit * mult };
}
