// Throwaway helper for the icon work (alongside theme-preview.html / icon-preview.html).
// game-icons.net repo SVGs ship a removable background shape as the FIRST element
// (a 512 square <path>, or a disc <circle> for the `badges/` set). We strip it so the glyph
// can be CSS-mask-tinted (aged gold) against our own framing. Detection is CONTENT-BASED
// (not filename), so Tabler / already-clean SVGs pass through untouched.
//
//   node normalize-icons.mjs [srcDir] [outDir]
//   defaults: srcDir=assets/icons/candidates  outDir=<srcDir>/norm
//   pass the same dir twice to normalize in place (e.g. the relics set).
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const srcDir = process.argv[2] || 'assets/icons/candidates';
const outDir = process.argv[3] || `${srcDir}/norm`;
mkdirSync(outDir, { recursive: true });

const BG_SQUARE = /<path d="M0 0h512v512H0z"[^>]*\/>/;          // delapouite/lorc/etc background
const BG_DISC   = /<circle cx="128" cy="128" r="128"[^>]*\/>/;  // badges/ background disc

const report = [];
for (const f of readdirSync(srcDir).filter(n => n.endsWith('.svg'))) {
  let s = readFileSync(`${srcDir}/${f}`, 'utf8');
  const hadSquare = BG_SQUARE.test(s);
  const hadDisc = BG_DISC.test(s);
  s = s.replace(BG_SQUARE, '').replace(BG_DISC, '');
  report.push(`${hadSquare || hadDisc ? 'strip' : 'clean'} ${f}${hadDisc ? ' (disc bg)' : ''}`);
  writeFileSync(`${outDir}/${f}`, s);
}
console.log(`${srcDir} -> ${outDir}\n` + report.join('\n'));
