import Link from "next/link";
import {
  computeConsensusView,
  type ConsensusName,
  type FundActivity,
} from "@/lib/consensus";
import { formatDate } from "@/lib/format";
import {
  PaginatedConsensusList,
  type ConsensusRow,
  type Tone,
} from "@/components/paginated-consensus-list";

export const dynamic = "force-static";

export default function ConsensusPage() {
  const view = computeConsensusView();

  // Pre-compute serializable row data for each section so the client
  // pagination component only needs plain props (no function callbacks
  // across the RSC boundary).
  const mostOwnedRows: ConsensusRow[] = view.mostOwned
    .slice(0, 25)
    .map((n) =>
      toRow(n, {
        metric: {
          label: `${n.totalHolders} of ${view.fundsCovered}`,
          tone: "neutral",
        },
        activity: { kind: "single", text: fundNames(n.holders) },
      }),
    );

  const newBuysRows: ConsensusRow[] = view.consensusNewBuys.map((n) =>
    toRow(n, {
      metric: {
        label: `${n.newThisQuarter.length} new`,
        tone: "positive",
      },
      activity: { kind: "single", text: fundNames(n.newThisQuarter) },
    }),
  );

  const exitsRows: ConsensusRow[] = view.consensusExits.map((n) =>
    toRow(n, {
      metric: {
        label: `${n.exitedThisQuarter.length} out`,
        tone: "negative",
      },
      activity: { kind: "single", text: fundNames(n.exitedThisQuarter) },
    }),
  );

  const disagreementRows: ConsensusRow[] = view.disagreement.map((n) =>
    toRow(n, {
      metric: {
        label: `${n.newThisQuarter.length} in / ${n.exitedThisQuarter.length} out`,
        tone: "neutral",
      },
      activity: {
        kind: "split",
        newText: fundNames(n.newThisQuarter),
        exitedText: fundNames(n.exitedThisQuarter),
      },
    }),
  );

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
          Consensus &amp; crowding
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

      {/* Most-owned — capped at 25, no Show more button. */}
      <Section
        title="Most-owned stocks"
        subtitle="Held by the most marquee funds · ties broken by combined capital"
        count={mostOwnedRows.length}
      >
        <PaginatedConsensusList
          rows={mostOwnedRows}
          initialVisible={mostOwnedRows.length}
          emptyText="Not enough overlap to compute."
        />
      </Section>

      {/* New consensus buys — paginated 30 at a time. */}
      <Section
        title="New consensus buys"
        subtitle="≥3 funds newly opened a position this quarter — fresh smart-money interest"
        count={newBuysRows.length}
      >
        <PaginatedConsensusList
          rows={newBuysRows}
          emptyText="No name has ≥3 funds newly opening it in the latest quarter."
        />
      </Section>

      {/* Consensus exits — paginated 30 at a time. */}
      <Section
        title="Consensus exits"
        subtitle="≥3 funds fully sold this quarter — names smart money is walking away from"
        count={exitsRows.length}
      >
        <PaginatedConsensusList
          rows={exitsRows}
          emptyText="No name has ≥3 funds exiting in the latest quarter."
        />
      </Section>

      {/* High disagreement — paginated 30 at a time. */}
      <Section
        title="High disagreement"
        subtitle="≥2 funds buying AND ≥2 funds exiting the same name this quarter"
        count={disagreementRows.length}
      >
        <PaginatedConsensusList
          rows={disagreementRows}
          emptyText="No two-sided splits this quarter — funds are aligned."
        />
      </Section>

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

/** Server-only helper: lift the shared row fields off ConsensusName and
 *  attach the per-section metric + activity. */
function toRow(
  n: ConsensusName,
  overlay: { metric: { label: string; tone: Tone }; activity: ConsensusRow["activity"] },
): ConsensusRow {
  return {
    cusip: n.cusip,
    ticker: n.ticker,
    issuer: n.issuer,
    totalEntryValueUsd: n.totalEntryValueUsd,
    metric: overlay.metric,
    activity: overlay.activity,
  };
}

function fundNames(activities: FundActivity[]): string {
  if (activities.length === 0) return "—";
  return activities.map((a) => a.fund.displayName).join(", ");
}

/** Section header (title + subtitle + count) — server-rendered. The
 *  body is a PaginatedConsensusList passed in as children. */
function Section({
  title,
  subtitle,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  children: React.ReactNode;
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
            {count.toLocaleString()}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}
