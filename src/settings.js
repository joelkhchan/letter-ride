// src/settings.js
// UI / gameplay preferences, persisted to localStorage. Presentation-layer only (not game
// rules, not the run/meta saves). Kept tiny and extensible: add a key to DEFAULTS and it is
// readable/toggleable everywhere via getPref/togglePref.

const KEY = 'letterRide.prefs';
const DEFAULTS = {
  reducedMotion: false,        // skip animations (accessibility)
  scoringSpeed: 'full',        // 'full' (slow, readable) | 'fast' (quick) | 'off' (instant final score)
  textSize: 'normal',          // 'normal' | 'large'
};

let prefs = (() => {
  try { return { ...DEFAULTS, ...JSON.parse(window.localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
})();

export function getPref(k) { return prefs[k]; }
export function setPref(k, v) {
  prefs[k] = v;
  try { window.localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {}
}
export function togglePref(k) { setPref(k, !prefs[k]); return prefs[k]; }

// Apply display-affecting prefs to the document root (text size). Call on boot and on change.
export function applyDisplayPrefs() {
  try { document.documentElement.classList.toggle('text-large', prefs.textSize === 'large'); } catch {}
}
