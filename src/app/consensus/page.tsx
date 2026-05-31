import Link from "next/link";
import {
  computeConsensusView,
  type ConsensusName,
} from "@/lib/consensus";
import { formatDate, formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-static";

export default function ConsensusPage() {
  const view = computeConsensusView();

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
          Cross-fund
        </div>
        <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground">
          Consensus & crowding
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          Which names {view.fundsCovered}{" "}marquee funds collectively hold,
          which ones they&apos;re piling into this quarter, which ones
          they&apos;re dumping, and where the smart money disagrees with
          itself.
        </p>
        <div className="mt-3 text-xs text-muted">
          {view.asOfDate && (
            <>
              As-of latest disclosure across the universe:{" "}
              <span className="tabular text-foreground/80">
                {formatDate(view.asOfDate)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Most owned */}
      <Section
        title="Most-owned stocks"
        subtitle="Held by the most marquee funds · ties broken by combined capital"
        items={view.mostOwned.slice(0, 25)}
        emptyText="Not enough overlap to compute."
        primaryMetric={(n) => ({
          label: `${n.totalHolders} of ${view.fundsCovered}`,
          tone: "neutral",
        })}
      />

      {/* New consensus buys */}
      <Section
        title="New consensus buys"
        subtitle={`≥${3} funds newly opened a position this quarter — fresh smart-money interest`}
        items={view.consensusNewBuys}
        emptyText="No name has ≥3 funds newly opening it in the latest quarter."
        primaryMetric={(n) => ({
          label: `${n.newThisQuarter.length} new`,
          tone: "positive",
        })}
        showActivity="new"
      />

      {/* Consensus exits */}
      <Section
        title="Consensus exits"
        subtitle="≥3 funds fully sold this quarter — names smart money is walking away from"
        items={view.consensusExits}
        emptyText="No name has ≥3 funds exiting in the latest quarter."
        primaryMetric={(n) => ({
          label: `${n.exitedThisQuarter.length} out`,
          tone: "negative",
        })}
        showActivity="exited"
      />

      {/* Disagreement */}
      <Section
        title="High disagreement"
        subtitle="≥2 funds buying AND ≥2 funds exiting the same name this quarter"
        items={view.disagreement}
        emptyText="No two-sided splits this quarter — funds are aligned."
        primaryMetric={(n) => ({
          label: `${n.newThisQuarter.length} in / ${n.exitedThisQuarter.length} out`,
          tone: "neutral",
        })}
        showActivity="both"
      />

      <section className="mt-20 rounded border-l-2 border-accent/40 bg-subtle/30 px-6 py-5 text-xs leading-relaxed text-muted">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-foreground/70">
          Caveats
        </div>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            Universe is {view.fundsCovered} marquee funds — a tiny slice of
            institutional capital. &ldquo;Consensus&rdquo; here means
            consensus within this sample, not industry-wide.
          </li>
          <li>
            &ldquo;This quarter&rdquo; is each fund&apos;s own most-recent
            filing date; funds file at different times, so the comparison
            window is loose (±90 days across the universe).
          </li>
          <li>
            Dollar values are entry-time amounts from the backtest snapshot,
            not current mark-to-market. Use them for ranking, not absolute
            sizing.
          </li>
          <li>
            Options and ADRs aren&apos;t included — the snapshot trade engine
            filters them out.
          </li>
          <li>
            For deeper inspection of any name, click into the stock page —
            see who currently holds, when they entered, what their return is.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  items,
  emptyText,
  primaryMetric,
  showActivity = "holders",
}: {
  title: string;
  subtitle: string;
  items: ConsensusName[];
  emptyText: string;
  primaryMetric: (n: ConsensusName) => {
    label: string;
    tone: "positive" | "negative" | "neutral";
  };
  showActivity?: "holders" | "new" | "exited" | "both";
}) {
  return (
    <section className="mt-16">
      <div className="flex items-baseline justify-between border-b border-hairline pb-3">
        <div>
          <h2 className="font-serif text-2xl text-foreground">{title}</h2>
          <div className="mt-0.5 text-xs uppercase tracking-widest text-muted">
            {subtitle}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-muted">
            count
          </div>
          <div className="font-mono text-sm tabular text-foreground">
            {items.length.toLocaleString()}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{emptyText}</p>
      ) : (
        <ul className="mt-2 divide-y divide-hairline/60">
          {items.map((n) => {
            const metric = primaryMetric(n);
            const activityList =
              showActivity === "new"
                ? n.newThisQuarter
                : showActivity === "exited"
                  ? n.exitedThisQuarter
                  : showActivity === "both"
                    ? [...n.newThisQuarter, ...n.exitedThisQuarter]
                    : n.holders;
            return (
              <li key={n.cusip}>
                <div className="group block py-4 transition-colors hover:bg-subtle/40">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-3">
                        {n.ticker ? (
                          <Link
                            href={`/stock/${n.ticker}`}
                            className="font-mono text-base font-medium text-foreground transition-colors hover:text-accent"
                          >
                            {n.ticker}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-muted">
                            {n.cusip}
                          </span>
                        )}
                        <span className="truncate font-serif text-base text-foreground/85">
                          {n.issuer}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-xs text-muted">
                        {showActivity === "both" ? (
                          <>
                            <span className="text-positive">
                              ↑ {fundNames(n.newThisQuarter)}
                            </span>
                            <span className="mx-2">·</span>
                            <span className="text-negative">
                              ↓ {fundNames(n.exitedThisQuarter)}
                            </span>
                          </>
                        ) : (
                          <span>{fundNames(activityList)}</span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={cn(
                          "tabular text-sm",
                          metric.tone === "positive" && "text-positive",
                          metric.tone === "negative" && "text-negative",
                          metric.tone === "neutral" && "text-foreground",
                        )}
                      >
                        {metric.label}
                      </div>
                      <div className="mt-0.5 text-xs text-muted tabular">
                        {formatUSD(n.totalEntryValueUsd, { compact: true })} at entry
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function fundNames(activities: { fund: { displayName: string } }[]): string {
  if (activities.length === 0) return "—";
  return activities.map((a) => a.fund.displayName).join(", ");
}
