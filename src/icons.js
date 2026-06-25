// src/icons.js — UI-only presentation layer for icons. NO game rules; returns HTML strings.
// Tier-A elements (relics, bosses, achievements, Meta currency) render as an engraved aged-gold
// WAX SEAL; Tier-B/general UI uses Tabler line icons. See the `visual-assets-decided` memory and
// assets/icons/CREDITS.md (game-icons.net, CC BY 3.0).
//
// Glyphs are recolored via CSS mask. The mask url is set INLINE (resolves against the document at
// the web root); a url() in a custom property would resolve relative to src/style.css and 404.

const LETTER_RELICS = { vowelBonus: 'A' };  // vowel-semantic relic: struck Zilla letter, not a pictogram

// a mask-tinted glyph from an svg path
function glyphMark(src) {
  return `<span class="seal-glyph" style="-webkit-mask:url('${src}') center/contain no-repeat;mask:url('${src}') center/contain no-repeat"></span>`;
}
// wrap an inner mark in the aged-gold seal (class name is historical; it is the generic Tier-A seal)
function seal(inner, size) {
  return `<span class="relic-seal relic-seal--${size}" aria-hidden="true">${inner}</span>`;
}

// A relic's struck-gold seal. size: 'sm' (in-line tray) or 'md' (shop offer).
export function relicSealHtml(relicId, { size = 'sm' } = {}) {
  if (!relicId) return '';
  const letter = LETTER_RELICS[relicId];
  return seal(letter ? `<span class="seal-letter">${letter}</span>` : glyphMark(`assets/icons/relics/relic-${relicId}.svg`), size);
}

// A boss's seal (the Sentence-round threat).
export function bossSealHtml(bossId, { size = 'md' } = {}) {
  if (!bossId) return '';
  return seal(glyphMark(`assets/icons/bosses/boss-${bossId}.svg`), size);
}

// The Meta (prestige, between-runs) currency seal — kept visually distinct from the in-run $.
export function metaSealHtml({ size = 'sm' } = {}) {
  return seal(glyphMark('assets/icons/ui/meta.svg'), size);
}

// Tier-B general UI: a bare Tabler line glyph, 1em, inheriting the surrounding text colour
// (currentColor). For coins/$, hones, menu nav, settings, etc. File at assets/icons/ui/<name>.svg.
export function lineIconHtml(name) {
  const src = `assets/icons/ui/${name}.svg`;
  return `<span class="lr-line" style="-webkit-mask:url('${src}') center/contain no-repeat;mask:url('${src}') center/contain no-repeat" aria-hidden="true"></span>`;
}
