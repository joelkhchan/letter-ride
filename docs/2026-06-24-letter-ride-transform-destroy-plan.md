# Tile Transform / Destroy (Phase 3, SP2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two bag-shaping shop tools — **Recast** (change a chosen tile's letter, keeping its id + mods) and **Transfer** (destroy a tile, moving its mods onto another) — plus the multi-step shop picker UI they need.

**Architecture:** Both are new `purchase` cases in [src/shop.js](src/shop.js) that mutate `run.bag` (the same shape as `enchantTile`/`thinLetter`); no scoring/engine change. The shop's one-tile picker in [src/ui.js](src/ui.js) is generalized to collect multi-step selections (Recast: tile then letter; Transfer: source tile then target tile), and `onBuy` in [src/main.js](src/main.js) changes from a positional `targetTileId` to an `opts` object forwarded to `purchase`.

**Tech Stack:** Vanilla JS ESM, no build step. `node --test` via `npm test`. UI is verified manually (no DOM unit tests). Design: [docs/2026-06-24-letter-ride-transform-destroy-design.md](2026-06-24-letter-ride-transform-destroy-design.md).

## Global Constraints

- **No scoring/engine change.** `scoring.js`, `run.js` `playWord`, `bosses.js`, `events.js` are untouched. These tools are bag mutations only.
- **Recast keeps the tile's `id` and `mods`;** only `letter` changes. Reject a `targetLetter` outside `run.config.SHOP.buyableLetters` (`bad-letter`).
- **Transfer** appends the source's mods to the target then removes the source; reject `source === target` (`same-tile`) and a missing tile (`no-target`).
- **No save-schema bump.** Both tools mutate fields already serialized (`{ id, letter, modIds }`); schema stays at version 5. Do not touch `storage.js` logic.
- **Costs are tunable, author-owned.** Starting points: `recastTile: 5`, `transferMods: 5` (in line with `enchantTile: 6`, `thinLetter: 3`). Do not treat as final.
- **No em dashes** in any player-facing label/desc (house rule).
- **Do NOT fix the known shop-refresh-on-buy behavior** (main.js `onBuy` regenerates the shop after a buy). It is a separately-flagged deferred bug; leave it exactly as-is so this sub-project stays scoped.
- **Preserve the existing `enchantTile`/`thinLetter` picker behavior** unchanged through the refactor.

---

### Task 1: Recast + Transfer purchase logic

**Files:**
- Modify: `src/config.js` (add two SHOP costs)
- Modify: `src/shop.js` (`generateShop` candidates + two `purchase` cases)
- Test: `test/shop.test.js` (extend)

**Interfaces:**
- Consumes: `run.bag` (`.tiles`, `.remove(id)`), `run.config.SHOP.buyableLetters`, the existing `purchase(run, offer, opts)` shape (`opts.targetTileId` already used by `enchantTile`/`thinLetter`).
- Produces (consumed by Task 2): offers `{ type: 'recastTile', cost }` resolved with `opts = { targetTileId, targetLetter }`; `{ type: 'transferMods', cost }` resolved with `opts = { sourceTileId, targetTileId }`.

- [ ] **Step 1: Write the failing tests**

In `test/shop.test.js`, add `recastTile` + `transferMods` to the test config's `SHOP.cost` (the object on the `cost:` line) so it reads:
`cost: { buyLetter:3, buyEnchantedTile:7, enchantTile:6, upgradeLetter:5, thinLetter:3, buyRelic:8, recastTile:5, transferMods:5 }`

Then add these tests:

