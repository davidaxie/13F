// One-time driver to regenerate EVERY wired backtest snapshot under
// src/data/backtest/, OVERWRITING the existing JSON for each of the 25 funds
// currently imported by src/lib/snapshots.ts.
//
// Why this script exists:
//   src/lib/edgar.ts had a bug that affected the holdings parsed from SEC
//   filings (and therefore every downstream snapshot value). After that fix
//   lands, all 25 committed snapshots need to be re-computed with correct
//   inputs. This script does exactly that — nothing else.
//
// This is intentionally NOT the same as scripts/generate-new-snapshots.ts:
//   - generate-new-snapshots.ts SKIPS already-existing JSONs (it only fills in
//     newly-added funds).
//   - this script OVERWRITES every wired snapshot in place.
//
// Run:
//   npx tsx scripts/regenerate-all-snapshots.ts
//
// Dry-run (prints planned jobs in execution order, no network calls):
//   DRY_RUN=1 npx tsx scripts/regenerate-all-snapshots.ts
//
// Execution is sequential by design: Yahoo aggressively 429s, and SEC limits
// us to 10 req/sec — parallelism gives nothing here and would just shred the
// shared price cache with concurrent writers.

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runBacktest } from "../src/lib/backtest.js";
import { MARQUEE_FUNDS } from "../src/lib/funds.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUT_DIR = resolve(__dirname, "..", "src", "data", "backtest");

type FundJob = {
  cik: string;
  displayName: string;
  mode: "recent" | "all";
  maxQuarters: number; // 0 = full history
};

// The 25 CIKs currently imported by src/lib/snapshots.ts. This list MIRRORS
// the SNAPSHOTS map in that file and MUST be updated whenever wiring changes
// (e.g. when Trian / Starboard get wired, add their CIKs here too).
const WIRED_CIKS: Set<string> = new Set<string>([
  // Original 9
  "1067983", // Berkshire Hathaway
  "1336528", // Pershing Square
  "1167483", // Tiger Global
  "1037389", // Renaissance Technologies
  "1350694", // Bridgewater Associates
  "1423053", // Citadel Advisors
  "1029160", // Soros Fund Management
  "1656456", // Appaloosa
  "1179392", // Two Sigma Investments
  // UE-01 lights (concentrated / activist / Tiger Cubs / solos)
  "1048445", // Elliott Management
  "1040273", // Third Point
  "1061165", // Lone Pine Capital
  "1135730", // Coatue Management
  "1103804", // Viking Global Investors
  "1747057", // D1 Capital Partners
  "1079114", // Greenlight Capital
  "1138995", // Glenview Capital
  "1649339", // Scion Asset Management
  "934639",  // Maverick Capital
  "1159159", // JANA Partners
  "1536411", // Duquesne Family Office
  // UE-01 heavy quants (capped at 8 recent quarters)
  "1009207", // D.E. Shaw
  "1167557", // AQR Capital Management
  "1273087", // Millennium Management
  "1603466", // Point72 Asset Management
]);

// CIKs that use mode="recent", maxQuarters=8. These are the quant /
// multi-strat books whose 13F has thousands of unique positions × dozens of
// quarters — a full-history run would take hours and is not what the heavy
// books represent on the dashboard anyway (their 13F sleeve is mechanical
// flow, not a long-horizon thesis).
const HEAVY_CIKS: Set<string> = new Set<string>([
  "1037389", // Renaissance Technologies
  "1423053", // Citadel Advisors
  "1179392", // Two Sigma Investments
  "1029160", // Soros Fund Management
  "1009207", // D.E. Shaw
  "1167557", // AQR Capital Management
  "1273087", // Millennium Management
  "1603466", // Point72 Asset Management
]);

const HEAVY = { mode: "recent" as const, maxQuarters: 8 };
const FULL = { mode: "all" as const, maxQuarters: 0 };

/**
 * Returns the job list in execution order: lights first, heavies last.
 *
 * Order rationale (same as generate-new-snapshots.ts): a stuck heavy quant
 * book (Yahoo 429s on thousands of small-cap tickers) must not block the
 * easy wins. By queuing the concentrated / activist / Tiger Cub books up
 * front — small ticker sets, mostly large-caps already in the price cache —
 * we lock in those snapshots before the rate limiter gets unhappy.
 *
 * Within each tier, order is stable (insertion order of MARQUEE_FUNDS so
 * the printed plan reads top-down the same way the leaderboard does).
 */
