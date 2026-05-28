import Link from "next/link";
import {
  ConvictionBar,
  ConvictionWeightsProvider,
} from "@/components/conviction-bar";
import {
  entryWeightKey,
  getEntriesByStyleFast,
  type StyleEntry,
  type StyleGroup,
} from "@/lib/entries-by-style";
import { formatUSD } from "@/lib/format";
import {
  FUND_STYLE_LABELS,
  SIGNAL_TIER_META,
  type SignalTier,
} from "@/lib/funds";
import { cn } from "@/lib/utils";

// Snapshot-backed and synchronous, so the page is statically rendered and
// loads instantly. The conviction bars stream in afterward from the client
// (see ConvictionWeightsProvider → /api/entry-weights).
export const dynamic = "force-static";

// Rows shown per style before truncating (quant books open hundreds of names
// a quarter — we only want the biggest).
const PER_STYLE_LIMIT = 12;

const TIER_ORDER: SignalTier[] = ["high", "medium", "low", "noise"];

function tierTone(tier: SignalTier): {
  border: string;
  badge: string;
  dim: boolean;
} {
  switch (tier) {
    case "high":
      return {
        border: "border-accent/50",
        badge: "border-accent/40 bg-accent/10 text-accent",
        dim: false,
      };
    case "medium":
      return {
        border: "border-hairline",
        badge: "border-hairline bg-subtle/50 text-foreground/70",
        dim: false,
      };
    case "low":
      return {
        border: "border-hairline",
        badge: "border-hairline bg-subtle/50 text-muted",
        dim: false,
      };
    case "noise":
      return {
        border: "border-hairline/60",
        badge: "border-negative/30 bg-negative/5 text-negative/80",
        dim: true,
      };
  }
}

export default function EntriesPage() {
  const groups = getEntriesByStyleFast();

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
          Signal quality
        </div>
        <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground">
          Entries that matter
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          Not every new position is a signal. A concentrated value or activist
          firm opening a name is a deliberate, multi-year bet. A market-maker or
          quant platform &ldquo;opening&rdquo; the same name is mostly
          mechanical, high-turnover flow — near-meaningless for a long-horizon
          thesis, however large the dollar amount. This page groups the biggest
          new positions by the opening firm&apos;s style and ranks them by how
          much that entry actually tells you.
        </p>
      </div>

      {/* Signal legend — the tier hierarchy, strongest first. */}
      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TIER_ORDER.map((tier) => {
          const meta = SIGNAL_TIER_META[tier];
          const tone = tierTone(tier);
          return (
            <div
              key={tier}
              className={cn(
                "rounded border-l-2 bg-subtle/20 px-4 py-3",
                tone.border,
              )}
            >
              <div
                className={cn(
                  "inline-block rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest",
                  tone.badge,
                )}
              >
                {meta.label}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {meta.blurb}
              </p>
            </div>
          );
        })}
      </div>

      <ConvictionWeightsProvider>
        {groups.length === 0 ? (
          <p className="mt-12 text-sm text-muted">
            No new common-stock positions in the latest snapshots.
          </p>
        ) : (
          <div className="mt-4">
            {groups.map((group) => (
              <StyleSection key={group.style} group={group} />
            ))}
          </div>
        )}
      </ConvictionWeightsProvider>

      <section className="mt-20 rounded border-l-2 border-accent/40 bg-subtle/30 px-6 py-5 text-xs leading-relaxed text-muted">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-foreground/70">
          How to read this
        </div>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            Style tiers are coarse. Many platforms run several books at once
            (Citadel runs quant, L/S, and macro pods) — each firm gets a single
            dominant tag.
          </li>
          <li>
            &ldquo;Conviction&rdquo; is the position&apos;s weight in the
            opening fund&apos;s 13F book. A large dollar entry at a tiny weight
            is a side bet, not a thesis.
          </li>
          <li>
            Entries are new common-stock positions in each fund&apos;s
            most-recent filing. Options opens and add-to positions are excluded.
          </li>
          <li>
            13F is a quarterly snapshot filed up to 45 days late — these are
            disclosed entries, not real-time trades.
          </li>
        </ul>
      </section>
    </div>
  );
}

function StyleSection({ group }: { group: StyleGroup }) {
  const meta = SIGNAL_TIER_META[group.tier];
  const tone = tierTone(group.tier);
  const shown = group.entries.slice(0, PER_STYLE_LIMIT);
  const hidden = group.entryCount - shown.length;

  return (
    <section className={cn("mt-16", tone.dim && "opacity-80")}>
      <div
        className={cn(
          "flex flex-wrap items-baseline justify-between gap-3 border-b pb-3",
          tone.border,
        )}
      >
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <h2 className="font-serif text-2xl text-foreground">
              {FUND_STYLE_LABELS[group.style]}
            </h2>
            <span
              className={cn(
                "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest",
                tone.badge,
              )}
            >
              {meta.label}
            </span>
          </div>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
            {meta.blurb}
          </p>
        </div>
        <div className="text-right">
          <div className="tabular text-sm text-foreground">
            {formatUSD(group.totalEntryValueUsd, { compact: true })}
          </div>
          <div className="mt-0.5 text-xs uppercase tracking-widest text-muted">
            {group.entryCount.toLocaleString()} entr
            {group.entryCount === 1 ? "y" : "ies"} · {group.fundCount} fund
            {group.fundCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <ul className="mt-2 divide-y divide-hairline/60">
        {shown.map((e) => (
          <EntryRow key={`${e.fundCik}-${e.cusip}`} entry={e} />
        ))}
      </ul>

      {hidden > 0 && (
        <p className="mt-3 text-xs text-muted">
          + {hidden.toLocaleString()} smaller{" "}
          {FUND_STYLE_LABELS[group.style].toLowerCase()} entr
          {hidden === 1 ? "y" : "ies"} not shown.
        </p>
      )}
    </section>
  );
}

function EntryRow({ entry }: { entry: StyleEntry }) {
  return (
    <li>
      <div className="group block py-3 transition-colors hover:bg-subtle/40">
        <div className="flex items-baseline justify-between gap-4">
          <div className="min-w-0 flex-1">
            {entry.ticker ? (
              <Link
                href={`/stock/${entry.ticker}`}
                className="font-mono text-base font-medium text-foreground transition-colors hover:text-accent"
              >
                {entry.ticker}
              </Link>
            ) : (
              // No CUSIP→ticker match — fall back to the security's CUSIP, the
              // actual identifier, rather than the issuer name.
              <span className="font-mono text-sm text-muted">
                {entry.cusip}
              </span>
            )}
            <div className="mt-0.5 truncate text-xs text-muted">
              {entry.fundName}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="tabular text-base text-foreground">
              {formatUSD(entry.entryValueUsd, { compact: true })}
            </div>
            <ConvictionBar entryKey={entryWeightKey(entry.fundCik, entry.cusip)} />
          </div>
        </div>
      </div>
    </li>
  );
}
