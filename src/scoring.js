// src/scoring.js
export function scoreWord(selection, { tileValues, lengthBonusPerLetter, relics = [], context = {} }) {
  const letters = selection.map(s => s.letter.toUpperCase());
  const word = letters.join('');
  const ctx = { word, letters, selection, ...context };

  let points = 0, addMult = 0, timesMult = 1;
  const pointParts = [], addMultParts = [], timesMultParts = [];

  const apply = (d, label) => {
    if (!d) return;
    if (d.addPoints) { points += d.addPoints; pointParts.push({ label, amount: d.addPoints }); }
    if (d.addMult) { addMult += d.addMult; addMultParts.push({ label, amount: d.addMult }); }
    if (d.timesMult && d.timesMult !== 1) { timesMult *= d.timesMult; timesMultParts.push({ label, amount: d.timesMult }); }
  };

  // Word-level relics fire ONCE (kept first, preserving breakdown order).
  for (const relic of relics) apply(relic.evaluate?.(ctx), relic.name || relic.id);

  // Per-tile: base value + the tile's OWN mods, each counted `times = 1 + retrigger`.
  // Retrigger replays a tile's own contribution only; it never re-fires word-level relics or
  // the length bonus. Looping `apply()` (not scaling) makes a retriggered ×Mult mod compound.
  let base = 0;
  for (const { tile, letter } of selection) {
    const baseVal = tile.letter === '*' ? 0 : (tileValues[letter.toUpperCase()] || 0);
    let retrigger = 0;
    for (const mod of (tile.mods || [])) retrigger += (mod.evaluate?.(tile, ctx)?.retrigger || 0);
    for (const relic of relics) retrigger += (relic.retriggerTile?.(tile, ctx) || 0);
    const times = 1 + retrigger;
    base += baseVal * times;
    for (const mod of (tile.mods || []))
      for (let i = 0; i < times; i++) apply(mod.evaluate?.(tile, ctx), mod.name || mod.id);
  }

  const lengthBonus = Math.max(0, letters.length - 3) * lengthBonusPerLetter;  // word-level, once
  points += base + lengthBonus;

  const mult = (1 + addMult) * timesMult;                            // +Mult then ×Mult
  const breakdown = { base, lengthBonus, pointParts, addMultParts, timesMultParts };
  // Score is rounded to an integer: fractional multipliers (×1.5, snowball per-stack, mods) otherwise
  // leak IEEE float noise (e.g. 304.29999999999995) into roundTotal, the breakdown, and lifetimeScore.
  // Points and mult stay exact; only the final Score is rounded.
  return { points, mult, score: Math.round(points * mult), breakdown };
}
