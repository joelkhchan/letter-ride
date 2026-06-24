# Letter Ride — Run Nodes + Events (Phase 2, sub-project 2)

**Date:** 2026-06-23 · **Status:** lean design, **rev. 2 (post spec-review)**. Combines the roadmap's "node variety" + "events" (a node *choice* is only meaningful with events to choose). Builds on the locked Passage structure. Magnitudes + copy are tunable starting points; **event names are proposals for the author to finalize** (copy is author-owned).

**Sequencing note (waived gate, explicit):** the roadmap mandates a playtest between Phase 2 sub-projects. Sub-project 1 (Passages + bosses) is built but **not yet playtested** — the author **consciously waived** this gate ("move on without playtesting, keep going"). Recorded here per the roadmap's sequencing rule, not an oversight.

## 1. The core idea

Today: clearing an encounter auto-shows the Shop, then Continue advances. New: clearing an encounter presents a **node choice** — pick ONE of two:
- **Shop** (the existing full shop), or
- **an Event** (a one-time risk/reward choice).

Picking is mandatory (Shop XOR Event); resolving the node advances to the next encounter. Taking an Event always costs the Shop visit (the baseline opportunity cost), and each event below adds its own intrinsic cost/risk so it is a real decision, not free upside.

## 2. Reconciling the roadmap's node list with our shop

The roadmap floated `shop / event / forge / hone-bench`. Our **Shop already subsumes forge + hone-bench** (it sells letter upgrades, tile enchants, thinning, AND Hone — verified in `shop.js`). **Decision: fold forge/hone into the Shop; the node variety is Shop vs Event.** A fuller StS-style branching map is out of scope (it fights the linear Passage flow).

## 3. Events (starter set — mechanics fixed, names are author-proposals)

A `src/events.js` module: `EVENTS` map + `ALL_EVENT_IDS` + a **seeded run-mutator** `applyEventOption(run, eventId, optionIndex)` (it mutates `run` and draws any randomness from `run.rng` — it is a side-effecting mutator like `playWord`/`discard`, NOT pure). Each event = `{ id, name, desc, options: [{ label, apply(run) }], canOffer(run) }`. The `canOffer` guard keeps an event out of the pool when it cannot meaningfully apply.

Each event states its concrete effect + cost in the option label (legibility, §6). Starter set (5):

| Event (proposed name) | Effect | Intrinsic risk/reward | `canOffer` guard |
|---|---|---|---|
| **The Blank** | Swap 3 random bag tiles for 1 Wild | Gain a flexible wild; bag shrinks by 2 and you lose 3 specific tiles (chosen via `run.rng`) | bag size > `RACK_SIZE + 3` (avoid under-fill) |
| **Lucky Letter** | Pay $3: 50/50 (seeded) for +$8 or nothing | Pure economy gamble | `run.coins >= 3` |
| **Wordsmith** | Gain a free Hone level (you pick the archetype) | A free Hone (~$6 value) vs the Shop's flexibility; commits you to one archetype's scaling | always |
| **Redaction** | Remove 2 tiles of your choice from the bag | Free, targeted thinning vs a Shop screen (no $ sweetener — the trade is "focus the bag vs shop") | bag size > `RACK_SIZE + 2` |
| **Ink Merchant** | Pay $5: gain a random relic you don't own | A random un-owned relic for $5 vs a chosen Shop purchase | `run.coins >= 5` AND an un-owned relic exists |

