import { fetchIssuerSubmissions } from "@/lib/sec-xbrl";
import { formatDate } from "@/lib/format";

// Forms to surface in the "recent filings" panel. We deliberately skip
// Form 4 (already shown in the Insider Activity panel above) and the
// long tail of administrative forms (SD, 144, NT-*, CORRESP, ...).
//
// What's in:
//   10-K / 10-Q — annual / quarterly reports (the core periodics)
//   8-K          — material events (earnings releases, executive changes)
//   SC 13D / G   — 5%+ ownership disclosures (often from activists)
//   DEF 14A      — proxy statement
//   S-1 / S-3 / S-4 — registration statements (offerings, M&A)
//   20-F / 6-K   — foreign filer reports
const SURFACE_FORMS = new Set([
  "10-K",
  "10-K/A",
  "10-Q",
  "10-Q/A",
  "8-K",
  "8-K/A",
  "SC 13D",
  "SC 13D/A",
  "SC 13G",
  "SC 13G/A",
  "DEF 14A",
  "S-1",
  "S-1/A",
  "S-3",
  "S-3/A",
  "S-4",
  "S-4/A",
  "20-F",
  "20-F/A",
  "6-K",
]);

// Plain-English descriptor for each form, used when the SEC-provided
// primaryDocDescription is empty (it often is for 8-Ks).
const FORM_LABELS: Record<string, string> = {
  "10-K": "Annual report",
  "10-K/A": "Annual report (amended)",
  "10-Q": "Quarterly report",
  "10-Q/A": "Quarterly report (amended)",
  "8-K": "Material event",
  "8-K/A": "Material event (amended)",
  "SC 13D": "5%+ ownership (activist)",
  "SC 13D/A": "5%+ ownership (amended)",
  "SC 13G": "5%+ ownership (passive)",
  "SC 13G/A": "5%+ ownership (amended)",
  "DEF 14A": "Proxy statement",
  "S-1": "Registration (IPO)",
  "S-1/A": "Registration (IPO, amended)",
  "S-3": "Registration (shelf)",
  "S-3/A": "Registration (shelf, amended)",
  "S-4": "Registration (M&A)",
  "S-4/A": "Registration (M&A, amended)",
  "20-F": "Annual report (foreign)",
  "20-F/A": "Annual report (foreign, amended)",
  "6-K": "Interim disclosure (foreign)",
};

/**
 * Server component. Pulls the issuer's recent filings list from SEC's
 * submissions endpoint and renders the top 15 material filings —
 * earnings, material events, ownership, proxies. Form 4 insider
 * activity is intentionally excluded (it has its own panel above).
 */
export async function StockRecentFilings({
  issuerCik,
}: {
  issuerCik: string;
}) {
  const subs = await fetchIssuerSubmissions(issuerCik, 250);
  if (!subs) return null;
  const surfaced = subs.filings
    .filter((f) => SURFACE_FORMS.has(f.form))
    .slice(0, 15);
  if (surfaced.length === 0) return null;

  return (
    <section className="mt-16">
      <div className="flex items-baseline justify-between border-b border-hairline pb-3">
        <h2 className="font-serif text-2xl text-foreground">
          Recent SEC filings
        </h2>
        <span className="text-xs uppercase tracking-widest text-muted">
          10-K · 10-Q · 8-K · 13D/G · proxy
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted">
        The most recent material filings for {subs.name} — earnings,
        material events, ownership disclosures, proxy statements.
        Form 4 insider activity is shown in the panel above.
      </p>
      <ul className="mt-6 divide-y divide-hairline border-y border-hairline">
        {surfaced.map((f) => (
          <li key={f.accession}>
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group grid grid-cols-[120px_1fr_auto] items-center gap-4 py-3 transition-colors hover:bg-subtle/40"
            >
              <div>
                <span className="rounded-sm border border-hairline bg-subtle/50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">
                  {f.form}
                </span>
              </div>
              <div className="truncate text-sm text-foreground/85 transition-colors group-hover:text-accent">
                {f.primaryDocDescription || FORM_LABELS[f.form] || f.form}
              </div>
              <div className="tabular text-sm text-muted">
                {formatDate(f.filingDate)}
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
