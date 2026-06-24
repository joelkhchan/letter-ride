# Task 8 Report: runPersona play-policy factory (agentFor)

## What was done

- Added `agentFor = null` to `runPersona`'s destructured params in `src/sim.js`.
- After building the shop `policy` via `buildPurchasePolicy`, an agent is constructed with `const agent = agentFor ? agentFor(policy) : null` and passed through to each `simulateRun` call.
- When `agentFor` is absent (null/undefined), `agent` is null and `simulateRun` runs the legacy greedy path via `policy`/`discardPolicy` — behavior is identical to before.
- `sim.js` does NOT import `agents.js`; the agent arrives via the `agentFor` callback, preserving the one-direction import constraint.
- Added `import { greedyAgent, randomAgent } from '../src/agents.js'` to `test/sim.test.js` (randomAgent was missing from the existing import).
- Added the Task 8 test: `runPersona accepts an agentFor and reports per-seed win flags`.

## TDD steps followed

1. Added failing test (failed with `ReferenceError: randomAgent is not defined` before import fix; then failed cleanly once import was in place and implementation had not yet been added).
2. Implemented the `agentFor` wiring in `runPersona`.
3. Full suite: 211/211 pass, 0 fail.

## Key notes

- The `configB` fixture (used in the test) already has `STARTING_BAG`, so `bagId: 'standard'` resolves correctly without needing `DECKS`.
- The test verifies interface surface (`wonFlags.length === 3`, `typeof winRate === 'number'`) — behavioral correctness of specific agents against specific configs is tested elsewhere (e.g. the greedy-vs-agent parity test at Task 6).
