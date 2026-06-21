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
  };
}

export async function loadFromFile(path, blocklist = []) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Dictionary load failed: ${res.status} ${path}`);
  const text = await res.text();
  return makeDictionary(text.split(/\r?\n/).filter(Boolean), blocklist);
}
