// src/telemetry.js — local balance telemetry. Pure functions; storage injected.
import { ARCHETYPES, ALL_ARCHETYPE_IDS } from './archetypes.js';

const TELEM_KEY = 'letterRide.telemetry';

export function makeTelemetry() {
  // letters: per-letter usage (played in a scored word vs discarded) — surfaces dead-weight tiles.
  // discards: count of discard actions taken.
  return { items: {}, plays: 0, totalWordLen: 0, runs: 0, wins: 0, archetypes: {}, letters: {}, discards: 0 };
}

function initItem(t, id) {
  if (!t.items[id]) t.items[id] = { offered: 0, purchased: 0, runsWith: 0, winsWith: 0 };
}

function initLetter(t, L) {
  if (!t.letters[L]) t.letters[L] = { played: 0, discarded: 0 };
}

function initArchetype(t, id) {
  if (!t.archetypes[id]) t.archetypes[id] = { plays: 0, totalScore: 0 };
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
      archetypes: data.archetypes || {},
      letters: data.letters || {},
      discards: data.discards || 0,
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

// recordPlay now takes (t, ctx, score) where ctx = { letters, word, selection, wordsPlayedThisRound, enablers }.
// wordLength is derived from ctx.letters.length to preserve avgWordLen telemetry.
export function recordPlay(t, ctx, score = 0) {
  const wordLength = ctx.letters.length;
  t.plays++;
  t.totalWordLen += wordLength;

  // Per-letter usage: count each letter played in this scored word.
  if (!t.letters) t.letters = {};
  for (const raw of ctx.letters) {
    const L = String(raw).toUpperCase();
    initLetter(t, L);
    t.letters[L].played++;
  }

  // Classify the play against every archetype and accumulate per-archetype stats.
  for (const id of ALL_ARCHETYPE_IDS) {
    if (ARCHETYPES[id].matches(ctx)) {
      initArchetype(t, id);
      t.archetypes[id].plays++;
      t.archetypes[id].totalScore += score;
    }
  }
}

// One discard action of `letters` (an array of letter chars). Counts the action + each tile dumped.
export function recordDiscard(t, letters = []) {
  t.discards = (t.discards || 0) + 1;
  if (!t.letters) t.letters = {};
  for (const raw of letters) {
    const L = String(raw).toUpperCase();
    initLetter(t, L);
    t.letters[L].discarded++;
  }
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
    archetypes: Object.entries(t.archetypes).map(([id, at]) => ({
      id,
      plays: at.plays,
      playShare: t.plays > 0 ? at.plays / t.plays : 0,
      avgScore: at.plays > 0 ? at.totalScore / at.plays : 0,
    })),
    discards: t.discards || 0,
    letters: Object.entries(t.letters || {}).map(([letter, lt]) => ({
      letter,
      played: lt.played,
      discarded: lt.discarded,
      // discardRate: of every time this letter was committed (played or dumped), how often dumped.
      discardRate: (lt.played + lt.discarded) > 0 ? lt.discarded / (lt.played + lt.discarded) : 0,
    })).sort((a, b) => (b.played + b.discarded) - (a.played + a.discarded)),
  };
}
