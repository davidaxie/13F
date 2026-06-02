import { describe, it, expect } from "vitest";
import {
  computeRiskMetrics,
  computeRollingAlpha,
} from "./risk-metrics";
import type { EquityCurvePoint } from "./backtest";

// Build a synthetic equity curve with controlled returns. Returns array
// `mirrorWeekly` / `spyWeekly` are weekly multiplicative returns; the curve
// starts at $100 for both.
function buildCurve(
  mirrorWeekly: number[],
  spyWeekly: number[],
  startDate = "2020-01-01",
): EquityCurvePoint[] {
  if (mirrorWeekly.length !== spyWeekly.length) {
    throw new Error("series length mismatch");
  }
  const curve: EquityCurvePoint[] = [];
  let m = 100;
  let s = 100;
  const start = new Date(startDate + "T00:00:00Z").getTime();
  curve.push({ date: startDate, mirror: m, spy: s });
  for (let i = 0; i < mirrorWeekly.length; i++) {
    m *= 1 + mirrorWeekly[i];
    s *= 1 + spyWeekly[i];
    const d = new Date(start + (i + 1) * 7 * 86400000)
      .toISOString()
      .slice(0, 10);
    curve.push({ date: d, mirror: m, spy: s });
  }
  return curve;
}

describe("computeRiskMetrics", () => {
  it("returns null for empty / single-point curves", () => {
    expect(computeRiskMetrics([])).toBeNull();
    expect(
      computeRiskMetrics([{ date: "2020-01-01", mirror: 100, spy: 100 }]),
    ).toBeNull();
  });

  it("flat curve → zero vol, zero alpha, zero drawdown", () => {
    const flat = buildCurve(
      Array(52).fill(0),
      Array(52).fill(0),
    );
    const m = computeRiskMetrics(flat);
    expect(m).not.toBeNull();
    expect(m!.cagrPct).toBeCloseTo(0, 6);
    expect(m!.spyCagrPct).toBeCloseTo(0, 6);
    expect(m!.volAnnualPct).toBeCloseTo(0, 6);
    expect(m!.maxDrawdownPct).toBeCloseTo(0, 6);
    expect(m!.trackingErrorPct).toBeCloseTo(0, 6);
  });

  it("drawdown detection finds the deepest trough, not the first dip", () => {
    // Curve: up 10%, down 5%, up 20%, down 30% (deeper), up 5%
    const m = buildCurve(
      [0.1, -0.05, 0.2, -0.3, 0.05],
      [0, 0, 0, 0, 0],
    );
    const r = computeRiskMetrics(m)!;
    // Peak before the deep drawdown is at index 3 (after 10% × 95% × 120%)
    // Peak value = 100 × 1.1 × 0.95 × 1.2 = 125.4
    // Trough = 125.4 × 0.7 = 87.78 → drawdown = -30%
    expect(r.maxDrawdownPct).toBeCloseTo(-30, 4);
    expect(r.maxDrawdownStart).toBe(m[3].date); // peak before the big drop
    expect(r.maxDrawdownTrough).toBe(m[4].date);
  });

  it("beta = 1, alpha ≈ 0 when mirror tracks SPY exactly", () => {
    const spyWeekly = Array.from({ length: 52 }, (_, i) =>
      Math.sin(i / 5) * 0.02,
    );
    const r = computeRiskMetrics(buildCurve(spyWeekly, spyWeekly))!;
    expect(r.betaVsSpy).toBeCloseTo(1, 4);
    expect(r.trackingErrorPct).toBeCloseTo(0, 4);
    // Alpha should be ≈ 0 when CAGR matches SPY CAGR exactly.
    expect(Math.abs(r.alphaAnnualPct)).toBeLessThan(0.001);
  });

  it("beta ≈ 2 when mirror returns are 2× SPY returns each week", () => {
    const spyWeekly = Array.from({ length: 100 }, (_, i) =>
      Math.cos(i / 7) * 0.015,
    );
    const mirrorWeekly = spyWeekly.map((r) => r * 2);
    const r = computeRiskMetrics(buildCurve(mirrorWeekly, spyWeekly))!;
    expect(r.betaVsSpy).toBeCloseTo(2, 2);
  });

  it("upside/downside capture = 2 when mirror is 2× SPY's weekly returns", () => {
    const spyWeekly = [0.05, -0.02, 0.03, -0.01, 0.04, -0.03];
    const mirrorWeekly = spyWeekly.map((r) => r * 2);
    const r = computeRiskMetrics(buildCurve(mirrorWeekly, spyWeekly))!;
    expect(r.upsideCapture).toBeCloseTo(2, 4);
    expect(r.downsideCapture).toBeCloseTo(2, 4);
  });

  it("annualizes volatility by √52 from weekly returns", () => {
    // Weekly stddev ≈ 0.02 → annualized ≈ 0.02 × √52 = 14.42% (approx)
    const weekly: number[] = [];
    for (let i = 0; i < 200; i++) weekly.push((i % 2 === 0 ? 1 : -1) * 0.02);
    const r = computeRiskMetrics(
      buildCurve(weekly, Array(weekly.length).fill(0)),
    )!;
    // Stddev of [+0.02, -0.02, +0.02, …] is 0.02; annualized → ~14.4%
    expect(r.volAnnualPct).toBeGreaterThan(14);
    expect(r.volAnnualPct).toBeLessThan(15);
  });
});

describe("computeRollingAlpha", () => {
  it("returns empty when curve is shorter than lookback + 1", () => {
    const short = buildCurve([0.01, 0.01], [0.01, 0.01]); // 3 points
    expect(computeRollingAlpha(short, 52)).toEqual([]);
  });

  it("computes trailing 1y alpha for every point past the lookback", () => {
    const n = 60; // 60 weeks total
    const mirrorWeekly = Array(n).fill(0.005); // +0.5%/wk
    const spyWeekly = Array(n).fill(0.003); // +0.3%/wk
    const curve = buildCurve(mirrorWeekly, spyWeekly);
    const r = computeRollingAlpha(curve, 52);
    // 60 weeks of returns → 61 points; first valid at i=52 → 9 points
    expect(r.length).toBe(curve.length - 52);
    // 52 weeks at +0.5% compounded: (1.005)^52 - 1 ≈ 29.5%
    expect(r[0].mirror1yPct).toBeCloseTo((Math.pow(1.005, 52) - 1) * 100, 4);
    expect(r[0].spy1yPct).toBeCloseTo((Math.pow(1.003, 52) - 1) * 100, 4);
    expect(r[0].excessReturnPct).toBeCloseTo(
      r[0].mirror1yPct - r[0].spy1yPct,
      6,
    );
  });
});
