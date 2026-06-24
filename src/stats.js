// src/stats.js — pure, analytic statistics for the eval harness. No rng, deterministic.

// Standard normal CDF via the Abramowitz-Stegun erf approximation (max error ~1.5e-7).
function erf(x) {
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
function phi(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
function twoSidedP(z) { return 2 * (1 - phi(Math.abs(z))); }

export function wilsonInterval(k, n, z = 1.96) {
  if (n === 0) return { p: 0, low: 0, high: 0 };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return { p, low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

export function mcnemar(wonA, wonB) {
  let b = 0, c = 0;
  for (let i = 0; i < wonA.length; i++) {
    if (wonA[i] && !wonB[i]) b++;
    else if (!wonA[i] && wonB[i]) c++;
  }
  if (b + c === 0) return { b, c, z: 0, p: 1 };
  const z = (Math.abs(b - c) - 1) / Math.sqrt(b + c);
  return { b, c, z, p: twoSidedP(z) };
}

export function normalCI(values, z = 1.96) {
  const n = values.length;
  if (n === 0) return { mean: 0, low: 0, high: 0 };
  const mean = values.reduce((a, x) => a + x, 0) / n;
  const variance = values.reduce((a, x) => a + (x - mean) ** 2, 0) / Math.max(1, n - 1);
  const se = Math.sqrt(variance / n);
  return { mean, low: mean - z * se, high: mean + z * se };
}
