import { describe, it, expect } from "vitest";
import {
  computeCostVariants,
  type EnrichedSignal,
} from "./follower-backtest";

// Helper: build a synthetic EnrichedSignal. Required fields go in `req`;
// `extra` is an optional partial for any other overrides. Split this way
// (rather than one merged overrides arg) because TS's strict-mode duplicate-
// property check forbids spreading a Partial that includes required fields
// over explicit literal assignments.
type SigReq = {
  buyPrice: number;
  sellPrice: number;
  spyFinalValueUsd: number;
};

function sig(
  req: SigReq,
  extra: Partial<EnrichedSignal> = {},
): EnrichedSignal {
  return {
    fundCik: "test",
    fundName: "Test",
    cusip: "000000000",
    ticker: "TEST",
    issuer: "Test Inc",
    buyDate: "2024-01-01",
    sellDate: "2024-12-31",
    buyPrice: req.buyPrice,
    sellPrice: req.sellPrice,
    status: "closed",
    sharesBought: 0,
    finalValueUsd: 0,
    pnlUsd: 0,
    returnPct: 0,
    spyBuyPrice: 100,
    spySellPrice: 100,
    spyReturnPct: 0,
    spyFinalValueUsd: req.spyFinalValueUsd,
    alphaUsd: 0,
    alphaPct: 0,
    holdDays: 365,
    ...extra,
  };
}

describe("computeCostVariants", () => {
  it("0 bps produces gross results identical to a no-cost calculation", () => {
    // 3 signals: each $10k → doubles. SPY does +50%.
    const signals = [
      sig({ buyPrice: 100, sellPrice: 200, spyFinalValueUsd: 15000 }),
      sig({ buyPrice: 100, sellPrice: 200, spyFinalValueUsd: 15000 }),
      sig({ buyPrice: 100, sellPrice: 200, spyFinalValueUsd: 15000 }),
    ];
    const [gross] = computeCostVariants(signals, 10000, [0]);
    // Gross final = 3 × $20,000 = $60,000.
    expect(gross.followerFinalUsd).toBe(60000);
    expect(gross.followerReturnPct).toBeCloseTo(100, 6);
    // Alpha = 60000 − 45000 = 15000 → 50% of $30k invested.
    expect(gross.alphaUsd).toBe(15000);
    expect(gross.alphaPct).toBeCloseTo(50, 6);
    expect(gross.winRate).toBe(1); // all 3 beat SPY
  });

  it("cost is approximately linear in bps for typical levels", () => {
    const signals = Array.from({ length: 10 }, () =>
      sig({ buyPrice: 100, sellPrice: 200, spyFinalValueUsd: 15000 }),
    );
    const [gross, net5, net10, net25] = computeCostVariants(
      signals,
      10000,
      [0, 5, 10, 25],
    );
    // Per-signal round-trip cost ≈ 2 × bps × final_value.
    // 10 × $20k × 0.001 (10bps) = ~$200 total at 5 bps.
    expect(gross.followerFinalUsd - net5.followerFinalUsd).toBeCloseTo(
      200,
      0,
    );
    expect(gross.followerFinalUsd - net10.followerFinalUsd).toBeCloseTo(
      400,
      0,
    );
    expect(gross.followerFinalUsd - net25.followerFinalUsd).toBeCloseTo(
      998,
      0,
    );
  });

  it("does not change SPY benchmark or totalInvested", () => {
    const signals = Array.from({ length: 5 }, () =>
      sig({ buyPrice: 100, sellPrice: 150, spyFinalValueUsd: 12000 }),
    );
    const variants = computeCostVariants(signals, 10000, [0, 10, 50]);
    // All variants assume cost-free SPY → alphaUsd absorbs entire cost
    // delta. followerFinalUsd shrinks, but no other field's denominator
    // changes.
    const spyFinal = 5 * 12000;
    for (const v of variants) {
      // alphaUsd reflects follower − spy where spy is constant.
      expect(v.alphaUsd).toBe(v.followerFinalUsd - spyFinal);
    }
  });

  it("returns median equal to per-signal return when all signals are identical", () => {
    const signals = Array.from({ length: 7 }, () =>
      sig({ buyPrice: 50, sellPrice: 75, spyFinalValueUsd: 11000 }),
    );
    const [gross] = computeCostVariants(signals, 10000, [0]);
    // Gross return per signal: 75/50 − 1 = 50%.
    expect(gross.avgReturnPct).toBeCloseTo(50, 6);
    expect(gross.medianReturnPct).toBeCloseTo(50, 6);
  });

  it("empty signals → all zeros", () => {
    const [v] = computeCostVariants([], 10000, [10]);
    expect(v.followerFinalUsd).toBe(0);
    expect(v.followerReturnPct).toBe(0);
    expect(v.alphaUsd).toBe(0);
    expect(v.winRate).toBe(0);
    expect(v.medianReturnPct).toBe(0);
  });
});
