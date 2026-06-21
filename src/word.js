export function wordOf(selection) {
  return selection.map(s => s.letter).join('');
}

export function validate(selection, dict, minLen = 3) {
  const word = wordOf(selection);
  if (word.length < minLen) return { ok: false, reason: 'short' };
  if (!dict.isValid(word)) return { ok: false, reason: 'notword' };
  return { ok: true };
}

export function isLegalSelection(selection, rack) {
  const rackIds = new Set(rack.map(t => t.id));
  const seen = new Set();
  for (const { tile } of selection) {
    if (!rackIds.has(tile.id) || seen.has(tile.id)) return false;
    seen.add(tile.id);
  }
  return true;
}
