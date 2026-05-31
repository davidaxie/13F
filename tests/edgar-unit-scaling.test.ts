import { describe, it, expect } from "vitest";
import { normalizeHoldingValue } from "@/lib/edgar";

// These tests pin down the SEC 13F value-scaling fix (the "1000× inflation
// bug"). Pre-2023-05-25 filings historically reported `value` in $1000s, but
// some filers reported in whole dollars before the deadline. Our normalizer
// uses a date check PLUS a per-share plausibility ceiling to detect the
// already-whole-dollars filers and avoid inflating them by 1000×.
//
// Strict boundary: a filing dated exactly 2023-05-25 is post-cutover.
// Per-share ceiling: $50,000/share — well above any common US equity yet
// well below the ~1000× inflation the bug produces on real-world examples.

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
