# Fonts — Phase 4 letterpress reskin

Self-hosted OFL faces, bundled for the offline Android (Capacitor) target. Wired via `@font-face`
in `src/style.css` (Phase 4 SP1) with a system-serif fallback, so the UI works before/without them.

- **Rye** (`rye-latin-400.woff2`) — a woodtype / wood-type display face. The hero: score, headers,
  the big poster numerals.
- **Zilla Slab** (`zilla-slab-latin-400.woff2`, `zilla-slab-latin-700.woff2`) — a warm slab serif
  for body text (regular + bold).

Both are licensed under the **SIL Open Font License (OFL)** (free to bundle + redistribute). Sourced
from the `@fontsource/rye` and `@fontsource/zilla-slab` packages via jsDelivr.
