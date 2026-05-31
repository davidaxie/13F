"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
// Type-only import so the server-only consensus.ts module (which reaches into
// snapshots) doesn't get pulled into the client bundle.
import type { ConsensusName } from "@/lib/consensus";
import { formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

// The dashboard's lead/core feature: where multiple marquee funds are
// converging — buying or dumping the SAME name this quarter. Snapshot-backed
// (computeConsensusView is sync + cached on the server, passed in via props),
// so this renders instantly with no live SEC fetch — unlike the
// individual-move highlights below it.
//
// Client component because of the "Hide systematic" toggle; the data itself
// comes from the server via the `topBuys`/`topExits` props (see dashboard
// page). Headings are <h2> so they sit correctly under the page's <h1>
// — and above the later "All moves" <h2>.

const HERO_LIMIT = 10;

// Threshold for the systematic filter. A row is "systematic-dominated" when
// at least this share of the participating funds (buyers for buys / sellers
// for exits) are quant-tagged.
const SYSTEMATIC_DOMINANCE = 2 / 3;

export function ConsensusHighlights({
  topBuys,
  topExits,
}: {
  topBuys: ConsensusName[];
  topExits: ConsensusName[];
}) {
  const [hideSystematic, setHideSystematic] = useState(false);

  const { buys, exits } = useMemo(() => {
    const filter = (n: ConsensusName, side: "new" | "exited") => {
      if (!hideSystematic) return true;
      const list = side === "new" ? n.newThisQuarter : n.exitedThisQuarter;
      if (list.length === 0) return true;
      const quant = list.filter((a) => a.fund.style === "quant").length;
      return quant / list.length < SYSTEMATIC_DOMINANCE;
    };
    return {
      buys: topBuys.filter((n) => filter(n, "new")).slice(0, HERO_LIMIT),
      exits: topExits.filter((n) => filter(n, "exited")).slice(0, HERO_LIMIT),
    };
  }, [topBuys, topExits, hideSystematic]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-end gap-3 text-xs uppercase tracking-widest text-muted">
        <span>Filter</span>
        <button
          type="button"
          role="switch"
          aria-checked={hideSystematic}
          onClick={() => setHideSystematic((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors",
            hideSystematic
              ? "border-foreground bg-foreground text-background"
              : "border-hairline text-muted hover:border-foreground hover:text-foreground",
          )}
          title="Drop rows where two-thirds or more of the participating funds are quant/systematic — leaving high-conviction discretionary signal."
        >
          Hide systematic
        </button>
      </div>
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
          {/*
            Visual size matches the previous <h3> styling, but the heading
            element is <h2> so the document outline goes h1 → h2 cleanly
            (avoids the broken h1 → h3 → h2 sequence the page had before).
          */}
          <h2
            className={cn(
              "font-serif text-xl",
              tone === "positive" ? "text-positive" : "text-negative",
            )}
          >
            {title}
          </h2>
          <div className="mt-0.5 text-xs uppercase tracking-widest text-muted">
            {subtitle}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-muted">
            {names.length} {names.length === 1 ? "name" : "names"}
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
            // Where the row links: ticker page if we have one; otherwise the
            // search page pre-seeded with the issuer name so the click lands
            // somewhere useful instead of reloading the dashboard.
            const href = n.ticker
              ? `/stock/${n.ticker}`
              : `/search?q=${encodeURIComponent(n.issuer)}`;
            return (
              // The row contains two link targets: the ticker/cusip + count
              // block jumps to /stock/<ticker> (or /search?q=<issuer> when no
              // ticker resolved), while each fund name jumps to /fund/<cik>.
              // Nesting <a>s isn't valid HTML, so we lay out a single block
              // with two separate <Link>s rather than one outer wrapper Link.
              <li
                key={n.cusip}
                className="group block py-3 transition-colors hover:bg-subtle/40"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={href}
                      className="flex items-baseline gap-2"
                    >
                      {n.ticker ? (
                        <span className="font-mono text-base font-medium text-foreground transition-colors group-hover:text-accent">
                          {n.ticker}
                        </span>
                      ) : (
                        <span className="font-mono text-sm text-muted">
                          {n.cusip}
                        </span>
                      )}
                    </Link>
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {activity.map((a, i) => (
                        <span key={a.fund.cik}>
                          {i > 0 ? ", " : ""}
                          <Link
                            href={`/fund/${a.fund.cik}`}
                            className="hover:text-foreground hover:underline"
                          >
                            {a.fund.displayName}
                          </Link>
                        </span>
                      ))}
                    </div>
                  </div>
                  <Link
                    href={href}
                    className="shrink-0 text-right"
                  >
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
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
