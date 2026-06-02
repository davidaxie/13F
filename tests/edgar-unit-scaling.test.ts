import { describe, it, expect } from "vitest";
import { chooseFilingScale, normalizeHoldingValue } from "@/lib/edgar";

// These tests pin down the SEC 13F value-scaling fix (the "1000× inflation
// bug"). Pre-2023-05-25 filings historically reported `value` in $1000s, but
// some filers reported in whole dollars before the deadline. We have two
// layered defenses:
//
//   1. PORTFOLIO-LEVEL (`chooseFilingScale`): cross-checks the holdings
//      sum against the cover page's `<tableValueTotal>` and uses the
//      portfolio-average per-share at ×1000 multiplication to pick the
//      filing's native unit. Deterministic when a cover page exists.
//
//   2. ROW-LEVEL (`normalizeHoldingValue`): fallback used when no cover
//      page is available. Uses a per-row $50k/share ceiling. Catches
//      most cases but leaks on filings dominated by low-priced stocks
//      (e.g. Berkshire's NU HLDGS line at ~$4/share).
//
// Strict boundary: a filing dated exactly 2023-05-25 is post-cutover.
// Per-share ceilings: $50,000/share at the row level; $1,000/share at
// the portfolio-average level (averages smooth out so a much tighter
// threshold cleanly separates the two regimes).

describe("normalizeHoldingValue — date boundary", () => {
  it("post-cutover (2024-01-15) returns rawValue unchanged: 1234567 stays 1234567", () => {
    expect(normalizeHoldingValue(1234567, 100, "2024-01-15")).toBe(1234567);
  });

  it("boundary date 2023-05-25 is post-cutover (strict <): 1234567 stays 1234567", () => {
    expect(normalizeHoldingValue(1234567, 100, "2023-05-25")).toBe(1234567);
  });

  it("one day before cutover (2023-05-24) is pre-cutover: small per-share multiplies × 1000", () => {
    // shares=1000, raw=10_000 → candidate=10_000_000, per-share=$10,000 → below ceiling → multiply.
    expect(normalizeHoldingValue(10_000, 1000, "2023-05-24")).toBe(10_000_000);
  });
});

describe("normalizeHoldingValue — pre-cutoff thousands filer (legit ×1000)", () => {
  it("value=10_000, shares=1000 (per-share post-mult = $10k, below ceiling) → 10_000_000", () => {
    expect(normalizeHoldingValue(10_000, 1000, "2023-01-15")).toBe(10_000_000);
  });

  it("value=500_000, shares=10_000 (per-share post-mult = $50k, at boundary, NOT > ceiling) → multiplies to 500_000_000", () => {
    // Strictly greater-than: $50,000 is NOT > $50,000, so multiplication still applies.
    expect(normalizeHoldingValue(500_000, 10_000, "2022-12-31")).toBe(
      500_000_000,
    );
  });
});

describe("normalizeHoldingValue — pre-cutoff whole-dollars filer (sanity check triggers, return rawValue)", () => {
  it("Berkshire COF 2023-05-15: raw=954_099_520 with 9_899_000 shares (per-share post-mult ~ $96k) stays 954_099_520", () => {
    // The infamous bug: real value ~$954M (9.9M × ~$96/share). Multiplying would
    // produce $954B and a per-share of $96,383 — clearly absurd. The sanity
    // check returns rawValue unchanged.
    expect(
      normalizeHoldingValue(954_099_520, 9_899_000, "2023-05-15"),
    ).toBe(954_099_520);
  });

  it("Bridgewater JPM 2023-02-13: raw=92_844_940 with shares producing ~$130k/share post-mult stays unchanged", () => {
    // raw=92_844_940, shares=714_000 → candidate=92_844_940_000, per-share=$130k → triggers.
    expect(
      normalizeHoldingValue(92_844_940, 714_000, "2023-02-13"),
    ).toBe(92_844_940);
  });

  it("Coatue TSM 2023-05-15: raw=548_898_276 with shares producing ~$100k/share post-mult stays unchanged", () => {
    // raw=548_898_276, shares=5_488_982 → candidate=548_898_276_000, per-share≈$100k → triggers.
    expect(
      normalizeHoldingValue(548_898_276, 5_488_982, "2023-05-15"),
    ).toBe(548_898_276);
  });
});

describe("normalizeHoldingValue — per-share ceiling boundary ($50,000)", () => {
  it("per-share exactly $50,000 post-mult does NOT trigger (strict >): value=5_000_000, shares=100_000 → 5_000_000_000", () => {
    // candidate = 5_000_000 × 1000 = 5_000_000_000; 5e9 / 100_000 = $50,000 — NOT strictly > $50,000.
    expect(normalizeHoldingValue(5_000_000, 100_000, "2022-12-31")).toBe(
      5_000_000_000,
    );
  });

  it("per-share just above $50,000 post-mult triggers: value=5_000_001, shares=100_000 → 5_000_001 (unchanged)", () => {
    // candidate / shares = 50_000.01 → strictly > $50,000 → sanity check triggers.
    expect(normalizeHoldingValue(5_000_001, 100_000, "2022-12-31")).toBe(
      5_000_001,
    );
  });
});

