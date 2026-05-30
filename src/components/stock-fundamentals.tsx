import { Sparkline } from "@/components/charts/sparkline";
import {
  fetchCompanyFacts,
  type ConceptDataPoint,
  type XbrlFacts,
} from "@/lib/sec-xbrl";
import { formatPct, formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

// Different issuers tag the same economic line under different us-gaap
// concept names (and Apple/etc. switched mid-history). For each metric we
// try a fallback list in order and take the first concept that has data.
const REVENUE_CONCEPTS = [
  "Revenues",
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "RevenueFromContractWithCustomerIncludingAssessedTax",
  "SalesRevenueNet",
  "SalesRevenueGoodsNet",
];
const NET_INCOME_CONCEPTS = ["NetIncomeLoss"];
const EPS_DILUTED_CONCEPTS = [
  "EarningsPerShareDiluted",
  "EarningsPerShareBasic",
];
const OPERATING_CASH_CONCEPTS = [
  "NetCashProvidedByUsedInOperatingActivities",
  "NetCashProvidedByOperatingActivities",
];
const CAPEX_CONCEPTS = ["PaymentsToAcquirePropertyPlantAndEquipment"];

type AnnualPoint = {
  /** Period-end year (4-digit), derived from `end`. The right thing to
   * display — the `fy` field on the raw XBRL point is the filing's fy,
   * not the period's, so comparison entries (prior years in the same
   * 10-K) carry the filing year and would mis-label this row. */
  endYear: number;
  val: number;
  filed: string;
  /** Period-end date (YYYY-MM-DD). Stable, sortable, unique per period. */
  end: string;
};

/**
 * For a metric: walk the concept fallback list and pick the candidate
 * with the most recent latest period-end (tie-break: longer history).
 *
 * Why de-dupe by `end` rather than `fy`: a single 10-K contains 2–3
 * FY entries — the current fiscal year plus 1–2 prior years for
 * comparison — and SEC tags ALL of them with `fy = the filing's
 * fiscal year`. Dedup-by-fy would conflate periods and keep an
 * arbitrary one. The `end` date is the actual period the value
 * belongs to and is unique per fiscal year-end.
 *
 * Why "most recent latest end" rather than "first non-empty" or
 * "longest series": companies that switched concepts mid-history
 * (Apple: pre-ASC-606 SalesRevenueNet → post-ASC-606
 * RevenueFromContract...) report under both. The historical concept
 * has MORE years but its latest end-date is stale; we want the live
 * concept the issuer is currently filing against.
 */
function annualSeries(
  facts: XbrlFacts,
  concepts: string[],
  unit: string,
  limit = 10,
): AnnualPoint[] {
  // Look in us-gaap first, then ifrs-full for foreign issuers.
  const taxonomies = ["us-gaap", "ifrs-full"];
  let best: AnnualPoint[] = [];
  let bestLatestEnd = "";
  for (const tax of taxonomies) {
    const taxFacts = facts.facts[tax];
    if (!taxFacts) continue;
    for (const c of concepts) {
      const concept = taxFacts[c];
      const pts = concept?.units?.[unit];
      if (!pts || pts.length === 0) continue;
      const fyOnly = pts.filter((p) => p.fp === "FY");
      if (fyOnly.length === 0) continue;
      // De-dupe by period end date. Multiple entries with the same `end`
      // = multiple filings reporting the same fiscal year (original +
      // amendments); keep the most-recently-filed value.
      const byEnd = new Map<string, ConceptDataPoint>();
      for (const p of fyOnly) {
        if (!p.end) continue;
        const cur = byEnd.get(p.end);
        if (!cur || p.filed > cur.filed) byEnd.set(p.end, p);
      }
      if (byEnd.size < 2) continue; // need ≥2 periods for YoY + sparkline
      const series = Array.from(byEnd.values())
        .map((p): AnnualPoint => {
          const endYear = Number.parseInt(p.end.slice(0, 4), 10);
          return {
            endYear: Number.isFinite(endYear) ? endYear : p.fy,
            val: p.val,
            filed: p.filed,
            end: p.end,
          };
        })
        .sort((a, b) => a.end.localeCompare(b.end))
        .slice(-limit);
      const latestEnd = series[series.length - 1].end;
      if (
        latestEnd > bestLatestEnd ||
        (latestEnd === bestLatestEnd && series.length > best.length)
      ) {
        best = series;
        bestLatestEnd = latestEnd;
      }
    }
  }
  return best;
}

/**
 * Free cash flow = operating cash flow − capex. Intersect fiscal years
 * available in both series; if capex isn't reported for a year (rare),
 * fall back to OCF alone for that year so the series still draws.
 */
function freeCashFlow(facts: XbrlFacts, limit = 10): AnnualPoint[] {
  const ocf = annualSeries(facts, OPERATING_CASH_CONCEPTS, "USD", 25);
  if (ocf.length === 0) return [];
  const capex = annualSeries(facts, CAPEX_CONCEPTS, "USD", 25);
  // Align by period-end (years can drift across concepts on rare
  // restatements; the end date is the unambiguous join key).
  const capexByEnd = new Map(capex.map((p) => [p.end, p.val]));
  const out: AnnualPoint[] = ocf.map((p) => {
    // capex is filed as a positive outflow; FCF = OCF − capex.
    const cx = capexByEnd.get(p.end) ?? 0;
    return { endYear: p.endYear, val: p.val - cx, filed: p.filed, end: p.end };
  });
  return out.slice(-limit);
}

function yoyPct(series: AnnualPoint[]): number | null {
  if (series.length < 2) return null;
  const cur = series[series.length - 1].val;
  const prev = series[series.length - 2].val;
  if (prev === 0) return null;
  // abs(prev) so negative-→-less-negative reads as improvement.
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/**
 * Server component. Pulls XBRL companyfacts for the issuer and renders
 * a 4-tile panel (Revenue / Net income / EPS / Free cash flow) with
 * latest value, YoY change, and a ~10y sparkline. Renders nothing if
 * the issuer has no XBRL data (private companies, foreign filers
 * without us-gaap or ifrs-full tags, or new SPACs pre-first-filing).
 */
export async function StockFundamentals({
  issuerCik,
  entityName,
}: {
  issuerCik: string;
  entityName: string;
}) {
  const facts = await fetchCompanyFacts(issuerCik);
  if (!facts) return null;

  const revenue = annualSeries(facts, REVENUE_CONCEPTS, "USD");
  const netIncome = annualSeries(facts, NET_INCOME_CONCEPTS, "USD");
  const epsDiluted = annualSeries(facts, EPS_DILUTED_CONCEPTS, "USD/shares");
  const fcf = freeCashFlow(facts);

  const metrics: Array<{
    label: string;
    series: AnnualPoint[];
    format: (v: number) => string;
  }> = [
    {
      label: "Revenue",
      series: revenue,
      format: (v) => formatUSD(v, { compact: true }),
    },
    {
      label: "Net income",
      series: netIncome,
      format: (v) => formatUSD(v, { compact: true }),
    },
    {
      label: "EPS (diluted)",
      series: epsDiluted,
      format: (v) => `$${v.toFixed(2)}`,
    },
    {
      label: "Free cash flow",
      series: fcf,
      format: (v) => formatUSD(v, { compact: true }),
    },
  ];

  // Need at least 2 points to show a sparkline + YoY.
  const populated = metrics.filter((m) => m.series.length >= 2);
  if (populated.length === 0) return null;

  const sourceName = facts.entityName || entityName;

  return (
    <section className="mt-16">
      <div className="flex items-baseline justify-between border-b border-hairline pb-3">
        <h2 className="font-serif text-2xl text-foreground">Fundamentals</h2>
        <span className="text-xs uppercase tracking-widest text-muted">
          XBRL · {sourceName}
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted">
        Annual figures sourced directly from {sourceName}&apos;s 10-K /
        10-Q filings via SEC EDGAR XBRL. Latest fiscal year and the
        year-over-year change, with up to ten years of history.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {populated.map((m) => {
          const latest = m.series[m.series.length - 1];
          const yoy = yoyPct(m.series);
          const trendUp = latest.val >= (m.series[0]?.val ?? 0);
          return (
            <div key={m.label}>
              <div className="text-xs uppercase tracking-widest text-muted">
                {m.label}
              </div>
              <div className="mt-2 font-serif text-3xl tabular text-foreground">
                {m.format(latest.val)}
              </div>
              <div className="mt-1 flex items-baseline gap-2 text-xs">
                <span className="text-muted">FY{latest.endYear}</span>
                {yoy != null && (
                  <span
                    className={cn(
                      "tabular",
                      yoy >= 0 ? "text-positive" : "text-negative",
                    )}
                  >
                    {yoy >= 0 ? "+" : ""}
                    {formatPct(yoy, 0)} YoY
                  </span>
                )}
              </div>
              <div className="mt-3">
                <Sparkline
                  data={m.series.map((p) => ({ v: p.val }))}
                  width={200}
                  height={42}
                  stroke={trendUp ? "var(--positive)" : "var(--negative)"}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
