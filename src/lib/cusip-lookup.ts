// Pure-data CUSIP↔ticker lookup. Client-safe — only depends on the bundled
// cusip-seed.json (no fs, no snapshot data, no EDGAR fetch). Keep this file
// dependency-free so client components can import it without dragging server
// transitive deps into the browser bundle.

import seedData from "./cusip-seed.json";

// Re-export so consumers can pull the asset-class classifier through the
// single cusip-lookup entry point.
export { assetClassForCusip, type AssetClass } from "./asset-class";

type SeedRow = { ticker: string | null; name: string; exchCode: string | null };

let tickerToCusips: Map<string, string[]> | null = null;
let cusipToTicker: Map<string, string> | null = null;

function buildIndexes() {
  if (tickerToCusips) return;
  tickerToCusips = new Map();
  cusipToTicker = new Map();
  const seed = seedData as Record<string, SeedRow>;
  for (const [cusip, row] of Object.entries(seed)) {
    if (!row.ticker) continue;
    const tk = row.ticker.toUpperCase();
    cusipToTicker.set(cusip, tk);
    const arr = tickerToCusips.get(tk) ?? [];
    arr.push(cusip);
    tickerToCusips.set(tk, arr);
  }
}

// Accept BRK.B, BRK-B, BRK/B, BRKB — share-class separator varies by data
// source (Bloomberg uses /, Yahoo uses -, S&P uses .).
function tickerVariants(input: string): string[] {
  const upper = input.trim().toUpperCase();
  const variants = new Set<string>([upper]);
  variants.add(upper.replace(/[.\-/]/g, ""));
  variants.add(upper.replace(/[.\-/]/g, "."));
  variants.add(upper.replace(/[.\-/]/g, "-"));
  variants.add(upper.replace(/[.\-/]/g, "/"));
  return Array.from(variants);
}

export function cusipsForTicker(input: string): string[] {
  buildIndexes();
  for (const v of tickerVariants(input)) {
    const hit = tickerToCusips!.get(v);
    if (hit && hit.length > 0) return hit;
  }
  return [];
}

export function tickerForCusip(cusip: string): string | null {
  buildIndexes();
  return cusipToTicker!.get(cusip) ?? null;
}
