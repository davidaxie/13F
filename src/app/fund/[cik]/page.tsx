import Link from "next/link";
import { notFound } from "next/navigation";
import { getFundInfo } from "@/lib/edgar";
import { getTopHoldings } from "@/lib/dashboard";
import { tickerForCusip } from "@/lib/stock-view";
import { formatDate, formatInt, formatPct, formatUSD, quarterLabel } from "@/lib/format";

export const revalidate = 3600;

export default async function FundPage({
  params,
}: {
  params: Promise<{ cik: string }>;
}) {
  const { cik } = await params;
  let fund: Awaited<ReturnType<typeof getFundInfo>>;
  let topHoldings: Awaited<ReturnType<typeof getTopHoldings>> = null;
  try {
    // getFundInfo is React-cached, so getTopHoldings calling it internally
    // dedupes against the page-level call — net: one info fetch, then
    // holdings fetch sequenced after it.
    [fund, topHoldings] = await Promise.all([
      getFundInfo(cik),
      getTopHoldings(cik, 10),
    ]);
  } catch {
    notFound();
  }

  if (!fund.name) notFound();

  const latest = fund.filings[0];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link
        href="/"
        className="text-xs uppercase tracking-widest text-muted transition-colors hover:text-foreground"
      >
        ← Search
      </Link>

      <div className="mt-4 border-b border-hairline pb-10">
        <h1 className="font-serif text-5xl leading-tight tracking-tight text-foreground">
          {fund.name}
        </h1>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted">
          <span className="font-mono uppercase tracking-wider">
            CIK {fund.cik}
          </span>
          {fund.sicDescription && <span>{fund.sicDescription}</span>}
          <span>
            {fund.filings.length} 13F{" "}
            {fund.filings.length === 1 ? "filing" : "filings"} on record
          </span>
        </div>
        <div className="mt-6">
          <Link
            href={`/fund/${fund.cik}/performance`}
            className="inline-block border-b border-accent/30 pb-0.5 text-sm text-accent transition-colors hover:border-accent"
          >
            View backtest &amp; performance →
          </Link>
        </div>
      </div>

      {topHoldings && topHoldings.rows.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between border-b border-hairline pb-3">
            <h2 className="font-serif text-2xl text-foreground">
              Top current holdings{" "}
              <span className="text-sm text-muted">
                · {quarterLabel(topHoldings.reportDate)}
              </span>
            </h2>
            <Link
              href={`/fund/${fund.cik}/${topHoldings.accessionNumber}`}
              className="text-xs uppercase tracking-widest text-accent transition-opacity hover:opacity-70"
            >
              All {topHoldings.positionCount.toLocaleString()} positions →
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-hairline text-left text-xs uppercase tracking-wider text-muted">
                  <th className="py-3 pr-3 font-normal">#</th>
                  <th className="py-3 px-3 font-normal">Issuer</th>
                  <th className="py-3 px-3 text-right font-normal">Value</th>
                  <th className="py-3 px-3 text-right font-normal">% Port</th>
                  <th className="py-3 pl-3 text-right font-normal">Shares</th>
                </tr>
              </thead>
              <tbody>
                {topHoldings.rows.map((r, i) => {
                  const ticker = tickerForCusip(r.cusip);
                  return (
                    <tr
                      key={`${r.cusip}-${r.titleOfClass}-${i}`}
                      className="border-b border-hairline/60 transition-colors hover:bg-subtle/40"
                    >
                      <td className="py-3 pr-3 text-xs text-muted tabular">
                        {i + 1}
                      </td>
                      <td className="py-3 px-3 text-foreground">
                        {ticker ? (
                          <Link
                            href={`/stock/${ticker}`}
                            className="font-serif text-base leading-tight transition-colors hover:text-accent"
                          >
                            {r.issuer}
                          </Link>
                        ) : (
                          <div className="font-serif text-base leading-tight">
                            {r.issuer}
                          </div>
                        )}
                        <div className="mt-0.5 font-mono text-xs text-muted">
                          {ticker ? `${ticker} · ` : ""}
                          {r.cusip}
                          {r.putCall ? ` · ${r.putCall}` : ""}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right tabular text-foreground">
                        {formatUSD(r.valueUsd, { compact: true })}
                      </td>
                      <td className="py-3 px-3 text-right tabular text-muted">
                        {formatPct(r.weightInPortfolio, 2)}
                      </td>
                      <td className="py-3 pl-3 text-right tabular text-muted">
                        {formatInt(r.shares)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-right text-xs text-muted">
            Top 10 are{" "}
            <span className="tabular text-foreground">
              {formatPct(
                topHoldings.rows.reduce(
                  (s, r) => s + r.weightInPortfolio,
                  0,
                ),
                1,
              )}
            </span>{" "}
            of the portfolio · filing total{" "}
            <span className="tabular text-foreground">
              {formatUSD(topHoldings.totalValueUsd, { compact: true })}
            </span>
          </div>
        </section>
      )}

      {fund.filings.length === 0 ? (
        <p className="mt-12 text-muted">
          No 13F filings found for this entity in EDGAR&apos;s recent
          submissions.
        </p>
      ) : (
        <div className="mt-12">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl text-foreground">
              Quarterly filings
            </h2>
            {latest && (
              <Link
                href={`/fund/${fund.cik}/${latest.accessionNumber}`}
                className="text-sm text-accent transition-opacity hover:opacity-70"
              >
                Open latest →
              </Link>
            )}
          </div>

          <ul className="divide-y divide-hairline border-y border-hairline">
            {fund.filings.map((f) => (
              <li key={f.accessionNumber}>
                <Link
                  href={`/fund/${fund.cik}/${f.accessionNumber}`}
                  className="group grid grid-cols-[1fr_auto_auto] items-center gap-8 py-5 transition-colors hover:bg-subtle/40"
                >
                  <div>
                    <div className="font-serif text-2xl text-foreground transition-colors group-hover:text-accent">
                      {quarterLabel(f.reportDate)}
                    </div>
                    <div className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">
                      {f.form} · {f.accessionNumber}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted">
                    <div className="uppercase tracking-widest text-xs">
                      Period
                    </div>
                    <div className="tabular mt-1 text-foreground/80">
                      {formatDate(f.reportDate)}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted">
                    <div className="uppercase tracking-widest text-xs">
                      Filed
                    </div>
                    <div className="tabular mt-1 text-foreground/80">
                      {formatDate(f.filingDate)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
