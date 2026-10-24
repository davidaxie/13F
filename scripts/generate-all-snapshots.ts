// Standalone script — generates backtest snapshots for every fund in
// MARQUEE_FUNDS and writes them to src/data/backtest/<cik>.json.
//
// Run:  npx tsx scripts/generate-all-snapshots.ts            # every fund
//       npx tsx scripts/generate-all-snapshots.ts 1423053    # just these CIKs
//
// Used by the nightly GitHub Actions workflow (.github/workflows/refresh-snapshots.yml)
// so that CI can refresh the static JSON files without spinning up a Next.js server.
// Each fund is processed serially; a single fund failure is logged but does not
// abort the run.
//
// Each fund's history window comes from its `snapshotMode` in MARQUEE_FUNDS:
// "8q" funds (the heavy quant books) get the most recent 8 quarters, the rest
// get full history. Running "all" for the 8q funds took the snapshot dir from
// ~86 MB to ~425 MB in June 2026 and OOM-killed every Vercel build after it.

import { writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// tsx resolves @/* paths via tsconfig paths — but this script runs outside
// Next.js, so we use relative imports to be safe.
import { MARQUEE_FUNDS } from "../src/lib/funds.js";
import { runBacktest } from "../src/lib/backtest.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUT_DIR = resolve(__dirname, "..", "src", "data", "backtest");

// Every snapshot ships inside the Vercel server functions (see
// src/lib/snapshots.ts), which are capped at 250 MB uncompressed including
// node_modules. Fail the run, so CI commits nothing, rather than push a
// snapshot set that can't deploy.
const SNAPSHOT_DIR_BUDGET_MB = 150;

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  const only = new Set(process.argv.slice(2).map((c) => c.replace(/^0+/, "")));
  const funds = only.size > 0 ? MARQUEE_FUNDS.filter((f) => only.has(f.cik)) : MARQUEE_FUNDS;

  const results: { cik: string; name: string; ok: boolean; error?: string }[] = [];

  for (const fund of funds) {
    const [mode, maxQuarters] = fund.snapshotMode === "8q" ? (["recent", 8] as const) : (["all", 0] as const);
    process.stderr.write(
      `[${fund.cik}] ${fund.displayName} — running backtest (mode=${mode}, maxQ=${maxQuarters})…\n`,
    );
    try {
      const snapshot = await runBacktest(fund.cik, fund.displayName, 10000, mode, maxQuarters);
      const outPath = resolve(OUT_DIR, `${fund.cik}.json`);
      writeFileSync(outPath, JSON.stringify(snapshot));
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

  const totalBytes = readdirSync(OUT_DIR)
    .filter((f) => f.endsWith(".json"))
    .reduce((sum, f) => sum + statSync(resolve(OUT_DIR, f)).size, 0);
  const totalMb = totalBytes / 1e6;
  process.stderr.write(`  Snapshot dir: ${totalMb.toFixed(1)} MB (budget ${SNAPSHOT_DIR_BUDGET_MB} MB)\n`);
  if (totalMb > SNAPSHOT_DIR_BUDGET_MB) {
    process.stderr.write("  Over budget — check snapshotMode for the largest files before raising it.\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
