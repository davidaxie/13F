// One-time / on-demand build script. Fetches SEC's published ticker→CIK
// directory and bundles it as JSON for ticker-keyed lookups (used by Form 4
// insider-transaction surfacing on /stock/[ticker]).
//
// Run: HTTPS_PROXY=… npx tsx scripts/build-company-tickers.ts
// Refresh cadence: rerun when you want fresher mappings (new IPOs, ticker
// changes); SEC updates this file daily.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ProxyAgent, setGlobalDispatcher } from "undici";

const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
if (proxy) {
  setGlobalDispatcher(new ProxyAgent(proxy));
  process.stderr.write(`Routing through HTTPS_PROXY=${proxy}\n`);
}

type Row = { cik_str: number; ticker: string; title: string };

async function main() {
  const url = "https://www.sec.gov/files/company_tickers.json";
  process.stderr.write(`Fetching ${url}…`);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; 13f.mapperlab.co research tool)",
    },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`);
  const data = (await res.json()) as Record<string, Row>;
  process.stderr.write(` ${Object.keys(data).length} entries\n`);

  // Output as ticker → cik. Strip leading zeros from CIK so it matches the
  // canonical form used elsewhere in the app.
  const out: Record<string, { cik: string; name: string }> = {};
  for (const row of Object.values(data)) {
    if (!row.ticker || !row.cik_str) continue;
    const ticker = row.ticker.toUpperCase();
    if (!out[ticker]) {
      out[ticker] = {
        cik: String(row.cik_str),
        name: row.title,
      };
    }
  }

  const outPath = resolve(__dirname, "..", "src", "data", "company-tickers.json");
  writeFileSync(outPath, JSON.stringify(out));
  process.stderr.write(
    `Wrote ${Object.keys(out).length} ticker→CIK mappings to ${outPath}\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
