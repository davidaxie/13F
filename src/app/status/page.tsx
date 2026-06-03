import Link from "next/link";
import type { Metadata } from "next";
import { newestBacktestDate } from "@/lib/backtest-meta";
import { computeConsensusView } from "@/lib/consensus";
import { formatDate } from "@/lib/format";
import { MARQUEE_FUNDS } from "@/lib/funds";
import { getSnapshot } from "@/lib/snapshots";

export const metadata: Metadata = {
  title: "Platform status · 13F",
  description:
    "Snapshot of mapperlab's data freshness and infrastructure: funds wired, latest disclosure, last regeneration, sources.",
};

// Status should reflect current state, not a build-time snapshot.
export const dynamic = "force-dynamic";

export default function StatusPage() {
  const totalFunds = MARQUEE_FUNDS.length;
  const wiredFunds: typeof MARQUEE_FUNDS = [];
  const pendingFunds: typeof MARQUEE_FUNDS = [];
  for (const f of MARQUEE_FUNDS) {
    if (getSnapshot(f.cik) != null) {
      wiredFunds.push(f);
    } else {
      pendingFunds.push(f);
    }
  }

  const newestBacktestIso = newestBacktestDate();
  const consensus = computeConsensusView();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link
        href="/dashboard"
        className="text-xs uppercase tracking-widest text-muted transition-colors hover:text-foreground"
      >
        ← Dashboard
      </Link>

      <div className="mt-4 border-b border-hairline pb-10">
        <div className="text-xs uppercase tracking-widest text-muted">
          Status
        </div>
        <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground sm:text-6xl">
          Platform status
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted">
          Snapshot of mapperlab&apos;s data freshness and infrastructure.
          Updated each page load.
        </p>
      </div>

      <Section title="Data">
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4">
          <Stat
            label="Funds tracked"
            value={
              <>
                <span className="tabular">{wiredFunds.length}</span>
                <span className="text-muted">/</span>
                <span className="tabular">{totalFunds}</span>
              </>
            }
          />
          <Stat
            label="Latest disclosure"
            value={
              <span className="tabular">
                {consensus.asOfDate
                  ? formatDate(consensus.asOfDate)
                  : "—"}
              </span>
            }
          />
          <Stat
            label="Last regeneration"
            value={
              <span className="tabular">
                {newestBacktestIso
                  ? formatDate(newestBacktestIso.slice(0, 10))
                  : "—"}
              </span>
            }
          />
          <Stat
            label="Pending"
            value={<span className="tabular">{pendingFunds.length}</span>}
          />
        </div>
        {pendingFunds.length > 0 ? (
          <p className="mt-6 text-sm leading-relaxed text-muted">
            <span className="text-foreground/80">Pending funds:</span>{" "}
            {pendingFunds.map((f, i) => (
              <span key={f.cik}>
                {f.displayName}
                {i < pendingFunds.length - 1 ? ", " : ""}
              </span>
            ))}
            .
          </p>
        ) : (
          <p className="mt-6 text-sm leading-relaxed text-muted">
            All marquee funds have current snapshots.
          </p>
        )}
      </Section>

      <Section title="Sources">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>SEC EDGAR (public)</strong> — primary source for 13F-HR
            filings, fund metadata, and filing-date timestamps.
          </li>
          <li>
            <strong>SEC XBRL company facts (public)</strong> — fundamentals
            (revenue, EPS, share counts) used on stock and consensus pages.
          </li>
          <li>
            <strong>Yahoo Finance daily bars</strong> — daily close prices
            powering sparklines and backtest fill prices.
          </li>
          <li>
            <strong>OpenFIGI CUSIP mapping</strong> — deterministic
            CUSIP→ticker resolution, seeded into the local mapping file.
          </li>
        </ul>
      </Section>

      <Section title="Infrastructure">
        <ul className="list-disc pl-5 space-y-2">
          <li>Hosted on Vercel · region iad1</li>
          <li>Authentication via Clerk</li>
          <li>Persistent storage via Vercel KV</li>
          <li>Email delivery via Resend</li>
        </ul>
      </Section>

      <section className="mt-20 rounded border-l-2 border-accent/40 bg-subtle/30 px-6 py-5 text-xs leading-relaxed text-muted">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-foreground/70">
          Incidents &amp; data issues
        </div>
        <p>
          For incidents or data issues, email{" "}
          <a
            href="mailto:support@mapperlab.co"
            className="font-mono text-foreground/80 underline decoration-hairline underline-offset-2 hover:text-foreground"
          >
            support@mapperlab.co
          </a>
          .
        </p>
      </section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-serif text-2xl text-foreground">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted">
        {label}
      </div>
      <div className="mt-1 text-lg text-foreground">{value}</div>
    </div>
  );
}
