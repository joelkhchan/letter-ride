// src/telemetry.js — local balance telemetry. Pure functions; storage injected.
const TELEM_KEY = 'letterRide.telemetry';

export function makeTelemetry() {
  return { items: {}, plays: 0, totalWordLen: 0, runs: 0, wins: 0 };
}

function initItem(t, id) {
  if (!t.items[id]) t.items[id] = { offered: 0, purchased: 0, runsWith: 0, winsWith: 0 };
}

export function loadTelemetry(storage) {
  const raw = storage.getItem(TELEM_KEY);
  if (!raw) return makeTelemetry();
  try {
    const data = JSON.parse(raw);
    // Basic shape check — must have the root fields.
    if (typeof data !== 'object' || data === null) return makeTelemetry();
    return {
      items: data.items || {},
      plays: data.plays || 0,
      totalWordLen: data.totalWordLen || 0,
      runs: data.runs || 0,
      wins: data.wins || 0,
    };
  } catch {
    return makeTelemetry();
  }
}

export function saveTelemetry(t, storage) {
  storage.setItem(TELEM_KEY, JSON.stringify(t));
}

export function recordOffers(t, ids) {
  for (const id of ids) {
    initItem(t, id);
    t.items[id].offered++;
  }
}

export function recordPurchase(t, id) {
  initItem(t, id);
  t.items[id].purchased++;
}

export function recordPlay(t, wordLength) {
  t.plays++;
  t.totalWordLen += wordLength;
}

export function recordRunEnd(t, { won, ownedIds }) {
  t.runs++;
  if (won) t.wins++;
  for (const id of ownedIds) {
    initItem(t, id);
    t.items[id].runsWith++;
    if (won) t.items[id].winsWith++;
  }
}

export function summarize(t) {
  return {
    avgWordLen: t.plays > 0 ? t.totalWordLen / t.plays : 0,
    runs: t.runs,
    wins: t.wins,
    winRate: t.runs > 0 ? t.wins / t.runs : 0,
    items: Object.entries(t.items).map(([id, it]) => ({
      id,
      offered: it.offered,
      purchased: it.purchased,
      pickRate: it.offered > 0 ? it.purchased / it.offered : 0,
      runsWith: it.runsWith,
      winsWith: it.winsWith,
      winRate: it.runsWith > 0 ? it.winsWith / it.runsWith : 0,
    })),
  };
}
