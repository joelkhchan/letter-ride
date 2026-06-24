export function makeRng(seed) {
  let a = seed >>> 0;
  const rng = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // getState mirrors setState's unsigned coercion so state round-trips exactly
  // (setState(getState()) is identity). The generator does `a |= 0` on first use,
  // so the unsigned and signed 32-bit forms are equivalent for the sequence.
  rng.getState = () => a >>> 0;
  rng.setState = (s) => { a = s >>> 0; };
  return rng;
}

export function shuffle(array, rng) {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
