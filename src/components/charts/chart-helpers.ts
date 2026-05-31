export type LinearScale = (v: number) => number;

export function makeScale(
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): LinearScale {
  if (inMax === inMin) return () => (outMin + outMax) / 2;
  const m = (outMax - outMin) / (inMax - inMin);
  return (v: number) => outMin + (v - inMin) * m;
}

export function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  let step: number;
  if (norm < 1.5) step = 1 * mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) {
    ticks.push(Number(v.toPrecision(12)));
  }
  return ticks;
}

export function yearTicks(startIso: string, endIso: string): string[] {
  const startYear = Number(startIso.slice(0, 4));
  const endYear = Number(endIso.slice(0, 4));
  const span = endYear - startYear;
  // Pick step so we get 4-8 ticks
  let step = 1;
  if (span > 25) step = 5;
  else if (span > 12) step = 2;
  const ticks: string[] = [];
  for (let y = startYear; y <= endYear; y += step) {
    ticks.push(`${y}-01-01`);
  }
  if (ticks[ticks.length - 1] !== `${endYear}-01-01`) {
    ticks.push(`${endYear}-01-01`);
  }
  return ticks;
}

export function formatAxisDollar(n: number): string {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatAxisPct(n: number): string {
  if (!isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(0)}%`;
}

export function formatYear(iso: string): string {
  return iso.slice(0, 4);
}

export function buildLinePath(points: Array<[number, number]>): string {
  if (points.length === 0) return "";
  return points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
}

export function buildStepPath(points: Array<[number, number]>): string {
  if (points.length === 0) return "";
  let d = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    const [px] = points[i];
    const [, py0] = points[i - 1];
    const [, py] = points[i];
    d += ` L${px.toFixed(2)},${py0.toFixed(2)} L${px.toFixed(2)},${py.toFixed(2)}`;
  }
  return d;
}

export function buildAreaPath(
  points: Array<[number, number]>,
  baselineY: number,
): string {
  if (points.length === 0) return "";
  const line = buildLinePath(points);
  const lastX = points[points.length - 1][0];
  const firstX = points[0][0];
  return `${line} L${lastX.toFixed(2)},${baselineY.toFixed(2)} L${firstX.toFixed(2)},${baselineY.toFixed(2)} Z`;
}

// mulberry32 — small, stable PRNG. We can't use Math.random() (sandbox blocks
// it) and need a stable seed so SSR/CSR match and renders are reproducible
// across requests for the same input.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a → 32-bit unsigned, used to derive a seed from a string key.
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Cap a series for SVG rendering: returns up to `cap` items uniformly sampled
 * without replacement, using a deterministic per-seed PRNG so the same input
 * renders identically across SSR/CSR and across requests. Returns the array
 * unchanged when it's already within the cap.
 *
 * Fisher-Yates partial shuffle — O(cap), not O(n).
 */
export function seededSample<T>(items: T[], cap: number, seed: string): T[] {
  if (items.length <= cap) return items;
  const rand = mulberry32(hashSeed(seed));
  const arr = items.slice();
  for (let i = 0; i < cap; i++) {
    const j = i + Math.floor(rand() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, cap);
}
