import Link from "next/link";
import { computeConsensusView, type ConsensusName } from "@/lib/consensus";
import { formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

// The dashboard's lead/core feature: where multiple marquee funds are
// converging — buying or dumping the SAME name this quarter. Snapshot-backed
// (computeConsensusView is sync + cached), so this renders instantly with no
// live SEC fetch — unlike the individual-move highlights below it.
const HERO_LIMIT = 10;

export function ConsensusHighlights() {
  const view = computeConsensusView();
  const buys = view.topBuys.slice(0, HERO_LIMIT);
  const exits = view.topExits.slice(0, HERO_LIMIT);

  return (
    <div className="grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
      <ConsensusColumn
        title="Funds are buying"
        subtitle="Multiple funds opened the same name this quarter"
        tone="positive"
        names={buys}
        side="new"
        emptyText="No name has ≥2 funds newly opening it this quarter."
      />
      <ConsensusColumn
        title="Funds are selling"
        subtitle="Multiple funds fully exited the same name this quarter"
        tone="negative"
        names={exits}
        side="exited"
        emptyText="No name has ≥2 funds exiting it this quarter."
      />
    </div>
  );
}

function ConsensusColumn({
  title,
  subtitle,
  tone,
  names,
  side,
  emptyText,
}: {
  title: string;
  subtitle: string;
  tone: "positive" | "negative";
  names: ConsensusName[];
  side: "new" | "exited";
  emptyText: string;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-hairline pb-3">
        <div>
          <h3
            className={cn(
              "font-serif text-xl",
              tone === "positive" ? "text-positive" : "text-negative",
            )}
          >
            {title}
          </h3>
          <div className="mt-0.5 text-xs uppercase tracking-widest text-muted">
            {subtitle}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-muted">
            funds
          </div>
        </div>
      </div>

      {names.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{emptyText}</p>
      ) : (
        <ul className="mt-1 divide-y divide-hairline/60">
          {names.map((n) => {
            const activity = side === "new" ? n.newThisQuarter : n.exitedThisQuarter;
            const count = activity.length;
            const fundList = activity.map((a) => a.fund.displayName).join(", ");
            return (
              <li key={n.cusip}>
                <Link
                  href={n.ticker ? `/stock/${n.ticker}` : `/dashboard`}
                  className="group block py-3 transition-colors hover:bg-subtle/40"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        {n.ticker ? (
                          <span className="font-mono text-base font-medium text-foreground transition-colors group-hover:text-accent">
                            {n.ticker}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-muted">
                            {n.cusip}
                          </span>
                        )}
                        <span className="truncate font-serif text-sm text-foreground/80">
                          {n.issuer}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted">
                        {fundList}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={cn(
                          "tabular text-base font-medium",
                          tone === "positive"
                            ? "text-positive"
                            : "text-negative",
                        )}
                      >
                        {count}
                      </div>
                      <div className="mt-0.5 text-xs text-muted tabular">
                        {formatUSD(n.totalEntryValueUsd, { compact: true })}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
