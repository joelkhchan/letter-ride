// src/patterns.js — pure synergy predicates (cheap string ops)
export function hasDigraph(word, digraphs) {
  const w = String(word).toUpperCase();
  return digraphs.some(d => w.includes(String(d).toUpperCase()));
}
export function hasDoubledLetter(word) {
  const w = String(word).toUpperCase();
  for (let i = 1; i < w.length; i++) if (w[i] === w[i - 1]) return true;
  return false;
}
export function isPalindrome(word) {
  const w = String(word).toUpperCase();
  return w.length >= 2 && w === [...w].reverse().join('');
}
export function endsWith(word, suffix) {
  return String(word).toUpperCase().endsWith(String(suffix).toUpperCase());
}
export function countOf(letters, ch) {
  const c = String(ch).toUpperCase();
  return letters.reduce((n, l) => n + (String(l).toUpperCase() === c ? 1 : 0), 0);
}
