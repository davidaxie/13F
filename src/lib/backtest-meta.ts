// Server-only helper — reads backtest file mtimes to surface a data-freshness
// date (QW-05). Called only from server components; never imported client-side.

import fs from "fs";
import path from "path";

const BACKTEST_DIR = path.join(process.cwd(), "src", "data", "backtest");

/**
 * Returns an ISO date string for the most-recently-modified backtest JSON,
 * or null if the directory is empty / unreadable.
 */
export function newestBacktestDate(): string | null {
  try {
    const files = fs
      .readdirSync(BACKTEST_DIR)
      .filter((f) => f.endsWith(".json"));
    if (files.length === 0) return null;

    let newest = 0;
    for (const f of files) {
      const mtime = fs.statSync(path.join(BACKTEST_DIR, f)).mtimeMs;
      if (mtime > newest) newest = mtime;
    }
    return newest > 0 ? new Date(newest).toISOString() : null;
  } catch {
    return null;
  }
}
