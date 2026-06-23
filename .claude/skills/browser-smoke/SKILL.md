---
name: browser-smoke
description: Use to verify a Letter Ride UI/build change actually works in the browser (no JS errors, the play loop functions) via the served app + Playwright. The agent's runtime gate after UI/main/scoring changes — distinct from the author's own play-for-fun on phone/desktop. Trigger on "smoke test the build", "does it run in the browser", "verify the UI change", "check for console errors".
---

# Letter Ride — Browser Smoke (Playwright)

Vanilla JS, no build step — the served files load fresh on each page load, so a smoke = serve + drive the real app. This is the **correctness** gate (does it boot + the loop work + no console errors); the **author** judges fun by actually playing.

## Procedure

1. **Serve (background):** `npm run serve` (run in background). It prints `INFO Accepting connections at http://localhost:NNNNN` — read the background task's output file to get the actual port (it varies; not always 3000).
2. **Load the Playwright MCP tools** (they're deferred): `browser_navigate`, `browser_snapshot`, `browser_console_messages`, `browser_click`, `browser_press_key`, `browser_take_screenshot`. (If a prior session left a stale browser, the first `browser_navigate` may error once — just retry it.)
3. **Boot check:** `browser_navigate` to the URL → `browser_console_messages` (level `error`). A `favicon.ico` 404 is the only benign error; **any other console error is a real failure** (the app shows a "Failed to start" message on a boot throw — check for it).
4. **Drive the loop** (re-`browser_snapshot` after each interaction — refs expire on re-render):
   - Snapshot the **meta screen** → confirm bags + meta-shop render → click **Start Run**.
   - Snapshot the **run screen** → confirm the hand (RACK_SIZE tiles with values), the scorebug, the relics/mods/Hone panel, action buttons.
   - **Play a word:** keyboard input works — `browser_press_key` the letters then `Enter` (or tap tiles + Submit). Confirm it scores ("Last: WORD = N Score"), Plays decrements, and (**Model B**) only the *used* tiles are replaced — unused tiles persist + the hand refills to RACK_SIZE.
   - **Discard:** select 1–2 tiles → the Discard button reads `Discard (N)` and enables (disabled with nothing selected) → discarding swaps *only* the selected tiles and spends one discard.
   - Clear a round / Continue → fresh hand next round.
5. **Final check:** `browser_console_messages` (error) once more — still only the favicon 404. Snapshot/screenshot for the record.

## What to look for
- Boot throws (the app catches them into a visible "Failed to start…" message).
- A stale save: after a storage schema bump, an old save loads as `null` → fresh meta screen (expected, not a bug).
- Model B specifics: persistent hand (used tiles consumed + refilled), selective discard, score-preview scorebug.

## Limits
Verifies runtime correctness + the loop, not fun, feel, or balance (those are the author's playtest + the `balance-analysis` harnesses). Don't try to unit-test the DOM — this is the manual-verify path the project uses instead.
