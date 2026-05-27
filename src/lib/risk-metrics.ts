import type { EquityCurvePoint } from "./backtest";

// The backtest samples the mirror+benchmark portfolios at weekly intervals
// (SAMPLE_DAYS = 7 in backtest.ts), so annualization uses √52.
const PERIODS_PER_YEAR = 52;
const DEFAULT_RF_ANNUAL = 0.04; // ~current 3-month T-bill yield, reasonable default

export type RiskMetrics = {
  // Drawdown
  maxDrawdownPct: number;             // negative number, e.g. -32.5
  maxDrawdownStart: string | null;    // peak date before the trough
  maxDrawdownTrough: string | null;   // trough date
  maxDrawdownRecovered: string | null; // date the mirror first regained the prior peak; null if still underwater

  // Compound annual growth
  cagrPct: number;
  spyCagrPct: number;
  yearsElapsed: number;

  // Volatility (annualized stddev of weekly returns)
  volAnnualPct: number;
  spyVolAnnualPct: number;

  // Risk-adjusted return
  sharpe: number;   // (CAGR − rf) / vol_annual
  sortino: number;  // (CAGR − rf) / downside_vol_annual

  // Benchmark-relative
  betaVsSpy: number;       // cov(rm, rs) / var(rs)
  alphaAnnualPct: number;  // CAGR − (rf + β·(SPY_CAGR − rf))   — CAPM Jensen's alpha
  trackingErrorPct: number; // annualized stddev of (rm − rs)
  informationRatio: number; // (CAGR − SPY_CAGR) / trackingError

  // Capture ratios
  upsideCapture: number;   // mirror's avg return on weeks when SPY > 0, divided by SPY's
  downsideCapture: number; // mirror's avg return on weeks when SPY < 0, divided by SPY's
};

