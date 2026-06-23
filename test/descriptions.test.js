import { test } from 'node:test';
import assert from 'node:assert';
import { ARCHETYPES, ALL_ARCHETYPE_IDS } from '../src/archetypes.js';
import { CONFIG } from '../src/config.js';

test('every ARCHETYPES entry has a non-empty desc string', () => {
  for (const id of ALL_ARCHETYPE_IDS) {
    const a = ARCHETYPES[id];
    assert.strictEqual(typeof a.desc, 'string', `ARCHETYPES.${id} missing desc`);
    assert.ok(a.desc.length > 0, `ARCHETYPES.${id}.desc is empty`);
  }
});

test('every CONFIG.DECKS entry has a non-empty desc string', () => {
  for (const id of Object.keys(CONFIG.DECKS)) {
    const d = CONFIG.DECKS[id];
    assert.strictEqual(typeof d.desc, 'string', `CONFIG.DECKS.${id} missing desc`);
    assert.ok(d.desc.length > 0, `CONFIG.DECKS.${id}.desc is empty`);
  }
});