```js
test('recastTile changes the target tile letter, keeps id + mods, deducts cost', () => {
  const run = mkRun();
  const t = run.bag.tiles[0];
  t.mods = [getMod('polished')];
  const id = t.id;
  const before = run.coins;
  const res = purchase(run, { type: 'recastTile', cost: 5 }, { targetTileId: id, targetLetter: 'R' });
  assert.equal(res.ok, true);
  const after = run.bag.tiles.find(x => x.id === id);
  assert.equal(after.letter, 'R');         // letter changed
  assert.equal(after.id, id);              // id preserved
  assert.equal(after.mods.length, 1);      // mods preserved
  assert.equal(run.coins, before - 5);
});

test('recastTile rejects a letter outside the shop pool', () => {
  const run = mkRun();   // test config buyableLetters = ['E','A','R','Z']
  const res = purchase(run, { type: 'recastTile', cost: 5 }, { targetTileId: run.bag.tiles[0].id, targetLetter: 'Q' });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'bad-letter');
});

test('recastTile with a missing target tile errors', () => {
  const run = mkRun();
  const res = purchase(run, { type: 'recastTile', cost: 5 }, { targetTileId: 'nope', targetLetter: 'R' });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'no-target');
});

test('transferMods moves source mods to target and destroys the source', () => {
  const run = mkRun();
  const src = run.bag.tiles[0];
  const tgt = run.bag.tiles[1];
  src.mods = [getMod('polished'), getMod('catalyst')];
  const tgtBefore = tgt.mods.length;
  const srcId = src.id, tgtId = tgt.id;
  const bagBefore = run.bag.tiles.length;
  const before = run.coins;
  const res = purchase(run, { type: 'transferMods', cost: 5 }, { sourceTileId: srcId, targetTileId: tgtId });
  assert.equal(res.ok, true);
  assert.equal(run.bag.tiles.find(x => x.id === srcId), undefined);        // source destroyed
  assert.equal(run.bag.tiles.find(x => x.id === tgtId).mods.length, tgtBefore + 2);  // mods moved
  assert.equal(run.bag.tiles.length, bagBefore - 1);
  assert.equal(run.coins, before - 5);
});

test('transferMods rejects source === target and a missing tile', () => {
  const run = mkRun();
  const id = run.bag.tiles[0].id;
  assert.equal(purchase(run, { type: 'transferMods', cost: 5 }, { sourceTileId: id, targetTileId: id }).reason, 'same-tile');
  assert.equal(purchase(run, { type: 'transferMods', cost: 5 }, { sourceTileId: 'nope', targetTileId: id }).reason, 'no-target');
});

test('generateShop candidate pool includes recastTile + transferMods', () => {
  const run = mkRun();
  run.config = { ...config, SHOP: { ...config.SHOP, offersPerShop: 99 } };   // return all candidates
  const shop = generateShop(run, run.rng);
  const types = new Set(shop.offers.map(o => o.type));
  assert.ok(types.has('recastTile') && types.has('transferMods'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: the new tests FAIL (`recastTile`/`transferMods` are unknown offer types → `purchase` returns `{ ok:false, reason:'unknown' }`; pool test missing the types).

- [ ] **Step 3: Add the config costs**

In `src/config.js`, change the SHOP `cost` line to add the two costs:

```js
    cost: { buyLetter: 3, buyEnchantedTile: 7, enchantTile: 6, upgradeLetter: 5, thinLetter: 3, buyRelic: 8, recastTile: 5, transferMods: 5 },
```

- [ ] **Step 4: Add the generateShop candidates**

In `src/shop.js` `generateShop`, after the `thinLetter` candidate line (`candidates.push({ type: 'thinLetter', cost: cfg.cost.thinLetter });`), add:

```js
  candidates.push({ type: 'recastTile', cost: cfg.cost.recastTile });
  candidates.push({ type: 'transferMods', cost: cfg.cost.transferMods });
```

- [ ] **Step 5: Add the purchase cases**

In `src/shop.js` `purchase`, inside the `switch (offer.type)`, add these two cases (e.g. after the `thinLetter` case). `findTarget` (already defined as `() => run.bag.tiles.find(t => t.id === opts.targetTileId)`) resolves the recast target and the transfer *target*:

```js
    case 'recastTile': {
      const t = findTarget(); if (!t) return { ok: false, reason: 'no-target' };
      if (!run.config.SHOP.buyableLetters.includes(opts.targetLetter)) return { ok: false, reason: 'bad-letter' };
      t.letter = opts.targetLetter; break;
    }
    case 'transferMods': {
      const src = run.bag.tiles.find(t => t.id === opts.sourceTileId);
      const tgt = run.bag.tiles.find(t => t.id === opts.targetTileId);
      if (!src || !tgt) return { ok: false, reason: 'no-target' };
      if (src.id === tgt.id) return { ok: false, reason: 'same-tile' };
      tgt.mods.push(...src.mods);
      run.bag.remove(src.id); break;
    }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (new shop tests + all pre-existing).

- [ ] **Step 7: Commit**

```bash
git add src/config.js src/shop.js test/shop.test.js
git commit -m "feat: Recast + Transfer shop tools (transform a tile's letter; move mods + destroy)"
```

---

### Task 2: Multi-step shop picker UI

**Files:**
- Modify: `src/ui.js` (generalize the picker; add Recast/Transfer pickers; offer labels)
- Modify: `src/main.js` (`onBuy` takes an `opts` object)

**Interfaces:**
- Consumes: `handlers.onBuy(offer, opts)`, `run.config.SHOP.buyableLetters`, `run.bag.tiles`.
- Produces: `onBuy(offer, opts)` forwards `opts` verbatim to `purchase`. Recast resolves `{ targetTileId, targetLetter }`; Transfer resolves `{ sourceTileId, targetTileId }`; enchant/thin still resolve `{ targetTileId }`.

