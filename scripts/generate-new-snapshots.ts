// Generates backtest snapshots for the new UE-01 funds only.
// Existing fund JSONs are not regenerated.
//
// Run:  npx tsx scripts/generate-new-snapshots.ts

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runBacktest } from "../src/lib/backtest.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUT_DIR = resolve(__dirname, "..", "src", "data", "backtest");

// Only the new funds added in UE-01 (verified CIKs via EDGAR).
//
// `mode` / `maxQuarters` mirror the convention the original 9 used: heavy
// multi-strat / quant books (thousands of positions × dozens of quarters)
// would take forever / blow memory on full history, so cap them to the most
// recent 8 quarters via "recent" mode (skips the historical archive pages).
// Concentrated funds (activists, Tiger Cubs, solos) use full history.
type NewFund = {
  cik: string;
  displayName: string;
  mode: "recent" | "all";
  maxQuarters: number; // 0 = full history
};

const HEAVY = { mode: "recent" as const, maxQuarters: 8 };
const FULL = { mode: "all" as const, maxQuarters: 0 };

// Order matters when Yahoo is rate-limited: light/concentrated funds first
// (few unique tickers, mostly large-caps already in the price cache → high
// success odds), heavy quant books last (thousands of unique small-caps →
// most fresh Yahoo fetches → most likely to trip 429). A stuck heavy fund
// then can't block the easy wins. Already-generated funds are skipped via
// the existsSync guard below.
const NEW_FUNDS: NewFund[] = [
  // --- already generated 2026-05-28 (skipped) ---
  { cik: "1048445", displayName: "Elliott Management", ...FULL },
  { cik: "1040273", displayName: "Third Point", ...FULL },
  { cik: "1061165", displayName: "Lone Pine Capital", ...FULL },
  { cik: "1135730", displayName: "Coatue Management", ...FULL },
  { cik: "1103804", displayName: "Viking Global Investors", ...FULL },
  { cik: "1747057", displayName: "D1 Capital Partners", ...FULL },
  { cik: "1079114", displayName: "Greenlight Capital", ...FULL },
  { cik: "1138995", displayName: "Glenview Capital", ...FULL },
  // --- remaining: light/concentrated first ---
  { cik: "1649339", displayName: "Scion Asset Management", ...FULL },
  { cik: "934639",  displayName: "Maverick Capital", ...FULL },
  { cik: "1345472", displayName: "Trian Fund Management", ...FULL },
  { cik: "1517137", displayName: "Starboard Value", ...FULL },
  { cik: "1159159", displayName: "JANA Partners", ...FULL },
  { cik: "1536411", displayName: "Duquesne Family Office", ...FULL },
  // --- heavy quant books last (8Q cap; most Yahoo-fetch-intensive) ---
  { cik: "1009207", displayName: "D.E. Shaw", ...HEAVY },
  { cik: "1167557", displayName: "AQR Capital Management", ...HEAVY },
  { cik: "1273087", displayName: "Millennium Management", ...HEAVY },
  { cik: "1603466", displayName: "Point72 Asset Management", ...HEAVY },
];

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  const results: { cik: string; name: string; ok: boolean; trades?: number; error?: string }[] = [];

  for (const fund of NEW_FUNDS) {
    const outPath = resolve(OUT_DIR, `${fund.cik}.json`);
    if (existsSync(outPath)) {
      process.stderr.write(`[${fund.cik}] ${fund.displayName} — snapshot already exists, skipping\n`);
      continue;
    }
    process.stderr.write(
      `[${fund.cik}] ${fund.displayName} — running backtest (mode=${fund.mode}, maxQ=${fund.maxQuarters})…\n`,
    );
    try {
      const snapshot = await runBacktest(
        fund.cik,
        fund.displayName,
        10000,
        fund.mode,
        fund.maxQuarters,
      );
      writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
      process.stderr.write(`[${fund.cik}] ✓ ${snapshot.trades.length} trades — wrote ${outPath}\n`);
      results.push({ cik: fund.cik, name: fund.displayName, ok: true, trades: snapshot.trades.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[${fund.cik}] ERROR: ${message}\n`);
      results.push({ cik: fund.cik, name: fund.displayName, ok: false, error: message });
    }
  }

  // Summary
  const successes = results.filter((r) => r.ok);
  const failures = results.filter((r) => !r.ok);

  process.stderr.write("\n=== New snapshot generation summary ===\n");
  process.stderr.write(`  Succeeded: ${successes.length} / ${results.length}\n`);
  for (const s of successes) {
    process.stderr.write(`    ✓ [${s.cik}] ${s.name} — ${s.trades} trades\n`);
  }
  if (failures.length > 0) {
    process.stderr.write(`  Failed (${failures.length}):\n`);
    for (const f of failures) {
      process.stderr.write(`    ✗ [${f.cik}] ${f.name}: ${f.error}\n`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
