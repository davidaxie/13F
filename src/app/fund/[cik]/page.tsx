import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkline } from "@/components/charts/sparkline";
import { WatchlistStar } from "@/components/watchlist-star";
import { AlertBell } from "@/components/alert-bell";
import { getFundInfo, getOwnershipFilings } from "@/lib/edgar";
import { getTopHoldings } from "@/lib/dashboard";
import { MARQUEE_FUNDS, FUND_STYLE_LABELS } from "@/lib/funds";
import { getSectorByTicker } from "@/lib/refdata";
import { getSnapshot } from "@/lib/snapshots";
import { tickerForCusip } from "@/lib/stock-view";
import { formatDate, formatInt, formatPct, formatUSD, quarterLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const revalidate = 3600;

export default async function FundPage({
  params,
}: {
  params: Promise<{ cik: string }>;
}) {
  const { cik } = await params;
  let fund: Awaited<ReturnType<typeof getFundInfo>>;
  let topHoldings: Awaited<ReturnType<typeof getTopHoldings>> = null;
  let ownership: Awaited<ReturnType<typeof getOwnershipFilings>> = [];
  try {
    // getFundInfo is React-cached, so getTopHoldings calling it internally
    // dedupes against the page-level call — net: one info fetch, one
    // holdings fetch, one ownership fetch, all in parallel where possible.
    [fund, topHoldings, ownership] = await Promise.all([
      getFundInfo(cik),
      getTopHoldings(cik, 10),
      getOwnershipFilings(cik),
    ]);
  } catch {
    notFound();
  }

  if (!fund.name) notFound();

  const latest = fund.filings[0];
  const cleanCik = fund.cik.replace(/^0+/, "");
  const meta = MARQUEE_FUNDS.find((f) => f.cik === cleanCik);
  const snapshot = getSnapshot(cleanCik);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link
        href="/"
        className="text-xs uppercase tracking-widest text-muted transition-colors hover:text-foreground"
      >
        ← Search
      </Link>

      <div className="mt-4 border-b border-hairline pb-10">
        <div className="flex items-baseline gap-3">
          <h1 className="font-serif text-5xl leading-tight tracking-tight text-foreground">
            {fund.name}
          </h1>
          {meta && (
            <span className="rounded-sm border border-hairline bg-subtle/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">
              {FUND_STYLE_LABELS[meta.style]}
            </span>
          )}
          <WatchlistStar kind="fund" id={fund.cik} />
          <AlertBell cik={cleanCik} />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted">
          <span className="font-mono uppercase tracking-wider">
            CIK {fund.cik}
          </span>
          {fund.sicDescription && <span>{fund.sicDescription}</span>}
          <span>
            {fund.filings.length} 13F{" "}
            {fund.filings.length === 1 ? "filing" : "filings"} on record
          </span>
          {meta?.headquarters && <span>{meta.headquarters}</span>}
          {meta?.aumApprox && <span>{meta.aumApprox}</span>}
        </div>

        {meta && (
          <div className="mt-6 max-w-3xl">
            <p className="text-base leading-relaxed text-foreground/85">
              {meta.tagline}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1 text-xs text-muted sm:grid-cols-2">
              {meta.manager && (
                <span>
                  <span className="uppercase tracking-widest text-muted/70">
                    Principal
                  </span>{" "}
                  · {meta.manager}
                </span>
              )}
              {meta.founded && (
                <span>
                  <span className="uppercase tracking-widest text-muted/70">
                    Founded
                  </span>{" "}
                  · {meta.founded}
                </span>
              )}
            </div>
          </div>
        )}

        {snapshot && snapshot.equityCurve.length > 1 && (
          <div className="mt-6 flex items-baseline gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-widest text-muted">
                $10k mirror, since {snapshot.startDate.slice(0, 4)}
              </div>
              <div className="mt-1">
                <Sparkline
                  data={snapshot.equityCurve.map((p) => ({ v: p.mirror }))}
                  width={520}
                  height={40}
                  stroke="var(--foreground)"
                />
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest text-muted">
                Mirror return
              </div>
              <div
                className={`mt-1 font-serif text-2xl tabular ${
                  snapshot.stats.mirrorReturnPct >= 0
                    ? "text-positive"
                    : "text-negative"
                }`}
              >
                {snapshot.stats.mirrorReturnPct >= 0 ? "+" : ""}
                {formatPct(snapshot.stats.mirrorReturnPct, 0)}
              </div>
            </div>
          </div>
        )}

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
                  <th className="py-3 px-3 hidden font-normal sm:table-cell">Sector</th>
                  <th className="py-3 px-3 text-right font-normal">Value</th>
                  <th className="py-3 px-3 text-right font-normal">% Port</th>
                  <th className="py-3 pl-3 text-right font-normal">Shares</th>
                </tr>
              </thead>
              <tbody>
                {topHoldings.rows.map((r, i) => {
                  const ticker = tickerForCusip(r.cusip);
                  const sector = getSectorByTicker(ticker);
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
                      <td className="py-3 px-3 hidden text-xs text-muted sm:table-cell">
                        {sector ? sector.sector : "—"}
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

      {ownership.length > 0 && (
        <section className="mt-16">
          <div className="flex items-baseline justify-between border-b border-hairline pb-3">
            <h2 className="font-serif text-2xl text-foreground">
              5%+ ownership filings
            </h2>
            <span className="text-xs uppercase tracking-widest text-muted">
              SC 13D / 13G · activist or passive 5%+ stakes
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted">
            Filed whenever this investor crosses 5% ownership of a public
            company&apos;s voting equity.{" "}
            <strong>SC 13D</strong> = active (intent to influence
            management). <strong>SC 13G</strong> = passive. Amendments
            (&hellip;/A) follow each subsequent material change. These often
            precede 13F disclosure by weeks and are the canonical activism
            signal.
          </p>
          <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
            {ownership.slice(0, 25).map((f) => {
              const isActivist =
                f.form === "SC 13D" || f.form === "SC 13D/A";
              const isAmendment = f.form.endsWith("/A");
              const accDashless = f.accessionNumber.replace(/-/g, "");
              const edgarUrl = `https://www.sec.gov/Archives/edgar/data/${fund.cik}/${accDashless}/${f.primaryDocument || `${f.accessionNumber}-index.htm`}`;
              return (
                <li key={f.accessionNumber}>
                  <a
                    href={edgarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group grid grid-cols-[140px_1fr_auto] items-center gap-4 py-3 transition-colors hover:bg-subtle/40"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest",
                          isActivist
                            ? "border-accent/40 bg-accent/10 text-accent"
                            : "border-hairline bg-subtle/50 text-muted",
                        )}
                      >
                        {f.form}
                      </span>
                      {isAmendment && (
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted/70">
                          amend
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs uppercase tracking-wider text-muted truncate">
                      {f.accessionNumber}
                    </div>
                    <div className="tabular text-sm text-foreground/80">
                      {formatDate(f.filingDate)}
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
          {ownership.length > 25 && (
            <div className="mt-3 text-right text-xs text-muted">
              Showing 25 of {ownership.length} recent ownership filings.{" "}
              <a
                href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${fund.cik}&type=SC+13&dateb=&owner=include&count=40`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent transition-colors hover:underline"
              >
                Browse all on EDGAR ↗
              </a>
            </div>
          )}
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
            {fund.filings.map((f) => {
              const isAmendment = f.form.endsWith("/A");
              return (
                <li key={f.accessionNumber}>
                  <Link
                    href={`/fund/${fund.cik}/${f.accessionNumber}`}
                    className="group grid grid-cols-[1fr_auto_auto] items-center gap-8 py-5 transition-colors hover:bg-subtle/40"
                  >
                    <div>
                      <div className="flex items-baseline gap-2">
                        <div className="font-serif text-2xl text-foreground transition-colors group-hover:text-accent">
                          {quarterLabel(f.reportDate)}
                        </div>
                        {isAmendment && (
                          <span
                            className="rounded-sm border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-accent"
                            title="13F-HR/A amendment — often a confidential-treatment release (e.g. Berkshire's AAPL pattern)"
                          >
                            Amendment
                          </span>
                        )}
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
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
