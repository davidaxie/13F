import { Sparkline } from "@/components/charts/sparkline";
import {
  fetchCompanyConcept,
  type ConceptDataPoint,
} from "@/lib/sec-xbrl";
import { formatPct, formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

// Different issuers tag the same economic line under different us-gaap
// concept names (and switched mid-history when ASC 606 landed). For each
// metric we try a fallback list in order and pick the candidate with
// the most-recent latest period-end.
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

type MetricSeries = { series: AnnualPoint[]; entityName: string };

/**
 * For one metric: walk the concept fallback list, fetching each
 * candidate concept separately and picking the one with the most
 * recent latest period-end (tie-break: longer history).
 *
 * Why per-concept fetches instead of one fetchCompanyFacts call:
 * the companyfacts blob can be 5-10 MB for big multi-segment filers
 * (MSFT is 6.4 MB), which exceeds Next.js's 2 MB data-cache item
 * limit and bypasses the cache on every render. Per-concept JSONs
 * are KB-sized and cache cleanly. With React.cache() de-duping
 * within a request and Next's data cache holding 1-hour revalidate,
 * a hot page reuses the previous render's payload entirely.
 *
 * Why de-dupe by `end` rather than `fy`: a single 10-K contains 2–3
 * FY entries — current year + prior comparison years — all tagged
 * with `fy = the filing's fiscal year`. Dedup-by-fy would conflate
 * periods. The `end` date is the actual period the value belongs to
 * and is unique per fiscal year-end.
 *
 * Why "most recent latest end": companies that switched concepts
 * mid-history (Apple: pre-ASC-606 SalesRevenueNet → post-ASC-606
 * RevenueFromContract...) report under both. The historical concept
 * has more years but its latest end is stale; we want the live
 * concept the issuer is currently filing against.
 */
async function metricSeries(
  issuerCik: string,
  concepts: string[],
  unit: string,
  limit = 10,
): Promise<MetricSeries> {
  let best: AnnualPoint[] = [];
  let bestLatestEnd = "";
  let entityName = "";
  for (const concept of concepts) {
    const c = await fetchCompanyConcept(issuerCik, concept);
    if (!c) continue;
    if (!entityName && c.entityName) entityName = c.entityName;
    const pts = c.units[unit];
    if (!pts || pts.length === 0) continue;
    const fyOnly = pts.filter((p) => p.fp === "FY");
    if (fyOnly.length === 0) continue;
    // De-dupe by period end date; on collision keep the most-recently-filed
    // value (restated > original).
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
  return { series: best, entityName };
}

/**
 * Free cash flow = operating cash flow − capex. Both pulled via
 * per-concept fetches; aligned by period-end (years can drift across
 * concepts on rare restatements; `end` is the unambiguous join key).
 */
async function freeCashFlowSeries(
  issuerCik: string,
  limit = 10,
): Promise<MetricSeries> {
  const ocf = await metricSeries(issuerCik, OPERATING_CASH_CONCEPTS, "USD", 25);
  if (ocf.series.length === 0) return { series: [], entityName: ocf.entityName };
  const capex = await metricSeries(issuerCik, CAPEX_CONCEPTS, "USD", 25);
  const capexByEnd = new Map(capex.series.map((p) => [p.end, p.val]));
  const series: AnnualPoint[] = ocf.series
    .map((p) => ({
      endYear: p.endYear,
      // capex is reported as a positive outflow; FCF = OCF − capex.
      val: p.val - (capexByEnd.get(p.end) ?? 0),
      filed: p.filed,
      end: p.end,
    }))
    .slice(-limit);
  return { series, entityName: ocf.entityName || capex.entityName };
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
 * Server component. Pulls four metric time-series from SEC EDGAR XBRL
 * via per-concept fetches (cacheable; the full companyfacts blob can
 * exceed Next.js's 2 MB cache item limit for big filers). Renders a
 * 4-tile panel with latest value, YoY change, and a ~10y sparkline.
 * Renders nothing if no metrics have data (private companies, foreign
 * filers without us-gaap/ifrs-full tags, pre-first-filing).
 */
export async function StockFundamentals({
  issuerCik,
  entityName,
}: {
  issuerCik: string;
  entityName: string;
}) {
  // All four metrics fetched in parallel — fetchCompanyConcept is
  // React-cached within the request and Next-data-cached across requests,
  // so a hot page is essentially free.
  const [revenue, netIncome, eps, fcf] = await Promise.all([
    metricSeries(issuerCik, REVENUE_CONCEPTS, "USD"),
    metricSeries(issuerCik, NET_INCOME_CONCEPTS, "USD"),
    metricSeries(issuerCik, EPS_DILUTED_CONCEPTS, "USD/shares"),
    freeCashFlowSeries(issuerCik),
  ]);

  const metrics: Array<{
    label: string;
    series: AnnualPoint[];
    format: (v: number) => string;
  }> = [
    {
      label: "Revenue",
      series: revenue.series,
      format: (v) => formatUSD(v, { compact: true }),
    },
    {
      label: "Net income",
      series: netIncome.series,
      format: (v) => formatUSD(v, { compact: true }),
    },
    {
      label: "EPS (diluted)",
      series: eps.series,
      format: (v) => `$${v.toFixed(2)}`,
    },
    {
      label: "Free cash flow",
      series: fcf.series,
      format: (v) => formatUSD(v, { compact: true }),
    },
  ];

  const populated = metrics.filter((m) => m.series.length >= 2);
  if (populated.length === 0) return null;

  // Prefer the XBRL-reported entity name (more authoritative than our
  // ticker map); fall back to the ticker map's name if none of the
  // concepts resolved (defensive — shouldn't happen since we got here).
  const sourceName =
    revenue.entityName ||
    netIncome.entityName ||
    eps.entityName ||
    fcf.entityName ||
    entityName;

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
