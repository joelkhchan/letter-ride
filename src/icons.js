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

// Achievement bucket badge: the bucket's emblem in a small seal; grey (locked) until earned.
export function bucketBadgeHtml(bucket, earned) {
  const cls = `relic-seal relic-seal--sm${earned ? '' : ' locked'}`;
  return `<span class="${cls}" aria-hidden="true">${glyphMark(`assets/icons/buckets/${bucket}.svg`)}</span>`;
}

// --- New Run bag images: a themed drawstring sack per deck (swap-bag silhouette, mask-tinted to
// the deck's colour). Effects (sparkle / glow / echo ghost-trail) only on the "special" bags; the
// basic bags (standard / vowelHeavy / lean) are plain coloured sacks. Masks are inline so the path
// resolves at the document root (not relative to src/style.css).
const BAG_MASK = "-webkit-mask:url('assets/icons/bags/swap-bag.svg') center/contain no-repeat;mask:url('assets/icons/bags/swap-bag.svg') center/contain no-repeat";
const BAG_THEMES = {
  standard:   { g: 'linear-gradient(155deg,#b89058,#6e5230)' },                                  // leather
  vowelHeavy: { g: 'linear-gradient(155deg,#e2bd6a,#a87c2c)' },                                  // honey
  wildcard:   { g: 'linear-gradient(155deg,#ecd180,#9c7a1e)', fx: 'spark', glow: '#ecd180' },    // gold + sparkle
  rareRich:   { g: 'linear-gradient(155deg,#b3a0ee,#6a55c0)', fx: 'glow spark', glow: '#8a7fd6' }, // violet + glow/sparkle
  doubled:    { g: 'linear-gradient(155deg,#79d8c0,#2c8a73)', fx: 'echo', glow: '#4fb89c' },      // teal + echo trail
  lean:       { g: 'linear-gradient(155deg,#aeb8ca,#586a86)' },                                  // steel
};
const BAG_FALLBACK = { g: 'linear-gradient(155deg,#b89058,#6e5230)' };

export function bagHtml(deckId) {
  const t = BAG_THEMES[deckId] || BAG_FALLBACK;
  const fx = t.fx || '';
  const glow = t.glow ? `--glow:${t.glow};` : '';
  const ghosts = /echo/.test(fx)
    ? `<span class="bag bag-ghost g1" style="--g:${t.g};${BAG_MASK}"></span><span class="bag bag-ghost g2" style="--g:${t.g};${BAG_MASK}"></span>`
    : '';
  const spark = /spark/.test(fx) ? '<span class="bag-spark">&#10022;</span>' : '';
  return `<span class="bag-wrap ${fx}" style="${glow}" aria-hidden="true">${ghosts}<span class="bag" style="--g:${t.g};${BAG_MASK}"></span>${spark}</span>`;
}
