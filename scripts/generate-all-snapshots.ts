// Standalone script — generates backtest snapshots for every fund in
// MARQUEE_FUNDS and writes them to src/data/backtest/<cik>.json.
//
// Run:  npx tsx scripts/generate-all-snapshots.ts
//
// Used by the nightly GitHub Actions workflow (.github/workflows/refresh-snapshots.yml)
// so that CI can refresh the static JSON files without spinning up a Next.js server.
// Each fund is processed serially; a single fund failure is logged but does not
// abort the run.

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// tsx resolves @/* paths via tsconfig paths — but this script runs outside
// Next.js, so we use relative imports to be safe.
import { MARQUEE_FUNDS } from "../src/lib/funds.js";
import { runBacktest } from "../src/lib/backtest.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUT_DIR = resolve(__dirname, "..", "src", "data", "backtest");

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  const results: { cik: string; name: string; ok: boolean; error?: string }[] = [];

  for (const fund of MARQUEE_FUNDS) {
    process.stderr.write(`[${fund.cik}] ${fund.displayName} — running backtest…\n`);
    try {
      const snapshot = await runBacktest(fund.cik, fund.displayName, 10000, "all", 0);
      const outPath = resolve(OUT_DIR, `${fund.cik}.json`);
      writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
      process.stderr.write(`[${fund.cik}] ✓ wrote ${outPath}\n`);
      results.push({ cik: fund.cik, name: fund.displayName, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[${fund.cik}] ERROR: ${message}\n`);
      results.push({ cik: fund.cik, name: fund.displayName, ok: false, error: message });
    }
  }

  // Summary
  const successes = results.filter((r) => r.ok);
  const failures = results.filter((r) => !r.ok);

  process.stderr.write("\n=== Snapshot generation summary ===\n");
  process.stderr.write(`  Succeeded: ${successes.length} / ${results.length}\n`);
  if (failures.length > 0) {
    process.stderr.write(`  Failed (${failures.length}):\n`);
    for (const f of failures) {
      process.stderr.write(`    - [${f.cik}] ${f.name}: ${f.error}\n`);
    }
    process.exit(1);
  } else {
    process.stderr.write("  All funds succeeded.\n");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
