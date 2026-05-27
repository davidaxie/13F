// One-time / on-demand build script. Scrapes the constituents of the
// S&P 500, S&P 400 (mid-cap), and S&P 600 (small-cap) from their public
// Wikipedia pages and emits a ticker→GICS-sector/industry mapping to
// src/data/gics.json. The bundled JSON is imported statically by
// src/lib/refdata.ts so the runtime has no external dependency.
//
// Run: HTTPS_PROXY=… npx tsx scripts/build-gics.ts
//
// Refresh cadence: rerun whenever you want fresher sector tags (S&P
// reclassifies a couple companies a year; the file is content-stable
// otherwise). Commit the updated JSON.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { ProxyAgent, setGlobalDispatcher } from "undici";

const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
if (proxy) {
  setGlobalDispatcher(new ProxyAgent(proxy));
  process.stderr.write(`Routing through HTTPS_PROXY=${proxy}\n`);
}

type GicsRow = { ticker: string; sector: string; industry: string };

async function fetchWikipediaPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; 13f.mapperlab.co research tool)",
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`);
  return await res.text();
}

// All three pages (500/400/600) put the constituents in the FIRST
// wikitable. The first cell of each data row is the ticker symbol, the
// third is GICS Sector, the fourth is GICS Sub-Industry.
function parseConstituentsTable(html: string): GicsRow[] {
  const tableMatch = html.match(
    /<table[^>]*class="[^"]*wikitable[^"]*"[\s\S]*?<\/table>/,
  );
  if (!tableMatch) return [];
  const table = tableMatch[0];
  const rows: GicsRow[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(table))) {
    const inside = m[1];
    const cells = inside.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g);
    if (!cells || cells.length < 4) continue;
    if (cells[0].startsWith("<th")) continue; // header row
    const txt = (s: string): string =>
      s
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
        .replace(/&#\d+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const ticker = txt(cells[0]);
    const sector = txt(cells[2]);
    const industry = txt(cells[3]);
    if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(ticker)) continue;
    if (!sector) continue;
    rows.push({ ticker, sector, industry });
  }
  return rows;
}

const SOURCES: Array<{ url: string; label: string }> = [
  {
    url: "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
    label: "S&P 500",
  },
  {
    url: "https://en.wikipedia.org/wiki/List_of_S%26P_400_companies",
    label: "S&P 400 (mid-cap)",
  },
  {
    url: "https://en.wikipedia.org/wiki/List_of_S%26P_600_companies",
    label: "S&P 600 (small-cap)",
  },
];

async function main() {
  const merged = new Map<string, GicsRow>();
  for (const src of SOURCES) {
    process.stderr.write(`Fetching ${src.label}… `);
    try {
      const html = await fetchWikipediaPage(src.url);
      const rows = parseConstituentsTable(html);
      process.stderr.write(`${rows.length} rows\n`);
      for (const r of rows) {
        // First-write-wins: prefer the larger-cap source if a ticker
        // appears in multiple indices (shouldn't happen, but be safe).
        if (!merged.has(r.ticker)) merged.set(r.ticker, r);
      }
    } catch (err) {
      process.stderr.write(`FAILED: ${err}\n`);
    }
  }

  const out: Record<string, { sector: string; industry: string }> = {};
  for (const [ticker, row] of merged) {
    out[ticker] = { sector: row.sector, industry: row.industry };
  }

  const outPath = resolve(__dirname, "..", "src", "data", "gics.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out));
  process.stderr.write(
    `Wrote ${Object.keys(out).length} entries to ${outPath}\n`,
  );

  // Print sector histogram so the operator can sanity-check coverage.
  const counts = new Map<string, number>();
  for (const v of Object.values(out)) {
    counts.set(v.sector, (counts.get(v.sector) ?? 0) + 1);
  }
  process.stderr.write("\nSector distribution:\n");
  for (const [sec, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    process.stderr.write(`  ${sec.padEnd(28)} ${n}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
