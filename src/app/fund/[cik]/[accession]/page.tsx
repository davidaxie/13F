import Link from "next/link";
import { notFound } from "next/navigation";
import { getFundInfo, getHoldings, isValueInThousands } from "@/lib/edgar";
import type { Holding } from "@/lib/parse-13f";
import { HoldingsTable, type Row } from "@/components/holdings-table";
import { ExitedList, type ExitedRow } from "@/components/exited-list";
import {
  formatDate,
  formatPct,
  formatUSD,
  quarterLabel,
} from "@/lib/format";
import { tickerForCusip } from "@/lib/stock-view";

export const revalidate = 3600;

function toDollars(rawValue: number, filingDate: string): number {
  return isValueInThousands(filingDate) ? rawValue * 1000 : rawValue;
}

function key(h: Holding): string {
  return `${h.cusip}|${h.titleOfClass}|${h.putCall ?? ""}`;
}

function aggregate(rows: Holding[]) {
  const map = new Map<string, Holding & { count: number }>();
  for (const r of rows) {
    const k = key(r);
    const existing = map.get(k);
    if (existing) {
      existing.value += r.value;
      existing.shares += r.shares;
      existing.count += 1;
    } else {
      map.set(k, { ...r, count: 1 });
    }
  }
  return map;
}

export default async function FilingPage({
  params,
}: {
  params: Promise<{ cik: string; accession: string }>;
}) {
  const { cik, accession } = await params;
  let fund: Awaited<ReturnType<typeof getFundInfo>>;
  try {
    fund = await getFundInfo(cik);
  } catch {
    notFound();
  }
  if (!fund.name) notFound();

  const filing = fund.filings.find(
    (f) => f.accessionNumber === accession,
  );
  if (!filing) notFound();

  const filingIdx = fund.filings.findIndex(
    (f) => f.accessionNumber === accession,
  );
  const prevFiling = fund.filings[filingIdx + 1];

  let holdings: Holding[] = [];
  let prevHoldings: Holding[] = [];
  let fetchError: string | null = null;

  try {
    const [curr, prev] = await Promise.all([
      getHoldings(fund.cik, accession),
      prevFiling
        ? getHoldings(fund.cik, prevFiling.accessionNumber).catch(() => [])
        : Promise.resolve([] as Holding[]),
    ]);
    holdings = curr;
    prevHoldings = prev;
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Failed to load filing";
  }

  const currMap = aggregate(holdings);
  const prevMap = aggregate(prevHoldings);

  const totalValueRaw = Array.from(currMap.values()).reduce(
    (s, h) => s + h.value,
    0,
  );
  const totalValueUsd = toDollars(totalValueRaw, filing.filingDate);

  const rows: Row[] = Array.from(currMap.entries()).map(([k, h]) => {
    const prev = prevMap.get(k);
    const valueUsd = toDollars(h.value, filing.filingDate);
    const prevValueUsd = prev
      ? toDollars(prev.value, prevFiling?.filingDate ?? filing.filingDate)
      : null;
    const prevShares = prev ? prev.shares : null;

    let changeType: Row["changeType"];
    let shareChangePct: number | null = null;
    if (!prev) {
      changeType = "new";
    } else if (prev.shares === h.shares) {
      changeType = "unchanged";
    } else {
      shareChangePct =
        prev.shares > 0 ? ((h.shares - prev.shares) / prev.shares) * 100 : null;
      changeType = h.shares > prev.shares ? "increased" : "decreased";
    }

    return {
      issuer: h.issuer,
      titleOfClass: h.titleOfClass,
      cusip: h.cusip,
      ticker: h.putCall ? null : tickerForCusip(h.cusip),
      valueUsd,
      shares: h.shares,
      putCall: h.putCall,
      pctOfPortfolio: totalValueRaw > 0 ? (h.value / totalValueRaw) * 100 : 0,
      prevValueUsd,
      prevShares,
      changeType,
      shareChangePct,
    };
  });

  rows.sort((a, b) => b.valueUsd - a.valueUsd);

  const newCount = rows.filter((r) => r.changeType === "new").length;
  const top10Pct = rows
    .slice(0, 10)
    .reduce((s, r) => s + r.pctOfPortfolio, 0);

  const exitedKeys = Array.from(prevMap.keys()).filter((k) => !currMap.has(k));
  const exitedRows: ExitedRow[] = exitedKeys
    .map((k) => prevMap.get(k))
    .filter((h): h is Holding & { count: number } => Boolean(h))
    .map((h) => ({
      issuer: h.issuer,
      cusip: h.cusip,
      ticker: tickerForCusip(h.cusip),
      prevValueUsd: toDollars(
        h.value,
        prevFiling?.filingDate ?? filing.filingDate,
      ),
    }))
    .sort((a, b) => b.prevValueUsd - a.prevValueUsd);

  const accessionUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${fund.cik}&type=13F-HR&dateb=&owner=include&count=40`;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <Link
        href={`/fund/${fund.cik}`}
        className="text-xs uppercase tracking-widest text-muted transition-colors hover:text-foreground"
      >
        ← {fund.name}
      </Link>

      <div className="mt-4 border-b border-hairline pb-10">
        <div className="text-xs uppercase tracking-widest text-muted">
          {filing.form}
        </div>
        <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground">
          {quarterLabel(filing.reportDate)}
        </h1>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted">
          <span>Period {formatDate(filing.reportDate)}</span>
          <span>Filed {formatDate(filing.filingDate)}</span>
          <a
            href={accessionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            View on EDGAR ↗
          </a>
        </div>
      </div>

      {fetchError ? (
        <p className="mt-10 text-negative">{fetchError}</p>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-8 border-b border-hairline pb-10 sm:grid-cols-4">
            <Stat
              label="Positions"
              value={rows.length.toLocaleString()}
            />
            <Stat
              label="Total value"
              value={formatUSD(totalValueUsd, { compact: true })}
            />
            <Stat label="Top 10 concentration" value={formatPct(top10Pct, 1)} />
            <Stat
              label="New positions"
              value={prevFiling ? newCount.toLocaleString() : "—"}
            />
          </div>

          {prevFiling && exitedRows.length > 0 && (
            <div className="mt-10 border-b border-hairline pb-10">
              <h3 className="font-serif text-xl text-foreground">
                Exited positions
                <span className="ml-2 text-sm text-muted">
                  · {exitedRows.length.toLocaleString()} vs.{" "}
                  {quarterLabel(prevFiling.reportDate)}
                </span>
              </h3>
              <ExitedList rows={exitedRows} />
            </div>
          )}

          <HoldingsTable
            rows={rows}
            totalValueUsd={totalValueUsd}
            exportContext={{
              fundName: fund.name,
              quarter: quarterLabel(filing.reportDate),
            }}
          />
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted">
        {label}
      </div>
      <div className="mt-2 font-serif text-3xl tabular text-foreground">
        {value}
      </div>
    </div>
  );
}
