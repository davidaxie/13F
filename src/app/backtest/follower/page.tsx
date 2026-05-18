import Link from "next/link";
import { computeFollowerBacktest } from "@/lib/follower-backtest";
import { CumulativeAlphaChart } from "@/components/charts/cumulative-alpha";
import { formatPct, formatUSD, quarterLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function FollowerBacktestPage() {
  const result = computeFollowerBacktest();
  const { stats, perFund, realizedSeries, signals, positionSizeUsd } = result;

  // Top movers
  const topGainers = [...signals]
    .filter((s) => s.status === "closed")
    .sort((a, b) => b.alphaUsd - a.alphaUsd)
    .slice(0, 10);
  const topLosers = [...signals]
    .filter((s) => s.status === "closed")
    .sort((a, b) => a.alphaUsd - b.alphaUsd)
    .slice(0, 10);

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
          Backtest
        </div>
        <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground">
          The disclosure follower
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          Buy ${positionSizeUsd.toLocaleString()} of every position each
          marquee fund discloses (new opens and adds), at the filing-date
          price. Sell everything the moment the fund&apos;s next filing no
          longer shows it. Mark still-open positions to market.
        </p>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted/80">
          {stats.totalSignals.toLocaleString()} buy signals across{" "}
          {perFund.length} funds · {stats.closedSignals.toLocaleString()}{" "}
          closed · {stats.openSignals.toLocaleString()} marked-to-market · avg
          hold {Math.round(stats.avgHoldDays)} days
        </p>
      </div>

      {/* Headline ============================================================ */}
      <section className="mt-12">
        <div className="border-b border-hairline pb-3">
          <h2 className="font-serif text-2xl text-foreground">Headline</h2>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-4">
          <Stat
            label="Total invested"
            value={formatUSD(stats.totalInvestedUsd, { compact: true })}
            sub={`${stats.totalSignals.toLocaleString()} signals × $${(positionSizeUsd / 1000).toFixed(0)}k`}
          />
          <Stat
            label="Follower ending value"
            value={formatUSD(stats.followerFinalUsd, { compact: true })}
            tone={stats.followerReturnPct >= 0 ? "up" : "down"}
            sub={`${stats.followerReturnPct >= 0 ? "+" : ""}${formatPct(stats.followerReturnPct, 1)} on capital`}
          />
          <Stat
            label="SPY ending value"
            value={formatUSD(stats.spyFinalUsd, { compact: true })}
            sub={`${stats.spyReturnPct >= 0 ? "+" : ""}${formatPct(stats.spyReturnPct, 1)} on same dollars`}
          />
          <Stat
            label="Alpha vs SPY"
            value={`${stats.alphaUsd >= 0 ? "+" : "−"}${formatUSD(Math.abs(stats.alphaUsd), { compact: true })}`}
            tone={stats.alphaUsd >= 0 ? "up" : "down"}
            sub={`${stats.alphaPct >= 0 ? "+" : ""}${formatPct(stats.alphaPct, 1)} of invested capital`}
          />
        </div>

        <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-8 border-t border-hairline pt-8 sm:grid-cols-4">
          <Stat
            label="Beat SPY (win rate)"
            value={`${(stats.winRate * 100).toFixed(0)}%`}
            sub="signals with positive alpha"
          />
          <Stat
            label="Avg signal return"
            value={`${stats.avgReturnPct >= 0 ? "+" : ""}${formatPct(stats.avgReturnPct, 1)}`}
            tone={stats.avgReturnPct >= 0 ? "up" : "down"}
          />
          <Stat
            label="Median signal return"
            value={`${stats.medianReturnPct >= 0 ? "+" : ""}${formatPct(stats.medianReturnPct, 1)}`}
            tone={stats.medianReturnPct >= 0 ? "up" : "down"}
          />
          <Stat
            label="Avg hold"
            value={`${Math.round(stats.avgHoldDays)}d`}
            sub={
              stats.avgHoldDays > 60
                ? `${(stats.avgHoldDays / 90).toFixed(1)} quarters`
                : ""
            }
          />
        </div>
      </section>

      {/* Cumulative alpha curve =============================================== */}
      <section className="mt-20">
        <div className="flex items-baseline justify-between border-b border-hairline pb-3">
          <h2 className="font-serif text-2xl text-foreground">
            Realized P&amp;L curve
          </h2>
          <span className="text-xs uppercase tracking-widest text-muted">
            Cumulative profit · follower vs SPY
          </span>
        </div>
        <div className="mt-6">
          <CumulativeAlphaChart data={realizedSeries} />
        </div>
        <div className="mt-4 flex flex-wrap gap-6 text-xs text-muted">
          <span className="flex items-center gap-2">
            <span className="inline-block h-[2px] w-6 bg-foreground" />
            Follower P&amp;L (realized)
          </span>
          <span className="flex items-center gap-2">
            <span
              className="inline-block h-[2px] w-6"
              style={{
                backgroundImage:
                  "linear-gradient(to right, var(--muted) 50%, transparent 50%)",
                backgroundSize: "6px 2px",
              }}
            />
            $10k-per-signal in SPY over the same windows
          </span>
        </div>
      </section>

      {/* Per-fund contribution ================================================ */}
      <section className="mt-20">
        <div className="border-b border-hairline pb-3">
          <h2 className="font-serif text-2xl text-foreground">Per-fund contribution</h2>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-hairline text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-3 pr-3 font-normal">Fund</th>
                <th className="py-3 px-3 text-right font-normal">Signals</th>
                <th className="py-3 px-3 text-right font-normal">Invested</th>
                <th className="py-3 px-3 text-right font-normal">Follower</th>
                <th className="py-3 px-3 text-right font-normal">SPY</th>
                <th className="py-3 px-3 text-right font-normal">Alpha</th>
                <th className="py-3 px-3 text-right font-normal">Return</th>
                <th className="py-3 pl-3 text-right font-normal">Win</th>
              </tr>
            </thead>
            <tbody>
              {perFund.map((f) => (
                <tr
                  key={f.fundCik}
                  className="border-b border-hairline/60 transition-colors hover:bg-subtle/40"
                >
                  <td className="py-3 pr-3 text-foreground">
                    <Link
                      href={`/fund/${f.fundCik}/performance`}
                      className="font-serif text-base leading-tight hover:text-accent"
                    >
                      {f.fundName}
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-right tabular text-muted">
                    {f.signals.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right tabular text-muted">
                    {formatUSD(f.invested, { compact: true })}
                  </td>
                  <td className="py-3 px-3 text-right tabular text-foreground">
                    {formatUSD(f.followerFinal, { compact: true })}
                  </td>
                  <td className="py-3 px-3 text-right tabular text-muted">
                    {formatUSD(f.spyFinal, { compact: true })}
                  </td>
                  <td
                    className={cn(
                      "py-3 px-3 text-right tabular",
                      f.alphaUsd >= 0 ? "text-positive" : "text-negative",
                    )}
                  >
                    {f.alphaUsd >= 0 ? "+" : "−"}
                    {formatUSD(Math.abs(f.alphaUsd), { compact: true })}
                  </td>
                  <td
                    className={cn(
                      "py-3 px-3 text-right tabular",
                      f.followerReturnPct >= 0
                        ? "text-positive"
                        : "text-negative",
                    )}
                  >
                    {f.followerReturnPct >= 0 ? "+" : ""}
                    {formatPct(f.followerReturnPct, 1)}
                  </td>
                  <td className="py-3 pl-3 text-right tabular text-muted">
                    {(f.winRate * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top gainers / losers ================================================= */}
      <section className="mt-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          <SignalList title="Biggest alpha winners" signals={topGainers} />
          <SignalList
            title="Biggest alpha losses"
            signals={topLosers}
            negative
          />
        </div>
      </section>

      {/* Caveats =============================================================== */}
      <section className="mt-20 rounded border-l-2 border-accent/40 bg-subtle/30 px-6 py-5 text-xs leading-relaxed text-muted">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-foreground/70">
          Caveats
        </div>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            Heavy funds (Renaissance, Bridgewater, Citadel, Two Sigma) use
            8-quarter snapshots; the rest use full history. The aggregate
            return reflects this uneven sampling.
          </li>
          <li>
            All buys priced at the 13F filing date (45 days after period-end —
            the earliest a follower could act). Exits priced at the next
            filing&apos;s date.
          </li>
          <li>
            No transaction costs, taxes, slippage, or dividends modeled.
            Prices are unadjusted-close from Yahoo Finance.
          </li>
          <li>
            Open positions are marked-to-market at the most recent close. Their
            sell-side P&amp;L is unrealized.
          </li>
          <li>
            Signals with unmapped tickers (small/foreign/delisted) are
            excluded. Options and short positions are excluded throughout.
          </li>
        </ul>
      </section>
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
      <div className="text-xs uppercase tracking-widest text-muted">{label}</div>
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

function SignalList({
  title,
  signals,
  negative,
}: {
  title: string;
  signals: ReturnType<typeof computeFollowerBacktest>["signals"];
  negative?: boolean;
}) {
  return (
    <div>
      <div className="border-b border-hairline pb-3">
        <h3 className="font-serif text-xl text-foreground">{title}</h3>
      </div>
      <ul className="divide-y divide-hairline/60">
        {signals.map((s, i) => (
          <li key={`${s.fundCik}-${s.cusip}-${s.buyDate}-${i}`}>
            <Link
              href={`/fund/${s.fundCik}/performance`}
              className="group block py-3 transition-colors hover:bg-subtle/40"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-serif text-base leading-tight text-foreground transition-colors group-hover:text-accent">
                    {s.ticker} <span className="text-muted">·</span>{" "}
                    <span className="text-muted text-sm">{s.issuer}</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {s.fundName} · {quarterLabel(s.buyDate)} →{" "}
                    {s.sellDate ? quarterLabel(s.sellDate) : "open"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={cn(
                      "tabular text-sm",
                      negative ? "text-negative" : "text-positive",
                    )}
                  >
                    {negative ? "−" : "+"}
                    {formatUSD(Math.abs(s.alphaUsd), { compact: true })}
                  </div>
                  <div className="mt-0.5 text-xs text-muted tabular">
                    {s.returnPct >= 0 ? "+" : ""}
                    {formatPct(s.returnPct, 0)}% vs SPY{" "}
                    {s.spyReturnPct >= 0 ? "+" : ""}
                    {formatPct(s.spyReturnPct, 0)}%
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
