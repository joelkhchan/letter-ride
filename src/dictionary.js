export function makeDictionary(words, blocklist = []) {
  const set = new Set();
  for (const w of words) set.add(w.toLowerCase());
  const blocked = new Set();
  for (const w of blocklist) blocked.add(w.toLowerCase());
  return {
    isValid(word) {
      const w = String(word).toLowerCase();
      return set.has(w) && !blocked.has(w);
    },
    // Returns the first dictionary word formable from the letters array (multiset),
    // of length >= minLen, that is not blocklisted. Returns null if none found.
    findWord(letters, minLen = 3) {
      // Build a frequency map of available letters (uppercase for comparison).
      const avail = {};
      for (const l of letters) {
        const ch = String(l).toUpperCase();
        avail[ch] = (avail[ch] || 0) + 1;
      }
      for (const w of set) {
        if (w.length < minLen) continue;
        if (blocked.has(w)) continue;
        // Multiset check: every letter in w must appear <= times in avail.
        const need = {};
        let ok = true;
        for (const ch of w.toUpperCase()) {
          need[ch] = (need[ch] || 0) + 1;
          if ((avail[ch] || 0) < need[ch]) { ok = false; break; }
        }
        if (ok) return w;
      }
      return null;
    },
  };
}

export async function loadFromFile(path, blocklist = []) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Dictionary load failed: ${res.status} ${path}`);
  const text = await res.text();
  return makeDictionary(text.split(/\r?\n/).filter(Boolean), blocklist);
}
