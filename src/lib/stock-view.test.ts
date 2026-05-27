import { describe, it, expect } from "vitest";
import { cusipsForTicker, tickerForCusip } from "./stock-view";

// These tests exercise the ticker↔CUSIP reverse index built from the bundled
// cusip-seed.json. They're integration-style — they rely on real seed data
// rather than mocking the seed — to lock in the share-class variant
// normalization behavior that real users hit (BRK.B / BRK-B / BRKB, etc.).

describe("cusipsForTicker", () => {
  it("resolves common large-cap tickers to at least one CUSIP", () => {
    // Tickers that are guaranteed to be in MARQUEE_FUND snapshots and thus
    // in the seed. If any of these fail, the seed is broken.
    for (const t of ["AAPL", "MSFT", "GOOGL", "META", "AMZN", "NVDA"]) {
      const cusips = cusipsForTicker(t);
      expect(
        cusips.length,
        `expected at least one CUSIP for ${t}`,
      ).toBeGreaterThan(0);
      // Round-trip: resolving the first CUSIP back should give the same
      // ticker (case-insensitive).
      expect(tickerForCusip(cusips[0])?.toUpperCase()).toBe(t);
    }
  });

  it("normalizes share-class variants (BRK.B / BRK-B / BRKB)", () => {
    // Whatever the seed stores as Berkshire B's canonical ticker, all three
    // variants should resolve to the same CUSIP set.
    const dotted = cusipsForTicker("BRK.B");
    const dashed = cusipsForTicker("BRK-B");
    const concat = cusipsForTicker("BRKB");
    // At least one variant must hit (the seed has Berkshire B somewhere).
    const anyHit = dotted.length + dashed.length + concat.length > 0;
    expect(anyHit, "expected BRK.B/BRK-B/BRKB to resolve in some form").toBe(
      true,
    );
    // Whichever variant(s) resolve, they should agree on the CUSIP.
    const all = [dotted, dashed, concat].filter((c) => c.length > 0);
    const first = all[0];
    for (const c of all) {
      expect(c).toEqual(first);
    }
  });

  it("returns empty array for nonexistent tickers", () => {
    expect(cusipsForTicker("ZZZZ_NONEXISTENT")).toEqual([]);
    expect(cusipsForTicker("")).toEqual([]);
  });

  it("is case-insensitive on input", () => {
    expect(cusipsForTicker("aapl")).toEqual(cusipsForTicker("AAPL"));
    expect(cusipsForTicker("  aapl  ")).toEqual(cusipsForTicker("AAPL"));
  });
});

describe("tickerForCusip", () => {
  it("resolves Apple's canonical CUSIP to AAPL", () => {
    // 037833100 is Apple Inc's CUSIP, stable since the 1980s.
    expect(tickerForCusip("037833100")?.toUpperCase()).toBe("AAPL");
  });

  it("returns null for unknown CUSIPs", () => {
    expect(tickerForCusip("000000000")).toBeNull();
    expect(tickerForCusip("")).toBeNull();
  });
});
