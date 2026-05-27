import Link from "next/link";
import { computeCompare, type Position } from "@/lib/compare";
import { MARQUEE_FUNDS } from "@/lib/funds";
import { formatPct, formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

const DEFAULT_A = "1067983"; // Berkshire
const DEFAULT_B = "1336528"; // Pershing Square

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const sp = await searchParams;
  const cikA = sp.a && MARQUEE_FUNDS.some((f) => f.cik === sp.a) ? sp.a : DEFAULT_A;
  const cikB = sp.b && MARQUEE_FUNDS.some((f) => f.cik === sp.b) ? sp.b : DEFAULT_B;

  // Same-fund pick is a degenerate request — fall back to the default pair.
  const effectiveCikB = cikB === cikA ? (cikA === DEFAULT_B ? DEFAULT_A : DEFAULT_B) : cikB;
  const view = computeCompare(cikA, effectiveCikB);

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
          Compare two funds
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          Where do these two managers overlap, and where do they diverge?
          Common holdings ranked by combined exposure, plus the largest
          positions unique to each.
        </p>
      </div>

      <FundPicker side="a" current={cikA} other={effectiveCikB} />
      <FundPicker side="b" current={effectiveCikB} other={cikA} />

      <section className="mt-10 grid grid-cols-2 gap-x-10 gap-y-8 border-b border-hairline pb-10 sm:grid-cols-4">
        <Stat
          label="Overlap"
          value={view.overlapCount.toLocaleString()}
          sub="Held by both"
        />
        <Stat
          label="Only in A"
          value={view.onlyACount.toLocaleString()}
          sub={view.fundA.displayName}
        />
        <Stat
          label="Only in B"
          value={view.onlyBCount.toLocaleString()}
          sub={view.fundB.displayName}
        />
        <Stat
          label="Combined overlap value"
          value={formatUSD(view.combinedOverlapValueUsd, { compact: true })}
          sub="A + B entry values"
        />
      </section>

      {/* Overlap table */}
      <Section title="Common holdings" subtitle="Sorted by combined entry exposure (A + B)">
        {view.overlap.length === 0 ? (
          <p className="mt-6 text-sm text-muted">No common holdings.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-y border-hairline text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-3 pr-3 font-normal">Stock</th>
                <th className="py-3 px-3 text-right font-normal">
                  {view.fundA.displayName}
                </th>
                <th className="py-3 px-3 text-right font-normal">
                  {view.fundB.displayName}
                </th>
                <th className="py-3 pl-3 text-right font-normal">Combined</th>
              </tr>
            </thead>
            <tbody>
              {view.overlap.slice(0, 30).map((row) => (
                <tr
                  key={row.position.cusip}
                  className="border-b border-hairline/60 transition-colors hover:bg-subtle/40"
                >
                  <td className="py-3 pr-3">
                    <StockCell p={row.position} />
                  </td>
                  <td className="py-3 px-3 text-right tabular text-muted">
                    {formatUSD(row.aValueUsd, { compact: true })}
                  </td>
                  <td className="py-3 px-3 text-right tabular text-muted">
                    {formatUSD(row.bValueUsd, { compact: true })}
                  </td>
                  <td className="py-3 pl-3 text-right tabular text-foreground">
                    {formatUSD(row.combinedValueUsd, { compact: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {view.overlap.length > 30 && (
          <p className="mt-3 text-xs text-muted">
            Showing top 30 of{" "}
            <span className="tabular text-foreground">
              {view.overlap.length}
            </span>{" "}
            common holdings.
          </p>
        )}
      </Section>

      {/* Diverging positions, side by side */}
      <section className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-2">
        <DivergingList
          title={`Only in ${view.fundA.displayName}`}
          subtitle="Top 20 by current entry value"
          items={view.onlyA.slice(0, 20)}
        />
        <DivergingList
          title={`Only in ${view.fundB.displayName}`}
          subtitle="Top 20 by current entry value"
          items={view.onlyB.slice(0, 20)}
        />
      </section>

      <section className="mt-20 rounded border-l-2 border-accent/40 bg-subtle/30 px-6 py-5 text-xs leading-relaxed text-muted">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-foreground/70">
          Caveats
        </div>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            &ldquo;Held&rdquo; means the fund&apos;s most recent snapshot
            trade for that CUSIP is open. Heavy funds (RenTech, Citadel,
            Two Sigma, Soros) use only the last 8 quarters of snapshots,
            so very-long-held positions outside that window won&apos;t
            appear.
          </li>
          <li>
            Dollar values are entry-time amounts from the snapshot — useful
            for ranking, not for current mark-to-market sizing.
          </li>
          <li>
            Options and ADRs are excluded by the snapshot trade engine.
          </li>
          <li>
            Sector overlap and add/trim disagreement charts are planned
            once the reference-data layer ships.
          </li>
        </ul>
      </section>
    </div>
  );
}

function FundPicker({
  side,
  current,
  other,
}: {
  side: "a" | "b";
  current: string;
  other: string;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-2 text-xs uppercase tracking-widest text-muted">
      <span className="font-mono w-4 text-foreground">{side.toUpperCase()}</span>
      {MARQUEE_FUNDS.map((f) => {
        const active = f.cik === current;
        // Compose the new query string preserving the other pick.
        const params = new URLSearchParams();
        if (side === "a") {
          params.set("a", f.cik);
          params.set("b", other);
        } else {
          params.set("a", other);
          params.set("b", f.cik);
        }
        return (
          <Link
            key={f.cik}
            href={`/compare?${params.toString()}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-hairline text-muted hover:border-foreground hover:text-foreground",
            )}
          >
            {f.displayName}
          </Link>
        );
      })}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16">
      <div className="border-b border-hairline pb-3">
        <h2 className="font-serif text-2xl text-foreground">{title}</h2>
        <div className="mt-0.5 text-xs uppercase tracking-widest text-muted">
          {subtitle}
        </div>
      </div>
      {children}
    </section>
  );
}

function DivergingList({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Position[];
}) {
  return (
    <div>
      <div className="border-b border-hairline pb-3">
        <h3 className="font-serif text-xl text-foreground">{title}</h3>
        <div className="mt-0.5 text-xs uppercase tracking-widest text-muted">
          {subtitle}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted">None.</p>
      ) : (
        <ul className="divide-y divide-hairline/60">
          {items.map((p) => (
            <li
              key={p.cusip}
              className="flex items-baseline justify-between gap-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <StockCell p={p} />
              </div>
              <div className="shrink-0 text-right">
                <div className="tabular text-sm text-foreground">
                  {formatUSD(p.entryValueUsd, { compact: true })}
                </div>
                {p.priceReturnPct != null && (
                  <div
                    className={cn(
                      "mt-0.5 text-xs tabular",
                      p.priceReturnPct >= 0
                        ? "text-positive"
                        : "text-negative",
                    )}
                  >
                    {p.priceReturnPct >= 0 ? "+" : ""}
                    {formatPct(p.priceReturnPct, 0)}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StockCell({ p }: { p: Position }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-2">
        {p.ticker ? (
          <Link
            href={`/stock/${p.ticker}`}
            className="font-mono text-sm font-medium text-foreground transition-colors hover:text-accent"
          >
            {p.ticker}
          </Link>
        ) : (
          <span className="font-mono text-xs text-muted">{p.cusip}</span>
        )}
        <span className="truncate font-serif text-sm text-foreground/85">
          {p.issuer}
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted">{label}</div>
      <div className="mt-2 font-serif text-3xl tabular text-foreground">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function generateMetadata() {
  return {
    title: "Compare two funds — 13F",
  };
}
