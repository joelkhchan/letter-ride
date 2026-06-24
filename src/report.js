// src/report.js — pure formatting + baseline-diff helpers. No I/O, no rng.
export function formatPct(x, dp = 1) { return `${(x * 100).toFixed(dp)}%`; }

export function diffSummaries(after, before) {
  return {
    winRateDelta: (after.winRate ?? 0) - (before.winRate ?? 0),
    p10Delta: (after.roundReached?.p10 ?? 0) - (before.roundReached?.p10 ?? 0),
    p50Delta: (after.roundReached?.p50 ?? 0) - (before.roundReached?.p50 ?? 0),
    p90Delta: (after.roundReached?.p90 ?? 0) - (before.roundReached?.p90 ?? 0),
  };
}

function sortKeys(o) {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === 'object') {
    return Object.keys(o).sort().reduce((acc, k) => { acc[k] = sortKeys(o[k]); return acc; }, {});
  }
  return o;
}
export function toJSON(obj) { return JSON.stringify(sortKeys(obj), null, 2); }
