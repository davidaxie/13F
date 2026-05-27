// Style decomposition. A pragmatic substitute for Fama-French that uses
// only the ETF benchmark series we already bundle (no external data fetch).
// Regresses the mirror's weekly excess return on five style factors built
// from SPY / IWM / QQQ / EFA / AGG:
//
//   mirror_excess = α + β_mkt · SPY_excess
//                     + β_size · (IWM - SPY)
//                     + β_growth · (QQQ - SPY)
//                     + β_intl · (EFA - SPY)
//                     + β_bonds · (AGG - SPY)
//                     + ε
//
// β_mkt ≈ 1 → fully equity-tilted; β_size > 0 → small-cap tilt; β_growth > 0
// → growth tilt; β_intl > 0 → international tilt; β_bonds > 0 → bond tilt.
// α is the true alpha after stripping these style exposures — what Fama-
// French would call "skill" rather than "factor return."
//
// This isn't a 1:1 substitute for SMB/HML/RMW/CMA, but it answers the same
// question with data we already have: "is this fund's outperformance
// explained by passive style tilts, or is there something else?"

import type { EquityCurvePoint } from "./backtest";
import benchData from "./benchmark-prices.json";

type Bar = { t: number; c: number };

const BENCH = benchData as Record<string, { bars: Bar[] }>;
const PERIODS_PER_YEAR = 52;
const DEFAULT_RF_ANNUAL = 0.04;

export type FactorKey = "mkt" | "size" | "growth" | "intl" | "bonds";

export const FACTOR_META: Record<
  FactorKey,
  { label: string; description: string }
> = {
  mkt: {
    label: "Market (β)",
    description: "Loading on SPY excess return. 1.0 = moves with the market.",
  },
  size: {
    label: "Size tilt",
    description: "Loading on (IWM − SPY). Positive = small-cap; negative = large-cap.",
  },
  growth: {
    label: "Growth tilt",
    description: "Loading on (QQQ − SPY). Positive = growth/tech; negative = value.",
  },
  intl: {
    label: "International tilt",
    description: "Loading on (EFA − SPY). Positive = developed-international exposure.",
  },
  bonds: {
    label: "Bond tilt",
    description: "Loading on (AGG − SPY). Positive = bond-like (duration); negative = pure equity.",
  },
};

export const FACTOR_ORDER: FactorKey[] = ["mkt", "size", "growth", "intl", "bonds"];

export type FactorDecomposition = {
  // Per-factor loadings + t-stats (|t| > 2 ≈ 95% confidence).
  loadings: Record<FactorKey, { beta: number; tStat: number }>;
  // Annualized intercept (the "true alpha" after style controls).
  alphaAnnualPct: number;
  alphaTStat: number;
  // Goodness-of-fit and sample size.
  r2: number;
  observations: number;
  // Same risk-free rate used elsewhere (4% annual default).
  rfAnnual: number;
};

function priceOnOrBefore(bars: Bar[], unix: number): number | null {
  if (bars.length === 0) return null;
  let lo = 0;
  let hi = bars.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].t <= unix) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? bars[ans].c : null;
}

/**
 * Multivariate OLS: solve β = (X'X)^-1 X'y. Returns null if X'X is singular
 * (rank-deficient predictors, fewer observations than columns).
 *
 * For K=6 (intercept + 5 factors), 4x4 matrix inversion via Gauss-Jordan is
 * trivial — no library needed.
 */