This task touches `ui.js` and `main.js` together (the picker's new `onBuy(offer, {targetTileId})` call and `onBuy`'s new signature must land atomically, or enchant/thin breaks). UI is verified by the browser smoke in Step 5 (no DOM unit test, per project convention).

- [ ] **Step 1: Add the two offer labels**

In `src/ui.js` `offerLabel`, add two cases (before `default:`):

```js
    case 'recastTile':       return `Recast a tile to a letter you choose · $${offer.cost}`;
    case 'transferMods':     return `Move a tile's mods onto another (destroys it) · $${offer.cost}`;
```

- [ ] **Step 2: Generalize the picker**

In `src/ui.js`, REPLACE the whole `showTilePicker` function (the one that builds `#tile-picker-overlay`) with these helpers + the three pickers:

```js
// Build a modal overlay with a title and a set of choice buttons. choices = [{label, title?, onPick}].
function buildPickOverlay(titleText, choices) {
  const old = document.getElementById('tile-picker-overlay');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.id = 'tile-picker-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;z-index:100;';
  const title = document.createElement('div');
  title.textContent = titleText;
  title.style.cssText = 'color:#fff;font-weight:bold;font-size:1.1em;';
  overlay.appendChild(title);
  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:320px;';
  choices.forEach(c => {
    const btn = document.createElement('button');
    btn.textContent = c.label;
    if (c.title) btn.title = c.title;
    btn.style.cssText = 'padding:10px 14px;font-size:1em;border-radius:6px;cursor:pointer;';
    btn.onclick = () => { overlay.remove(); c.onPick(); };
    grid.appendChild(btn);
  });
  overlay.appendChild(grid);
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.style.cssText = 'margin-top:8px;padding:8px 20px;font-size:0.95em;border-radius:6px;cursor:pointer;';
  cancel.onclick = () => overlay.remove();
  overlay.appendChild(cancel);
  document.body.appendChild(overlay);
}

// Choice list for bag tiles, optionally excluding one id (e.g. the transfer source).
function tileChoices(run, onPick, excludeId) {
  return run.bag.tiles.filter(t => t.id !== excludeId).map(tile => {
    const modsLabel = tile.mods && tile.mods.length ? ` [${tile.mods.map(m => m.name || m.id[0].toUpperCase()).join(', ')}]` : '';
    return {
      label: tile.letter + modsLabel,
      title: tile.mods && tile.mods.length ? tile.mods.map(m => `${m.name || m.id}: ${m.desc || ''}`).join('; ') : undefined,
      onPick: () => onPick(tile),
    };
  });
}

function reportBuy(res) {
  if (res && !res.ok) {
    const msg = document.getElementById('msg');
    if (msg) msg.textContent = 'Purchase failed: ' + (res.reason || 'unknown');
  }
}

// enchant/thin: single tile pick.
function showTilePicker(run, offer) {
  const titleText = offer.type === 'thinLetter' ? 'Remove which tile?' : 'Enchant which tile?';
  buildPickOverlay(titleText, tileChoices(run, (tile) => reportBuy(handlers.onBuy?.(offer, { targetTileId: tile.id }))));
}

// recast: pick tile, then pick a letter from the shop pool.
function showRecastPicker(run, offer) {
  buildPickOverlay('Recast which tile?', tileChoices(run, (tile) => {
    buildPickOverlay(`Recast ${tile.letter} to which letter?`, run.config.SHOP.buyableLetters.map(L => ({
      label: L,
      onPick: () => reportBuy(handlers.onBuy?.(offer, { targetTileId: tile.id, targetLetter: L })),
    })));
  }));
}

// transfer: pick source (destroyed), then target (receives the mods).
function showTransferPicker(run, offer) {
  buildPickOverlay('Melt down which tile? (its mods move on)', tileChoices(run, (src) => {
    buildPickOverlay('Move its mods onto which tile?', tileChoices(run, (tgt) =>
      reportBuy(handlers.onBuy?.(offer, { sourceTileId: src.id, targetTileId: tgt.id })), src.id));
  }));
}
```

- [ ] **Step 3: Route the new offer types to their pickers**

In `src/ui.js`, the offer-button onclick currently reads:

```js
    btn.onclick = () => {
      if (needsTilePicker(offer)) {
        showTilePicker(run, offer);
      } else {
        const res = handlers.onBuy?.(offer);
        if (res && !res.ok) {
          const msg = document.getElementById('msg');
          if (msg) msg.textContent = 'Purchase failed: ' + (res.reason || 'unknown');
        }
      }
    };
```

Replace it with:

