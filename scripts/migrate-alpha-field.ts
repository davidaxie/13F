// One-off migration: rename `stats.alphaPct` → `stats.excessReturnPct` in every
// committed backtest snapshot under src/data/backtest/.
//
// The on-disk JSONs are emitted by JSON.stringify(snap) (compact, no
// pretty-indent, no spaces). This script preserves that format exactly so the
// migration shows up as a pure field-name diff with no whitespace noise.
//
// Key order inside `stats` is preserved: the rewrite walks the existing keys
// in order and substitutes the new name in place when it encounters
// `alphaPct`. That keeps diffs minimal and matches whatever runBacktest()
// happens to emit today.
//
// Pass --dry-run (or -n) to just print what WOULD change, without writing.
//
// Run:  npx tsx scripts/migrate-alpha-field.ts [--dry-run]

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = resolve(__dirname, "..", "src", "data", "backtest");
const OLD_KEY = "alphaPct";
const NEW_KEY = "excessReturnPct";

type Snapshot = {
  cik?: string;
  stats?: Record<string, unknown>;
  [k: string]: unknown;
};

function renameStatsKey(snap: Snapshot): boolean {
  const stats = snap.stats;
  if (!stats || typeof stats !== "object") return false;
  if (!(OLD_KEY in stats)) return false;

  // Rebuild stats preserving insertion order, substituting the renamed key
  // in the same slot the old one occupied.
  const rebuilt: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(stats)) {
    if (k === OLD_KEY) {
      rebuilt[NEW_KEY] = v;
    } else {
      rebuilt[k] = v;
    }
  }
  snap.stats = rebuilt;
  return true;
}

function main(): void {
  const dryRun =
    process.argv.includes("--dry-run") || process.argv.includes("-n");

  const files = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const migratedCiks: string[] = [];
  let totalFiles = 0;

  for (const file of files) {
    totalFiles++;
    const path = resolve(DATA_DIR, file);
    const raw = readFileSync(path, "utf8");
    const snap = JSON.parse(raw) as Snapshot;

    if (!renameStatsKey(snap)) continue;

    const cik = (snap.cik ?? file.replace(/\.json$/, "")) as string;
    migratedCiks.push(cik);

    if (!dryRun) {
      // Compact, no pretty-indent — matches the format emitted by
      // runBacktest()'s consumers (writeFileSync(path, JSON.stringify(snap))).
      writeFileSync(path, JSON.stringify(snap));
    }
  }

  const verb = dryRun ? "Would migrate" : "Migrated";
  console.log(
    `${verb} ${migratedCiks.length} of ${totalFiles} files: ${migratedCiks.join(", ")}`,
  );
}

main();