**Fixes baked in (from the review):**
- **No zero-decision no-brainers:** dropped the "+$2" sweetener on Redaction; every event now has an intrinsic cost/risk on top of the shop opportunity cost.
- **`Ink Merchant` random relic** draws from **un-owned relics only** (reuse the `owned` Set pattern from `shop.js`); if all relics are owned, `canOffer` returns false (the event isn't offered). No dup, no silent no-op.
- **Dropped "lose next round's discards"** entirely (it needed new carry-over state and could combine with The Vise / a drought rack to force an instant loss via the dead-hand rule). Replaced with the flat $5 cost above — no new state, no dead-hand hazard.
- **`The Blank`** is guarded against shrinking the bag below a safe draw size.

## 4. Skip-with-tag: DEFERRED

Balatro's skip-a-blind-for-a-tag is a whole tags system. Deferred to keep this sub-project bounded.

## 5. Integration (scoring + engine untouched)

- **Flow:** on `roundCleared`, pick the **offered event** for this node from a **separate seeded stream** (derived from the run seed + `roundIndex`, e.g. `makeRng((seed ^ 0x... ^ roundIndex) >>> 0)` — same isolation pattern as `bossOrder`, so it does NOT consume `run.rng` and cannot desync the shop), filtered by each event's `canOffer(run)`. Store `run.nodeEventId`. The UI shows two nodes: **Shop** and **Event: <name>**. Pick Shop → the existing shop flow (`generateShop` from `run.rng`, exactly as today). Pick Event → `applyEventOption` resolves (drawing from `run.rng` only when the event needs randomness). Then Continue → `nextRound`.
- **Persistence (corrected — do NOT persist the shop):** the shop is **not** serialized today; `main.js` regenerates it from RNG state on resume. So persist **only `run.nodeEventId`** (a small string). On resume at the node screen, the offered event is restored verbatim (no re-draw), and the shop regenerates from RNG if Shop is chosen — deterministic, no double-draw. **Schema:** verify the CURRENT version in `storage.js` at build time (it is `4`; do NOT trust the doc number) and bump to `5`, guard `!== 5`. Old saves drop gracefully.
- Node logic in `run.js` / a small `nodes` helper + `events.js`. UI in `ui.js`. **No change to `scoring.js` or the boss/engine code.**
- **Harness:** the sim's policy always picks **Shop** (events are a human-facing layer the bot ignores), so `simulateRun` advances via the existing `policy(run); nextRound(run)` path unchanged — verified there is no node concept in `sim.js` to break. (A later increment could add an event-taking policy.) Because the bot never picks events, the harness is blind to event balance — so events are validated by **author play + per-event unit tests**, not the sim (see §8).

## 6. Definitions & legibility (the author's explicit requirement)

Two parts, both required:

**(a) Event legibility.** Each event option's label states its **concrete effect + cost/odds** inline (e.g. "Lucky Letter — Pay $3: 50% +$8, 50% nothing"). Relic-/Hone-granting events surface the granted thing's name + desc **before** commit (reuse `RELICS[id].desc` / `ARCHETYPES[id].desc`). Mirror the boss banner's "no surprise outcomes" rule.

**(b) Touch-friendly definitions for relics / tile-mods / Hone** *(companion legibility task, author-requested).* Today these descs surface ONLY via HTML `title=` hover tooltips + a generic "How it works" overlay that doesn't enumerate them — and **hover does not fire on a touchscreen (the Android target)**, so on-device the player currently cannot read them. Add a **tap-to-reveal** definition: tapping a relic/mod/Hone chip (in the HUD panel and on shop offers) shows its desc in a small inline popover (and the same for an offered event). This is partly Phase 0a legibility work; it's coupled here because events add more opaque effects and the author called it out. (If it bloats this sub-project, it can ship as a small companion task immediately before/with it — but it should not be skipped.)

## 7. Persistence summary

`run.nodeEventId` serialized (string|null); shop NOT serialized (regenerated, as today); schema verify-current-then-bump to 5. Events resolve immediately on pick (no mid-event save state).

## 8. Success criterion (exit gate)

Done = in author play: (1) the **Event node is chosen over the Shop a non-trivial fraction** of the time (events are worth it), (2) **no event feels like a no-brainer** (each is a real decision), and (3) **no event/relic/mod/Hone effect is unreadable on the phone** (the tap-to-reveal definitions work on touch). The eval harness cannot measure (1)/(2) (the bot always shops), so this gate is **author-play + the per-event unit tests** in §9.

## 9. Testing

`test/events.test.js`: per-event unit tests with tiny fixtures (a few-tile bag, a 1-relic pool) asserting each option's effect, that randomness draws from a seeded rng deterministically, and that `canOffer` gates correctly (e.g. Ink Merchant returns false when all relics owned or `coins < 5`). The harness does NOT cover events, so these tests are the only automated guard.

## 10. Decisions (rev. 2)

| # | Decision | Value |
|---|---|---|
| N1 | Node model | 2-way choice (Shop vs Event) after each cleared encounter; mandatory pick |
| N2 | forge/hone-bench | Fold into the Shop (no redundant nodes) |
| N3 | Event set | 5 (The Blank / Lucky Letter / Wordsmith / Redaction / Ink Merchant); each a real tradeoff; **names = author confirms copy** |
| N4 | Skip-with-tag | Defer |
| N5 | Harness | Bot always picks Shop; events validated by author play + unit tests |
| N6 | Persistence | Persist ONLY `run.nodeEventId`; shop regenerates from RNG; verify current schema (4) then bump to 5 |
| N7 | Offered-event RNG | Separate seeded stream (seed ^ roundIndex), NOT `run.rng` — no shop desync |
| N8 | Legibility | Event options show effect+odds inline; **tap-to-reveal definitions for relics/mods/Hone** (hover fails on touch) |
| N9 | Exit gate | Author play: events chosen non-trivially, no no-brainers, all effects readable on phone |

## 11. Out of scope (later)

Skip-with-tag + tags; a branching node map; more events; an event-taking harness policy. Phase 3+ content.