export function computeRiskMetrics(
  curve: EquityCurvePoint[],
  rfAnnual: number = DEFAULT_RF_ANNUAL,
): RiskMetrics | null {
  if (curve.length < 2) return null;

  // ---- Drawdown sweep (mirror equity) ----
  let peak = curve[0].mirror;
  let peakIdx = 0;
  let maxDD = 0;
  let ddStartIdx = 0;
  let ddTroughIdx = 0;

  for (let i = 0; i < curve.length; i++) {
    const v = curve[i].mirror;
    if (v > peak) {
      peak = v;
      peakIdx = i;
    }
    const dd = (v - peak) / peak;
    if (dd < maxDD) {
      maxDD = dd;
      ddStartIdx = peakIdx;
      ddTroughIdx = i;
    }
  }

  // Did the mirror ever recover the pre-max-DD peak after the trough?
  let recoveredAt: string | null = null;
  if (maxDD < 0) {
    const targetPeak = curve[ddStartIdx].mirror;
    for (let i = ddTroughIdx + 1; i < curve.length; i++) {
      if (curve[i].mirror >= targetPeak) {
        recoveredAt = curve[i].date;
        break;
      }
    }
  }

  // ---- Periodic returns ----
  const mirrorRets: number[] = [];
  const spyRets: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prevM = curve[i - 1].mirror;
    const prevS = curve[i - 1].spy;
    if (prevM <= 0 || prevS <= 0) continue;
    const mr = curve[i].mirror / prevM - 1;
    const sr = curve[i].spy / prevS - 1;
    if (!isFinite(mr) || !isFinite(sr)) continue;
    mirrorRets.push(mr);
    spyRets.push(sr);
  }
  const n = mirrorRets.length;
  if (n < 2) return null;

  // ---- Time elapsed ----
  const startMs = new Date(curve[0].date + "T00:00:00Z").getTime();
  const endMs = new Date(
    curve[curve.length - 1].date + "T00:00:00Z",
  ).getTime();
  const yearsElapsed = Math.max(
    1 / 365.25,
    (endMs - startMs) / (365.25 * 86400 * 1000),
  );

  // ---- CAGR ----
  const mirrorTR = curve[curve.length - 1].mirror / curve[0].mirror;
  const spyTR = curve[curve.length - 1].spy / curve[0].spy;
  const cagr = Math.pow(mirrorTR, 1 / yearsElapsed) - 1;
  const spyCagr = Math.pow(spyTR, 1 / yearsElapsed) - 1;

  // ---- Volatility ----
  const meanM = mean(mirrorRets);
  const meanS = mean(spyRets);
  const varM = variance(mirrorRets, meanM);
  const varS = variance(spyRets, meanS);
  const volAnnual = Math.sqrt(varM * PERIODS_PER_YEAR);
  const spyVolAnnual = Math.sqrt(varS * PERIODS_PER_YEAR);

  // ---- Sharpe ----
  const sharpe = volAnnual > 0 ? (cagr - rfAnnual) / volAnnual : 0;

  // ---- Sortino: downside vol only ----
  const downsides = mirrorRets.filter((r) => r < 0);
  const downsideVar =
    downsides.length > 0
      ? downsides.reduce((s, r) => s + r * r, 0) / downsides.length
      : 0;
  const downsideVolAnnual = Math.sqrt(downsideVar * PERIODS_PER_YEAR);
  const sortino =
    downsideVolAnnual > 0 ? (cagr - rfAnnual) / downsideVolAnnual : 0;

  // ---- Beta (cov / var) ----
  let cov = 0;
  for (let i = 0; i < n; i++) {
    cov += (mirrorRets[i] - meanM) * (spyRets[i] - meanS);
  }
  cov /= Math.max(1, n - 1);
  const beta = varS > 0 ? cov / varS : 0;

  // ---- CAPM alpha (Jensen's, annualized) ----
  const alphaAnnual = cagr - (rfAnnual + beta * (spyCagr - rfAnnual));

  // ---- Tracking error + Information ratio ----
  const activeRets: number[] = new Array(n);
  for (let i = 0; i < n; i++) activeRets[i] = mirrorRets[i] - spyRets[i];
  const meanA = mean(activeRets);
  const varA = variance(activeRets, meanA);
  const teAnnual = Math.sqrt(varA * PERIODS_PER_YEAR);
  const infoRatio = teAnnual > 0 ? (cagr - spyCagr) / teAnnual : 0;

  // ---- Capture ratios ----
  let upM = 0, upS = 0, dnM = 0, dnS = 0;
  let upN = 0, dnN = 0;
  for (let i = 0; i < n; i++) {
    if (spyRets[i] > 0) {
      upM += mirrorRets[i];
      upS += spyRets[i];
      upN++;
    } else if (spyRets[i] < 0) {
      dnM += mirrorRets[i];
      dnS += spyRets[i];
      dnN++;
    }
  }
  const upsideCapture = upN > 0 && upS > 0 ? upM / upS : 0;
  const downsideCapture = dnN > 0 && dnS < 0 ? dnM / dnS : 0;

  return {
    maxDrawdownPct: maxDD * 100,
    maxDrawdownStart: maxDD < 0 ? curve[ddStartIdx].date : null,
    maxDrawdownTrough: maxDD < 0 ? curve[ddTroughIdx].date : null,
    maxDrawdownRecovered: recoveredAt,
    cagrPct: cagr * 100,
    spyCagrPct: spyCagr * 100,
    yearsElapsed,
    volAnnualPct: volAnnual * 100,
    spyVolAnnualPct: spyVolAnnual * 100,
    sharpe,
    sortino,
    betaVsSpy: beta,
    alphaAnnualPct: alphaAnnual * 100,
    trackingErrorPct: teAnnual * 100,
    informationRatio: infoRatio,
    upsideCapture,
    downsideCapture,
  };
}

export type RollingAlphaPoint = {
  date: string;
  mirror1yPct: number; // trailing 1y mirror return %
  spy1yPct: number;    // trailing 1y SPY return %
  alphaPct: number;    // mirror1yPct − spy1yPct
};

/**
 * Compute a rolling 1-year alpha series from a weekly equity curve.
 * For each sample i with at least `lookback` prior samples, return the
 * (mirror_return_1y − spy_return_1y) at that date.
 *
 * Default lookback = 52 weeks ≈ 1 calendar year (matches the curve sampling
 * in backtest.ts where SAMPLE_DAYS = 7).
 */
export function computeRollingAlpha(
  curve: EquityCurvePoint[],
  lookback = 52,
): RollingAlphaPoint[] {
  if (curve.length <= lookback) return [];
  const out: RollingAlphaPoint[] = [];
  for (let i = lookback; i < curve.length; i++) {
    const cur = curve[i];
    const ago = curve[i - lookback];
    if (ago.mirror <= 0 || ago.spy <= 0) continue;
    const mirror1y = (cur.mirror / ago.mirror - 1) * 100;
    const spy1y = (cur.spy / ago.spy - 1) * 100;
    out.push({
      date: cur.date,
      mirror1yPct: mirror1y,
      spy1yPct: spy1y,
      alphaPct: mirror1y - spy1y,
    });
  }
  return out;
}

function mean(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return xs.length > 0 ? s / xs.length : 0;
}

function variance(xs: number[], mu: number): number {
  if (xs.length < 2) return 0;
  let s = 0;
  for (const x of xs) {
    const d = x - mu;
    s += d * d;
  }
  return s / (xs.length - 1);
}
