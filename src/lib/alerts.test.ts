import { describe, it, expect } from "vitest";
import { detectMaterialMovesFromHoldings } from "./alerts";
import type { Holding } from "./parse-13f";

// Build a holding with sensible defaults. Fake CUSIPs (so tickerForCusip
// misses and `ticker` falls back to issuer) keep assertions independent of the
// bundled CUSIP seed.
function h(over: Partial<Holding> & { cusip: string }): Holding {
  return {
    issuer: over.issuer ?? over.cusip,
    titleOfClass: "COM",
    cusip: over.cusip,
    value: over.value ?? 0,
    shares: over.shares ?? 0,
    sharesType: "SH",
    putCall: over.putCall,
    investmentDiscretion: over.investmentDiscretion,
  };
}

const META = { cik: "999", fundName: "Test Fund", filingDate: "2026-05-15" };
const MIN = 50_000_000;

describe("detectMaterialMovesFromHoldings", () => {
  it("flags a new position above the threshold", () => {
    const latest = [
      h({ cusip: "NEW000001", issuer: "Alpha Corp", value: 60_000_000, shares: 600_000 }),
    ];
    const moves = detectMaterialMovesFromHoldings(latest, [], META, MIN);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({
      changeType: "new",
      issuer: "Alpha Corp",
      valueUsd: 60_000_000,
      ticker: "Alpha Corp", // fake CUSIP → falls back to issuer
    });
  });

  it("ignores a new position below the threshold", () => {
    const latest = [
      h({ cusip: "SML000001", issuer: "Tiny Co", value: 10_000_000, shares: 100_000 }),
    ];
    expect(detectMaterialMovesFromHoldings(latest, [], META, MIN)).toHaveLength(0);
  });

  it("flags a full exit above the threshold using the prior value", () => {
    const prev = [
      h({ cusip: "EXT000001", issuer: "Gamma Inc", value: 80_000_000, shares: 800_000 }),
    ];
    const moves = detectMaterialMovesFromHoldings([], prev, META, MIN);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({
      changeType: "exit",
      issuer: "Gamma Inc",
      valueUsd: 80_000_000,
    });
  });

  it("ignores an exit below the threshold", () => {
    const prev = [
      h({ cusip: "EXT000002", issuer: "Small Exit", value: 5_000_000, shares: 50_000 }),
    ];
    expect(detectMaterialMovesFromHoldings([], prev, META, MIN)).toHaveLength(0);
  });

  it("flags an add when shares grow and the added value clears the threshold", () => {
    // 1M → 2M shares at $100/share ⇒ +1M shares × $100 = $100M added.
    const prev = [
      h({ cusip: "ADD000001", issuer: "Delta Ltd", value: 100_000_000, shares: 1_000_000 }),
    ];
    const latest = [
      h({ cusip: "ADD000001", issuer: "Delta Ltd", value: 200_000_000, shares: 2_000_000 }),
    ];
    const moves = detectMaterialMovesFromHoldings(latest, prev, META, MIN);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({
      changeType: "add",
      issuer: "Delta Ltd",
      valueUsd: 100_000_000,
      changePercent: 100,
    });
  });

  it("ignores an add whose added value is below the threshold", () => {
    // +100k shares at $100 = $10M added — under $50M.
    const prev = [
      h({ cusip: "ADD000002", issuer: "Slow Add", value: 100_000_000, shares: 1_000_000 }),
    ];
    const latest = [
      h({ cusip: "ADD000002", issuer: "Slow Add", value: 110_000_000, shares: 1_100_000 }),
    ];
    expect(detectMaterialMovesFromHoldings(latest, prev, META, MIN)).toHaveLength(0);
  });

  it("ignores trims (share decreases) and unchanged positions", () => {
    const prev = [
      h({ cusip: "TRM000001", issuer: "Trimmed", value: 200_000_000, shares: 2_000_000 }),
      h({ cusip: "SAM000001", issuer: "Unchanged", value: 100_000_000, shares: 1_000_000 }),
    ];
    const latest = [
      h({ cusip: "TRM000001", issuer: "Trimmed", value: 100_000_000, shares: 1_000_000 }),
      h({ cusip: "SAM000001", issuer: "Unchanged", value: 100_000_000, shares: 1_000_000 }),
    ];
    expect(detectMaterialMovesFromHoldings(latest, prev, META, MIN)).toHaveLength(0);
  });

  it("excludes option rows (putCall) from the diff", () => {
    const latest = [
      h({ cusip: "OPT000001", issuer: "Optionco", value: 90_000_000, shares: 900_000, putCall: "Put" }),
    ];
    expect(detectMaterialMovesFromHoldings(latest, [], META, MIN)).toHaveLength(0);
  });

  it("aggregates multiple rows of the same CUSIP before thresholding", () => {
    // Two $30M lots of the same issuer ⇒ one $60M new position, above $50M.
    const latest = [
      h({ cusip: "AGG000001", issuer: "Split Lots", value: 30_000_000, shares: 300_000 }),
      h({ cusip: "AGG000001", issuer: "Split Lots", value: 30_000_000, shares: 300_000 }),
    ];
    const moves = detectMaterialMovesFromHoldings(latest, [], META, MIN);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ changeType: "new", valueUsd: 60_000_000 });
  });

  it("sorts moves by descending dollar value", () => {
    const latest = [
      h({ cusip: "SRT000001", issuer: "Small New", value: 55_000_000, shares: 550_000 }),
      h({ cusip: "SRT000002", issuer: "Big New", value: 500_000_000, shares: 5_000_000 }),
    ];
    const moves = detectMaterialMovesFromHoldings(latest, [], META, MIN);
    expect(moves.map((m) => m.issuer)).toEqual(["Big New", "Small New"]);
  });
});
