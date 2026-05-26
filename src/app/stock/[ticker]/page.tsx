import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkline } from "@/components/charts/sparkline";
import { getStockView } from "@/lib/stock-view";
import { formatDate, formatInt, formatPct, formatUSD, quarterLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-static";

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: rawTicker } = await params;
  const view = getStockView(decodeURIComponent(rawTicker));
  if (!view) notFound();

  const hasAnyCoverage =
    view.currentHolders.length > 0 || view.pastHolders.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <Link
        href="/dashboard"
        className="text-xs uppercase tracking-widest text-muted transition-colors hover:text-foreground"
      >
        ← Dashboard
      </Link>

      <div className="mt-4 border-b border-hairline pb-10">
        <div className="text-xs uppercase tracking-widest text-muted">
          Stock
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <h1 className="font-mono text-5xl tracking-tight text-foreground sm:text-6xl">
            {view.ticker}
          </h1>
          <span className="font-serif text-2xl text-muted">{view.issuer}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted">
          {view.latestPrice != null && (
            <span>
              Latest close{" "}
              <span className="tabular text-foreground">
                ${view.latestPrice.toFixed(view.latestPrice < 10 ? 2 : 0)}
              </span>
            </span>
          )}
          <span>
            <span className="tabular text-foreground">
              {view.currentHolders.length}
            </span>{" "}
            of {view.stakes.length} marquee funds currently hold
          </span>
          <span>
            <span className="tabular text-foreground">
              {view.cusips.length}
            </span>{" "}
            CUSIP{view.cusips.length > 1 ? "s" : ""} mapped
          </span>
        </div>
      </div>

      {!hasAnyCoverage ? (
        <section className="mt-16">
          <p className="font-serif text-lg text-muted">
            None of the {view.stakes.length} marquee funds tracked here have
            ever reported a position in <span className="text-foreground">{view.ticker}</span>.
            That doesn&apos;t mean it&apos;s unowned — only that it&apos;s
            outside this universe.
          </p>
          <div className="mt-6 text-sm text-muted">
            CUSIPs matched:{" "}
            <code className="font-mono text-xs">{view.cusips.join(", ")}</code>
          </div>
        </section>
      ) : (
        <>
          {/* ============= STATS ============= */}
          <section className="mt-10 grid grid-cols-2 gap-x-10 gap-y-8 border-b border-hairline pb-10 sm:grid-cols-4">
            <Stat
              label="Current holders"
              value={view.currentHolders.length.toLocaleString()}
              sub={`${view.stakes.length} funds tracked`}
            />
            <Stat
              label="Ever held"
              value={(
                view.currentHolders.length + view.pastHolders.length
              ).toLocaleString()}
              sub="Current + past"
            />
            <Stat
              label="New this quarter"
              value={view.newThisQuarter.length.toLocaleString()}
              tone={view.newThisQuarter.length > 0 ? "up" : undefined}
            />
            <Stat
              label="Exited this quarter"
              value={view.exitedThisQuarter.length.toLocaleString()}
              tone={view.exitedThisQuarter.length > 0 ? "down" : undefined}
            />
          </section>

          {/* ============= OWNERSHIP TIMELINE ============= */}
          {view.ownershipTimeline.length > 1 && (
            <section className="mt-12">
              <div className="border-b border-hairline pb-3">
                <h2 className="font-serif text-2xl text-foreground">
                  Marquee-fund ownership over time
                </h2>
              </div>
              <div className="mt-6 flex items-end gap-6">
                <div className="min-w-0 flex-1">
                  <Sparkline
                    data={view.ownershipTimeline.map((p) => ({ v: p.count }))}
                    width={640}
                    height={64}
                    stroke="var(--foreground)"
                  />
                  <div className="mt-2 flex justify-between text-xs tabular text-muted">
                    <span>{formatDate(view.ownershipTimeline[0].date)}</span>
                    <span>
                      {formatDate(
                        view.ownershipTimeline[
                          view.ownershipTimeline.length - 1
                        ].date,
                      )}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-widest text-muted">
                    Now
                  </div>
                  <div className="mt-1 font-serif text-3xl tabular text-foreground">
                    {
                      view.ownershipTimeline[view.ownershipTimeline.length - 1]
                        .count
                    }
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ============= THIS QUARTER ACTIVITY ============= */}
          {(view.newThisQuarter.length > 0 ||
            view.exitedThisQuarter.length > 0) && (
            <section className="mt-16">
              <div className="border-b border-hairline pb-3">
                <h2 className="font-serif text-2xl text-foreground">
                  This quarter&apos;s activity
                </h2>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-10 md:grid-cols-2">
                <ActivityList
                  title="New positions opened"
                  tone="positive"
                  items={view.newThisQuarter.map((s) => ({
                    fund: s.fund,
                    date: s.entryDate,
                    // Shares are accurate here since the position was just
                    // opened — no time for adds/trims to drift them yet.
                    valueUsd:
                      s.currentPrice != null
                        ? s.sharesAtOpen * s.currentPrice
                        : null,
                    shares: s.sharesAtOpen,
                  }))}
                />
                <ActivityList
                  title="Positions exited"
                  tone="negative"
                  items={view.exitedThisQuarter.map((s) => ({
                    fund: s.fund,
                    date: s.exitDate,
                    valueUsd: null,
                    returnPct: s.closedReturnPct,
                  }))}
                />
              </div>
            </section>
          )}

          {/* ============= CURRENT HOLDERS ============= */}
          {view.currentHolders.length > 0 && (
            <section className="mt-16">
              <div className="flex items-baseline justify-between border-b border-hairline pb-3">
                <h2 className="font-serif text-2xl text-foreground">
                  Current holders
                </h2>
                <span className="text-xs uppercase tracking-widest text-muted">
                  Sorted by tenure (longest first)
                </span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-hairline text-left text-xs uppercase tracking-wider text-muted">
                      <th className="py-3 pr-3 font-normal">Fund</th>
                      <th className="py-3 px-3 text-right font-normal">
                        First bought
                      </th>
                      <th className="py-3 px-3 text-right font-normal">
                        Held
                      </th>
                      <th className="py-3 px-3 text-right font-normal">
                        Entry price
                      </th>
                      <th className="py-3 px-3 text-right font-normal">
                        Latest close
                      </th>
                      <th className="py-3 pl-3 text-right font-normal">
                        Return on entry
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.currentHolders.map((s) => {
                      return (
                        <tr
                          key={s.fund.cik}
                          className="border-b border-hairline/60 transition-colors hover:bg-subtle/40"
                        >
                          <td className="py-3 pr-3">
                            <Link
                              href={`/fund/${s.fund.cik}/performance`}
                              className="font-serif text-base text-foreground hover:text-accent"
                            >
                              {s.fund.displayName}
                            </Link>
                            {s.tradeCount > 1 && (
                              <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted">
                                re-entered
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right text-xs text-muted">
                            {quarterLabel(s.firstEverEntryDate)}
                          </td>
                          <td className="py-3 px-3 text-right tabular text-muted">
                            {s.heldQuartersApprox}Q
                          </td>
                          <td className="py-3 px-3 text-right tabular text-muted">
                            ${s.entrySharePrice.toFixed(
                              s.entrySharePrice < 10 ? 2 : 0,
                            )}
                          </td>
                          <td className="py-3 px-3 text-right tabular text-muted">
                            {s.currentPrice != null
                              ? `$${s.currentPrice.toFixed(s.currentPrice < 10 ? 2 : 0)}`
                              : "—"}
                          </td>
                          <td
                            className={cn(
                              "py-3 pl-3 text-right tabular",
                              s.priceReturnPct == null
                                ? "text-muted"
                                : s.priceReturnPct >= 0
                                  ? "text-positive"
                                  : "text-negative",
                            )}
                          >
                            {s.priceReturnPct == null
                              ? "—"
                              : `${s.priceReturnPct >= 0 ? "+" : ""}${formatPct(s.priceReturnPct, 0)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                &ldquo;Return on entry&rdquo; is the price-only move from the
                fund&apos;s first disclosure to today &mdash; it ignores any
                adds, trims, or dividends. A fund that built its position over
                multiple quarters has a true cost basis somewhere between
                entry price and latest close; this figure is the upper bound.
              </p>
            </section>
          )}

          {/* ============= PAST HOLDERS ============= */}
          {view.pastHolders.length > 0 && (
            <section className="mt-16">
              <div className="flex items-baseline justify-between border-b border-hairline pb-3">
                <h2 className="font-serif text-2xl text-foreground">
                  Past holders
                </h2>
                <span className="text-xs uppercase tracking-widest text-muted">
                  Funds that exited at some point
                </span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-hairline text-left text-xs uppercase tracking-wider text-muted">
                      <th className="py-3 pr-3 font-normal">Fund</th>
                      <th className="py-3 px-3 text-right font-normal">
                        Last entry
                      </th>
                      <th className="py-3 px-3 text-right font-normal">
                        Exited
                      </th>
                      <th className="py-3 px-3 text-right font-normal">
                        Entry → Exit
                      </th>
                      <th className="py-3 pl-3 text-right font-normal">
                        Return
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.pastHolders.map((s) => (
                      <tr
                        key={s.fund.cik}
                        className="border-b border-hairline/60 transition-colors hover:bg-subtle/40"
                      >
                        <td className="py-3 pr-3">
                          <Link
                            href={`/fund/${s.fund.cik}/performance`}
                            className="font-serif text-base text-foreground hover:text-accent"
                          >
                            {s.fund.displayName}
                          </Link>
                          {s.tradeCount > 1 && (
                            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted">
                              {s.tradeCount}× in & out
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-xs text-muted">
                          {quarterLabel(s.entryDate)}
                        </td>
                        <td className="py-3 px-3 text-right text-xs text-muted">
                          {quarterLabel(s.exitDate)}
                        </td>
                        <td className="py-3 px-3 text-right tabular text-muted">
                          {s.exitSharePrice != null
                            ? `→ $${s.exitSharePrice.toFixed(s.exitSharePrice < 10 ? 2 : 0)}`
                            : "—"}
                        </td>
                        <td
                          className={cn(
                            "py-3 pl-3 text-right tabular",
                            s.closedReturnPct >= 0
                              ? "text-positive"
                              : "text-negative",
                          )}
                        >
                          {s.closedReturnPct >= 0 ? "+" : ""}
                          {formatPct(s.closedReturnPct, 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ============= CAVEATS ============= */}
          <section className="mt-20 rounded border-l-2 border-accent/40 bg-subtle/30 px-6 py-5 text-xs leading-relaxed text-muted">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-foreground/70">
              Caveats
            </div>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                Covers only the {view.stakes.length} marquee funds tracked
                here, not the full institutional universe. A &ldquo;0
                holders&rdquo; reading does not mean unowned.
              </li>
              <li>
                Heavy funds (Renaissance, Citadel, Two Sigma, Soros) use
                8-quarter snapshots, so their pre-2023 history is missing.
              </li>
              <li>
                &ldquo;Current&rdquo; reflects each fund&apos;s most recent
                13F — filings lag the actual trade by up to 45 days; positions
                shown may have changed since.
              </li>
              <li>
                Cost = price at the entry filing date. Re-entered positions
                show the most recent open lot.
              </li>
              <li>
                Options, ADRs, and unmapped CUSIPs are excluded from the
                follower-backtest pipeline that produces these snapshots, so
                certain holding types won&apos;t appear here.
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down";
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 font-serif text-3xl tabular text-foreground",
          tone === "up" && "text-positive",
          tone === "down" && "text-negative",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

type ActivityItem = {
  fund: { cik: string; displayName: string };
  date: string;
  valueUsd: number | null;
  shares?: number;
  returnPct?: number;
};

function ActivityList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "positive" | "negative";
  items: ActivityItem[];
}) {
  return (
    <div>
      <div className="border-b border-hairline pb-2">
        <h3 className="font-serif text-lg text-foreground">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">None.</p>
      ) : (
        <ul className="mt-2 divide-y divide-hairline/60">
          {items.map((it) => (
            <li key={it.fund.cik}>
              <Link
                href={`/fund/${it.fund.cik}/performance`}
                className="group flex items-baseline justify-between gap-3 py-3 transition-colors hover:bg-subtle/40"
              >
                <div className="min-w-0">
                  <div className="font-serif text-base text-foreground transition-colors group-hover:text-accent">
                    {it.fund.displayName}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {quarterLabel(it.date)} ·{" "}
                    {it.shares != null
                      ? `${formatInt(it.shares)} shares`
                      : it.returnPct != null
                        ? `${it.returnPct >= 0 ? "+" : ""}${formatPct(it.returnPct, 0)}`
                        : ""}
                  </div>
                </div>
                <div
                  className={cn(
                    "shrink-0 text-right tabular text-sm",
                    tone === "positive" ? "text-positive" : "text-negative",
                  )}
                >
                  {it.valueUsd != null
                    ? `${tone === "positive" ? "+" : "−"}${formatUSD(it.valueUsd, { compact: true })}`
                    : tone === "positive"
                      ? "NEW"
                      : "EXIT"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
