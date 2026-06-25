// src/icons.js — UI-only presentation layer for icons. NO game rules, browser-agnostic markup
// (returns HTML strings). Tier-A elements (relics, bosses, achievements, Meta currency) render as
// an engraved aged-gold WAX SEAL; Tier-B/general UI uses Tabler line icons elsewhere. See the
// `visual-assets-decided` memory + assets/icons/CREDITS.md (game-icons.net, CC BY 3.0).
//
// Most relics map to a glyph SVG at assets/icons/relics/relic-<id>.svg (recolored via CSS mask).
// Vowel-semantic relics use a struck Zilla Slab letterform instead of a pictogram.

const LETTER_RELICS = { vowelBonus: 'A' };  // typographic struck letter, not a pictogram

// A relic's struck-gold seal mark. `size` is 'sm' (in-line tray) or 'md' (shop offer).
// aria-hidden: the relic name always sits beside it as the accessible label.
export function relicSealHtml(relicId, { size = 'sm' } = {}) {
  if (!relicId) return '';
  const letter = LETTER_RELICS[relicId];
  // Mask is set INLINE (resolves against the document at the web root), not via a custom property
  // consumed by src/style.css — a url() in a custom property resolves relative to the *consuming*
  // stylesheet (/src/) in Chrome, which 404s. Inline keeps the path document-relative like index.html.
  const src = `assets/icons/relics/relic-${relicId}.svg`;
  const inner = letter
    ? `<span class="seal-letter">${letter}</span>`
    : `<span class="seal-glyph" style="-webkit-mask:url('${src}') center/contain no-repeat;mask:url('${src}') center/contain no-repeat"></span>`;
  return `<span class="relic-seal relic-seal--${size}" aria-hidden="true">${inner}</span>`;
}
