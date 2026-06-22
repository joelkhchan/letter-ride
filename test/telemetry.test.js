import { test } from 'node:test';
import assert from 'node:assert';
import {
  makeTelemetry, loadTelemetry, saveTelemetry,
  recordOffers, recordPurchase, recordPlay, recordRunEnd, summarize,
} from '../src/telemetry.js';

const fakeStorage = () => {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } };
};

test('makeTelemetry returns correct shape with zero values', () => {
  const t = makeTelemetry();
  assert.deepEqual(t, { items: {}, plays: 0, totalWordLen: 0, runs: 0, wins: 0 });
});

test('loadTelemetry on absent key returns fresh', () => {
  const s = fakeStorage();
  const t = loadTelemetry(s);
  assert.deepEqual(t, makeTelemetry());
});

test('loadTelemetry on corrupt JSON returns fresh (no throw)', () => {
  const s = fakeStorage();
  s.setItem('letterRide.telemetry', '{bad json');
  const t = loadTelemetry(s);
  assert.deepEqual(t, makeTelemetry());
});

test('saveTelemetry / loadTelemetry round-trip preserves all fields', () => {
  const s = fakeStorage();
  const t = makeTelemetry();
  t.plays = 5;
  t.totalWordLen = 25;
  t.runs = 3;
  t.wins = 2;
  t.items['relicA'] = { offered: 4, purchased: 2, runsWith: 2, winsWith: 1 };
  saveTelemetry(t, s);
  const back = loadTelemetry(s);
  assert.equal(back.plays, 5);
  assert.equal(back.totalWordLen, 25);
  assert.equal(back.runs, 3);
  assert.equal(back.wins, 2);
  assert.deepEqual(back.items['relicA'], { offered: 4, purchased: 2, runsWith: 2, winsWith: 1 });
});

test('recordOffers lazily inits items and increments offered', () => {
  const t = makeTelemetry();
  recordOffers(t, ['relicA', 'relicB']);
  assert.equal(t.items['relicA'].offered, 1);
  assert.equal(t.items['relicB'].offered, 1);
  assert.equal(t.items['relicA'].purchased, 0);
  // Call again — offered increments, not reset.
  recordOffers(t, ['relicA']);
  assert.equal(t.items['relicA'].offered, 2);
  assert.equal(t.items['relicB'].offered, 1);
});

test('recordPurchase increments purchased (lazily inits)', () => {
  const t = makeTelemetry();
  recordPurchase(t, 'modX');
  assert.equal(t.items['modX'].purchased, 1);
  assert.equal(t.items['modX'].offered, 0);
  recordPurchase(t, 'modX');
  assert.equal(t.items['modX'].purchased, 2);
});

test('recordPlay accumulates plays and totalWordLen', () => {
  const t = makeTelemetry();
  recordPlay(t, 4);
  assert.equal(t.plays, 1);
  assert.equal(t.totalWordLen, 4);
  recordPlay(t, 6);
  assert.equal(t.plays, 2);
  assert.equal(t.totalWordLen, 10);
});

test('recordRunEnd with won=true increments runs, wins, runsWith, winsWith', () => {
  const t = makeTelemetry();
  recordRunEnd(t, { won: true, ownedIds: ['relicA', 'modB'] });
  assert.equal(t.runs, 1);
  assert.equal(t.wins, 1);
  assert.equal(t.items['relicA'].runsWith, 1);
  assert.equal(t.items['relicA'].winsWith, 1);
  assert.equal(t.items['modB'].runsWith, 1);
  assert.equal(t.items['modB'].winsWith, 1);
});

test('recordRunEnd with won=false increments runs and runsWith; does NOT increment wins/winsWith', () => {
  const t = makeTelemetry();
  recordRunEnd(t, { won: false, ownedIds: ['relicA'] });
  assert.equal(t.runs, 1);
  assert.equal(t.wins, 0);
  assert.equal(t.items['relicA'].runsWith, 1);
  assert.equal(t.items['relicA'].winsWith, 0);
});

test('summarize computes correct pickRate, winRate, avgWordLen after a realistic sequence', () => {
  const t = makeTelemetry();

  // Offer relicA and relicB
  recordOffers(t, ['relicA', 'relicB']);
  // Purchase relicA
  recordPurchase(t, 'relicA');
  // Play word length 4
  recordPlay(t, 4);
  // Play word length 6
  recordPlay(t, 6);
  // endRun won=true, ownedIds=[relicA]
  recordRunEnd(t, { won: true, ownedIds: ['relicA'] });
  // endRun won=false, ownedIds=[relicA, relicB]
  recordRunEnd(t, { won: false, ownedIds: ['relicA', 'relicB'] });

  const s = summarize(t);

  // avgWordLen: (4+6)/2 = 5
  assert.equal(s.avgWordLen, 5);
  // winRate: 1/2 = 0.5
  assert.equal(s.winRate, 0.5);
  assert.equal(s.runs, 2);
  assert.equal(s.wins, 1);

  const relicA = s.items.find(i => i.id === 'relicA');
  const relicB = s.items.find(i => i.id === 'relicB');

  assert.ok(relicA, 'relicA should be in items');
  assert.ok(relicB, 'relicB should be in items');

  // relicA offered=1, purchased=1 → pickRate=1.0
  assert.equal(relicA.pickRate, 1.0);
  // relicA runsWith=2, winsWith=1 → winRate=0.5
  assert.equal(relicA.winRate, 0.5);

  // relicB offered=1, purchased=0 → pickRate=0
  assert.equal(relicB.pickRate, 0);
  // relicB runsWith=1, winsWith=0 → winRate=0
  assert.equal(relicB.winRate, 0);
});