function ols(
  X: number[][],
  y: number[],
): {
  beta: number[];
  tStats: number[];
  r2: number;
} | null {
  const n = X.length;
  if (n === 0) return null;
  const k = X[0].length;
  if (n <= k) return null;

  // X'X (k×k) and X'y (k)
  const XtX: number[][] = Array.from({ length: k }, () =>
    Array(k).fill(0),
  );
  const Xty: number[] = Array(k).fill(0);
  for (let r = 0; r < n; r++) {
    for (let i = 0; i < k; i++) {
      Xty[i] += X[r][i] * y[r];
      for (let j = 0; j < k; j++) XtX[i][j] += X[r][i] * X[r][j];
    }
  }

  const inv = invertMatrix(XtX);
  if (!inv) return null;

  // β = inv(X'X) · X'y
  const beta = Array(k).fill(0) as number[];
  for (let i = 0; i < k; i++) {
    let s = 0;
    for (let j = 0; j < k; j++) s += inv[i][j] * Xty[j];
    beta[i] = s;
  }

  // R² and residual variance
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let r = 0; r < n; r++) {
    let yhat = 0;
    for (let i = 0; i < k; i++) yhat += X[r][i] * beta[i];
    ssRes += (y[r] - yhat) ** 2;
    ssTot += (y[r] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // t-stats (β_i / SE(β_i)); SE_i = √(σ² · inv[i][i]), σ² = SSR/(n-k)
  const sigma2 = ssRes / Math.max(1, n - k);
  const tStats: number[] = [];
  for (let i = 0; i < k; i++) {
    const variance = sigma2 * inv[i][i];
    const se = variance > 0 ? Math.sqrt(variance) : 0;
    tStats.push(se > 0 ? beta[i] / se : 0);
  }
  return { beta, tStats, r2 };
}

function invertMatrix(m: number[][]): number[][] | null {
  const n = m.length;
  // Augmented matrix [M | I]
  const a: number[][] = m.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);
  for (let col = 0; col < n; col++) {
    // Partial pivot
    let pivotRow = col;
    let maxAbs = Math.abs(a[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(a[r][col]);
      if (v > maxAbs) {
        maxAbs = v;
        pivotRow = r;
      }
    }
    if (maxAbs < 1e-12) return null;
    if (pivotRow !== col) {
      [a[col], a[pivotRow]] = [a[pivotRow], a[col]];
    }
    const piv = a[col][col];
    for (let j = 0; j < 2 * n; j++) a[col][j] /= piv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) a[r][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row.slice(n));
}

/**
 * Run the five-factor style decomposition on a mirror equity curve. The
 * curve's `mirror` field is the fund-mirror dollar value over time; the
 * `spy` field is ignored (we re-derive market exposure from the bundled
 * SPY series for self-consistency, since the curve's spy may have been
 * rekeyed to a non-SPY benchmark by the page's switcher).
 */
export function decomposeFactors(
  curve: EquityCurvePoint[],
  rfAnnual: number = DEFAULT_RF_ANNUAL,
): FactorDecomposition | null {
  if (curve.length < 10) return null;

  const rfPerWeek = rfAnnual / PERIODS_PER_YEAR;

  // Helper: weekly return for a benchmark between two curve sample dates.
  function benchReturn(key: string, dateA: string, dateB: string): number | null {
    const bars = BENCH[key]?.bars;
    if (!bars || bars.length === 0) return null;
    const ta = Math.floor(new Date(dateA + "T00:00:00Z").getTime() / 1000);
    const tb = Math.floor(new Date(dateB + "T00:00:00Z").getTime() / 1000);
    const pa = priceOnOrBefore(bars, ta);
    const pb = priceOnOrBefore(bars, tb);
    if (pa == null || pb == null || pa <= 0) return null;
    return pb / pa - 1;
  }

  // Build the design matrix + response vector.
  const X: number[][] = [];
  const y: number[] = [];

  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1];
    const cur = curve[i];
    if (prev.mirror <= 0) continue;
    const mirrorR = cur.mirror / prev.mirror - 1;
    const mktR = benchReturn("SPY", prev.date, cur.date);
    const iwmR = benchReturn("IWM", prev.date, cur.date);
    const qqqR = benchReturn("QQQ", prev.date, cur.date);
    const efaR = benchReturn("EFA", prev.date, cur.date);
    const aggR = benchReturn("AGG", prev.date, cur.date);
    if (
      mktR == null || iwmR == null || qqqR == null ||
      efaR == null || aggR == null
    ) {
      continue;
    }
    // Predictors: intercept (1), SPY excess, IWM-SPY, QQQ-SPY, EFA-SPY, AGG-SPY
    const spyExcess = mktR - rfPerWeek;
    X.push([1, spyExcess, iwmR - mktR, qqqR - mktR, efaR - mktR, aggR - mktR]);
    // Response: mirror excess
    y.push(mirrorR - rfPerWeek);
  }

  if (y.length < 10) return null;

  const result = ols(X, y);
  if (!result) return null;
  const { beta, tStats, r2 } = result;

  // Annualize the per-period intercept. Periods/year is exactly the right
  // multiplier for additive returns (intercept is an additive constant).
  const alphaAnnualPct = beta[0] * PERIODS_PER_YEAR * 100;
  const alphaTStat = tStats[0];

  return {
    loadings: {
      mkt: { beta: beta[1], tStat: tStats[1] },
      size: { beta: beta[2], tStat: tStats[2] },
      growth: { beta: beta[3], tStat: tStats[3] },
      intl: { beta: beta[4], tStat: tStats[4] },
      bonds: { beta: beta[5], tStat: tStats[5] },
    },
    alphaAnnualPct,
    alphaTStat,
    r2,
    observations: y.length,
    rfAnnual,
  };
}