function jobsInOrder(): FundJob[] {
  const lights: FundJob[] = [];
  const heavies: FundJob[] = [];

  for (const fund of MARQUEE_FUNDS) {
    if (!WIRED_CIKS.has(fund.cik)) continue;
    const isHeavy = HEAVY_CIKS.has(fund.cik);
    const cfg = isHeavy ? HEAVY : FULL;
    const job: FundJob = {
      cik: fund.cik,
      displayName: fund.displayName,
      mode: cfg.mode,
      maxQuarters: cfg.maxQuarters,
    };
    (isHeavy ? heavies : lights).push(job);
  }

  return [...lights, ...heavies];
}

/**
 * Sanity-check WIRED_CIKS / HEAVY_CIKS against MARQUEE_FUNDS. Writes to
 * stderr only — does not abort, since a desync here usually means someone
 * is mid-wiring a new fund and that's fine for a dry-run.
 */
function checkConsistency(): void {
  const marqueeCiks = new Set<string>(MARQUEE_FUNDS.map((f) => f.cik));

  // Wired but missing metadata is a real bug — the dashboard would render
  // the fund with no name / tagline.
  for (const cik of WIRED_CIKS) {
    if (!marqueeCiks.has(cik)) {
      console.error(
        `[warning] WIRED_CIKS contains ${cik} but MARQUEE_FUNDS does not — fund will render without metadata`,
      );
    }
  }

  // Marquee but not wired is informational — means the fund is in the
  // graceful "pending" state (e.g. Trian / Starboard, where the parser or
  // CUSIP coverage isn't ready yet).
  for (const cik of marqueeCiks) {
    if (!WIRED_CIKS.has(cik)) {
      const meta = MARQUEE_FUNDS.find((f) => f.cik === cik);
      console.error(
        `[info] MARQUEE_FUNDS[${cik}] (${meta?.displayName ?? "?"}) is not wired in snapshots.ts — pending, will be skipped`,
      );
    }
  }

  // HEAVY_CIKS that aren't wired make no sense — the heavy flag would
  // never be applied.
  for (const cik of HEAVY_CIKS) {
    if (!WIRED_CIKS.has(cik)) {
      console.error(
        `[warning] HEAVY_CIKS contains ${cik} but it is not in WIRED_CIKS — heavy flag is dead`,
      );
    }
  }
}

type RunResult = {
  cik: string;
  name: string;
  ok: boolean;
  trades?: number;
  elapsedMs: number;
  error?: string;
};

async function main(): Promise<void> {
  checkConsistency();

  const jobs = jobsInOrder();

  if (process.env.DRY_RUN === "1") {
    console.error(`[dry-run] ${jobs.length} jobs in execution order:`);
    for (const job of jobs) {
      console.error(
        `  [${job.cik}] ${job.displayName} — mode=${job.mode}, maxQuarters=${job.maxQuarters}`,
      );
    }
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const results: RunResult[] = [];

  for (const job of jobs) {
    const outPath = resolve(OUT_DIR, `${job.cik}.json`);
    console.error(
      `[${job.cik}] ${job.displayName} — running backtest (mode=${job.mode}, maxQ=${job.maxQuarters})...`,
    );
    const startedAt = Date.now();
    try {
      const snapshot = await runBacktest(
        job.cik,
        job.displayName,
        10000,
        job.mode,
        job.maxQuarters,
      );
      writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
      const elapsedMs = Date.now() - startedAt;
      console.error(
        `[${job.cik}] OK ${snapshot.trades.length} trades in ${(elapsedMs / 1000).toFixed(1)}s — wrote ${outPath}`,
      );
      results.push({
        cik: job.cik,
        name: job.displayName,
        ok: true,
        trades: snapshot.trades.length,
        elapsedMs,
      });
    } catch (err) {
      const elapsedMs = Date.now() - startedAt;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${job.cik}] ERROR after ${(elapsedMs / 1000).toFixed(1)}s: ${message}`);
      results.push({
        cik: job.cik,
        name: job.displayName,
        ok: false,
        elapsedMs,
        error: message,
      });
    }
  }

  // Summary
  const successes = results.filter((r) => r.ok);
  const failures = results.filter((r) => !r.ok);

  console.error("\n=== Regeneration summary ===");
  console.error(`  Succeeded: ${successes.length} / ${results.length}`);
  for (const s of successes) {
    console.error(
      `    OK [${s.cik}] ${s.name} — ${s.trades} trades in ${(s.elapsedMs / 1000).toFixed(1)}s`,
    );
  }
  if (failures.length > 0) {
    console.error(`  Failed (${failures.length}):`);
    for (const f of failures) {
      console.error(
        `    FAIL [${f.cik}] ${f.name} (${(f.elapsedMs / 1000).toFixed(1)}s): ${f.error}`,
      );
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