describe("normalizeHoldingValue — shares=0 (options/puts/calls, date-based fallback)", () => {
  it("pre-cutoff with shares=0 multiplies × 1000 (no per-share check possible): 1000 → 1_000_000", () => {
    expect(normalizeHoldingValue(1000, 0, "2023-01-15")).toBe(1_000_000);
  });

  it("post-cutoff with shares=0 returns rawValue unchanged: 1000 stays 1000", () => {
    expect(normalizeHoldingValue(1000, 0, "2024-01-15")).toBe(1000);
  });
});

describe("chooseFilingScale — cover-page-anchored filing-level decision", () => {
  it("post-cutoff filing short-circuits to 1 regardless of cover total", () => {
    // Date rule is authoritative after the cutover, so we don't even need
    // a cover total. Returns 1 for any non-null/null cover.
    expect(chooseFilingScale(123, 456, 999, "2024-01-15")).toBe(1);
    expect(chooseFilingScale(123, 456, null, "2024-01-15")).toBe(1);
    expect(chooseFilingScale(123, 456, 999, "2023-05-25")).toBe(1);
  });

  it("pre-2023 thousands filing — sum ≈ cover ≈ $128.8M raw → multiply ×1000 (Berkshire 2016Q3 shape)", () => {
    // Real Berkshire 2016Q3: cover=$128,787,110 in thousands, total_shares=
    // 2,090,899,991. avg×1000 = $61.59 — far below the $1k portfolio
    // ceiling — confirming the filer is in thousands.
    expect(
      chooseFilingScale(128_787_110, 2_090_899_991, 128_787_110, "2016-11-14"),
    ).toBe(1000);
  });

  it("pre-2023 whole-dollar filing (the BUG case) — sum ≈ cover ≈ $299B raw → NO multiplier (Berkshire 2023-02-14 shape)", () => {
    // Real Berkshire 2023-02-14: cover=299,007,622,119 in whole dollars,
    // total_shares=3,960,392,807. avg×1000 = $75,499 — way above $1k
    // ceiling — the filer is already in whole dollars. This is the case
    // the per-share row-level heuristic missed (NU HLDGS at ~$4/share).
    expect(
      chooseFilingScale(
        299_007_622_119,
        3_960_392_807,
        299_007_622_119,
        "2023-02-14",
      ),
    ).toBe(1);
  });

  it("pre-2023 whole-dollar filing dominated by low-priced stocks still triggers — Tiger Global 2023-02-14 shape", () => {
    // Tiger Global avg ~$32/share REAL. avg×1000 = $32,146 — well above
    // $1k ceiling. This is the case where row-level missed because no
    // individual position had per-share > $50k after multiplication.
    expect(
      chooseFilingScale(
        8_163_347_431,
        253_940_796,
        8_163_347_431,
        "2023-02-14",
      ),
    ).toBe(1);
  });

  it("missing cover (null) → returns null so caller falls back to per-share row heuristic", () => {
    expect(chooseFilingScale(123_000, 4_000, null, "2023-01-15")).toBeNull();
  });

  it("zero / negative cover → returns null", () => {
    expect(chooseFilingScale(123_000, 4_000, 0, "2023-01-15")).toBeNull();
    expect(chooseFilingScale(123_000, 4_000, -5, "2023-01-15")).toBeNull();
  });

  it("zero total shares (all options/puts/calls) → returns null", () => {
    expect(
      chooseFilingScale(1_000_000, 0, 1_000_000, "2023-01-15"),
    ).toBeNull();
  });

  it("sum drifts > 2% from cover_total → returns null (untrustworthy cross-check)", () => {
    // sum 10% off cover — likely an amendment whose cover didn't update.
    // Bail out so the row-level fallback handles it.
    expect(
      chooseFilingScale(110_000_000, 1_000_000, 100_000_000, "2023-01-15"),
    ).toBeNull();
  });

  it("sum drifts just under 2% from cover_total → still trusted (tolerance edge)", () => {
    // 1.5% under tolerance. avg×1000 = $99 — under $1k → multiply ×1000.
    expect(
      chooseFilingScale(98_500_000, 1_000_000_000, 100_000_000, "2023-01-15"),
    ).toBe(1000);
  });

  it("portfolio avg×1000 exactly at $1k threshold (NOT strictly greater) → multiply ×1000", () => {
    // cover=1000, total_shares=1000 → avg×1000 = (1000 × 1000) / 1000 = $1000.
    // NOT strictly > $1000, so the multiplier should still apply.
    expect(chooseFilingScale(1_000, 1_000, 1_000, "2023-01-15")).toBe(1000);
  });

  it("portfolio avg×1000 just above $1k threshold → returns 1 (no multiplier)", () => {
    // cover=1001, total_shares=1000 → avg×1000 = (1001 × 1000) / 1000 = $1001.
    // Just over the $1k threshold → filer is already in whole dollars.
    expect(chooseFilingScale(1_001, 1_000, 1_001, "2023-01-15")).toBe(1);
  });
});
