import Link from "next/link";
import { Sparkline } from "@/components/charts/sparkline";
import { MARQUEE_FUNDS, FUND_STYLE_LABELS } from "@/lib/funds";
import { getSnapshot } from "@/lib/snapshots";
import { formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-static";

export default function UniversePage() {
  const rows = MARQUEE_FUNDS.map((f) => {
    const snap = getSnapshot(f.cik);
    return { fund: f, snap };
  });

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
          Universe
        </div>
        <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground">
          Tracked funds
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          The {MARQUEE_FUNDS.length} institutional managers whose 13F
          filings power the dashboard, leaderboard, and backtest pages.
          Expanding this universe to 30+ funds is on the roadmap
          (Phase 4 of the improvement plan).
        </p>
      </div>

      <section className="mt-12">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-hairline text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-3 pr-3 font-normal">Fund</th>
                <th className="py-3 px-3 font-normal">Style</th>
                <th className="py-3 px-3 font-normal">Principal</th>
                <th className="py-3 px-3 font-normal">AUM</th>
                <th className="py-3 px-3 text-right font-normal">
                  Mirror return
                </th>
                <th className="py-3 px-3 hidden font-normal sm:table-cell">
                  Equity curve
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ fund, snap }) => (
                <tr
                  key={fund.cik}
                  className="border-b border-hairline/60 transition-colors hover:bg-subtle/40"
                >
                  <td className="py-3 pr-3">
                    <Link
                      href={`/fund/${fund.cik}`}
                      className="font-serif text-base text-foreground hover:text-accent"
                    >
                      {fund.displayName}
                    </Link>
                    {fund.tagline && (
                      <div className="mt-0.5 max-w-md truncate text-xs text-muted">
                        {fund.tagline}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className="rounded-sm border border-hairline bg-subtle/50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">
                      {FUND_STYLE_LABELS[fund.style]}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-xs text-muted">
                    {fund.manager ?? "—"}
                  </td>
                  <td className="py-3 px-3 text-xs text-muted tabular">
                    {fund.aumApprox ?? "—"}
                  </td>
                  <td
                    className={cn(
                      "py-3 px-3 text-right tabular text-sm",
                      snap == null
                        ? "text-muted"
                        : snap.stats.mirrorReturnPct >= 0
                          ? "text-positive"
                          : "text-negative",
                    )}
                  >
                    {snap == null ? (
                      "—"
                    ) : (
                      <>
                        {snap.stats.mirrorReturnPct >= 0 ? "+" : ""}
                        {formatPct(snap.stats.mirrorReturnPct, 0)}
                      </>
                    )}
                  </td>
                  <td className="py-3 px-3 hidden sm:table-cell">
                    {snap && snap.equityCurve.length > 1 ? (
                      <Sparkline
                        data={snap.equityCurve.map((p) => ({ v: p.mirror }))}
                        width={140}
                        height={28}
                        stroke={
                          snap.stats.mirrorReturnPct >= 0
                            ? "var(--positive)"
                            : "var(--negative)"
                        }
                      />
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted">
          AUM figures are approximate firm-level estimates, not 13F totals.
          Mirror return is the snapshot-locked $10k buy-the-disclosures
          backtest vs SPY; click into a fund for the full performance view.
        </p>
      </section>
    </div>
  );
}