```js
    btn.onclick = () => {
      if (offer.type === 'recastTile') showRecastPicker(run, offer);
      else if (offer.type === 'transferMods') showTransferPicker(run, offer);
      else if (needsTilePicker(offer)) showTilePicker(run, offer);
      else reportBuy(handlers.onBuy?.(offer));
    };
```

- [ ] **Step 4: Update `onBuy` to take an opts object**

In `src/main.js`, change the `onBuy` handler signature + the `purchase` call:

```js
    onBuy(offer, opts = {}) {
      const r = purchase(run, offer, opts);
```

(the rest of the `onBuy` body — telemetry, `run.shop = generateShop(...)`, `saveAll(); render(); return r;` — is unchanged).

- [ ] **Step 5: Browser smoke (no DOM unit test)**

Run: `npm test` (confirm still green: the refactor must not break any existing test).
Then `npm run serve`, open on desktop. Verify, with no console errors:
- **Recast:** an offer "Recast a tile to a letter you choose" opens a tile picker, then a letter picker; after picking, the chosen bag tile becomes the chosen letter (check the next rack/bag).
- **Transfer:** "Move a tile's mods onto another" opens a source picker then a target picker; the target gains the source's mods and the source is gone.
- **Regression:** `enchantTile` and `thinLetter` still pick one tile and work as before.

- [ ] **Step 6: Commit**

```bash
git add src/ui.js src/main.js
git commit -m "feat: multi-step shop picker for Recast (tile+letter) + Transfer (source+target); onBuy takes opts"
```

---

### Task 3: Persistence round-trip + harness regression

**Files:**
- Test: `test/storage.test.js` (extend — one round-trip test)
- No `src/` change.

- [ ] **Step 1: Write a persistence round-trip test**

In `test/storage.test.js`, mirroring the file's existing save/load fixture style (a fake localStorage + `saveRun`/`loadRun` with `{ config, dictionary }`), add a test that a recast letter and transferred mods survive a save/load:

```js
test('recast letter and transferred mods persist across save/load', () => {
  const run = mkRun();                       // use the file's existing run factory/fixture
  // recast a tile, and stack two mods onto another
  const a = run.bag.tiles[0], b = run.bag.tiles[1];
  a.letter = 'Z';
  b.mods = [getMod('polished'), getMod('catalyst')];
  const aId = a.id, bId = b.id;
  saveRun(run, store);                        // `store` = the file's fake localStorage
  const loaded = loadRun(store, { config, dictionary });
  assert.equal(loaded.bag.tiles.find(t => t.id === aId).letter, 'Z');
  assert.equal(loaded.bag.tiles.find(t => t.id === bId).mods.length, 2);
});
```

Adapt the fixture names (`mkRun`, `store`, `config`, `dictionary`, `getMod`) to whatever `test/storage.test.js` already defines/imports; add a `getMod` import from `../src/tiles.js` if absent. If the file already round-trips tiles with mods, this just adds the letter-change + mod-count assertions.

- [ ] **Step 2: Run the suite**

Run: `npm test`
Expected: PASS (all tests).

- [ ] **Step 3: Harness regression gate (no code)**

Run: `npm run analyze:sim-v2`
Expected: runs clean across all 6 personas (the bot does not use these shop tools, so win-rates stay in the same band — this confirms **no regression**, not balance). Record the output in the SDD ledger.

- [ ] **Step 4: Commit**

```bash
git add test/storage.test.js
git commit -m "test: Recast/Transfer persist across save-load; harness regression verified"
```

---

## Self-Review

- **Spec coverage:** T1 recast offer + free letter choice (Task 1) · T2 recast keeps id+mods (Task 1 test) · T3 transfer offer (Task 1) · T4 transfer append-then-remove + same-tile reject (Task 1 test) · T5 generalized picker + `onBuy(offer, opts)` (Task 2) · T6 no schema bump (Task 3 round-trip, no storage.js change) · T7 engine untouched (no scoring/run change anywhere) · T8 costs in config + recast letters = buyableLetters (Task 1).
- **Placeholder scan:** none — every step has concrete code or an exact command. Task 3's fixture names are explicitly flagged to match the existing test file.
- **Type consistency:** offer types `recastTile`/`transferMods`; opts keys `targetTileId`/`targetLetter`/`sourceTileId`; reasons `no-target`/`bad-letter`/`same-tile`. `onBuy(offer, opts)` ↔ `purchase(run, offer, opts)`. Names consistent across tasks.
- **Edit fidelity:** Task 2 Step 3 quotes the current onclick verbatim (ui.js) for an exact replace; Task 2 Step 2 replaces the whole `showTilePicker` function; Task 1 cites the exact `thinLetter` anchor lines. The known shop-refresh behavior in `onBuy` is intentionally left intact.
