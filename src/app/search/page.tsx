import Link from "next/link";
import { SearchInput } from "@/components/search-input";
import { MARQUEE_FUNDS } from "@/lib/dashboard";
import { searchManagers } from "@/lib/edgar";
import { formatDate } from "@/lib/format";
import { cusipsForTicker, tickerForCusip } from "@/lib/stock-view";

export const dynamic = "force-dynamic";

const TRACKED_CIKS = new Set(MARQUEE_FUNDS.map((f) => f.cik));
// CIK → marquee fund map so we can render a "Tracked" hint at the top
// when a SEC search result matches one of our snapshotted funds.
const MARQUEE_BY_CIK = new Map(MARQUEE_FUNDS.map((f) => [f.cik, f]));

// Quick shape checks. Ticker = 1–5 ASCII letters (optionally a single
// share-class suffix like ".B", "-B", "/B"). CUSIP = exactly 9 alphanumeric.
const TICKER_RE = /^[A-Za-z]{1,5}(?:[.\-/][A-Za-z]{1,2})?$/;
const CUSIP_RE = /^[A-Za-z0-9]{9}$/;

type StockHint =
  | { kind: "ticker"; ticker: string }
  | { kind: "cusip"; cusip: string; ticker: string };

function detectStockHint(query: string): StockHint | null {
  // Tickers take precedence when they ALSO match the cusip regex (e.g.
  // "ABCDEFGHI" 9-letter ticker — very rare, but ticker is the more useful
  // interpretation here).
  if (TICKER_RE.test(query) && !/^\d+$/.test(query)) {
    const upper = query.toUpperCase();
    const cusips = cusipsForTicker(upper);
    if (cusips.length > 0) return { kind: "ticker", ticker: upper };
  }
  if (CUSIP_RE.test(query)) {
    const tk = tickerForCusip(query.toUpperCase());
    if (tk) return { kind: "cusip", cusip: query.toUpperCase(), ticker: tk };
  }
  return null;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  let results: Awaited<ReturnType<typeof searchManagers>> = [];
  let hadError = false;
  if (query) {
    try {
      results = await searchManagers(query);
    } catch (e) {
      // Log the raw error server-side for debugging; render a sanitized
      // message to users so we don't leak EDGAR error surfaces or auth
      // tokens that might appear in upstream exceptions.
      console.error("[search] searchManagers failed:", e);
      hadError = true;
    }
  }

  const stockHint = query ? detectStockHint(query) : null;

  // Find a marquee fund in the SEC results so we can prepend a "Tracked"
  // promo block above the standard list — surfaces the richer perf view
  // before users scroll the generic list.
  const trackedMatch = results
    .map((r) => MARQUEE_BY_CIK.get(r.cik.replace(/^0+/, "")))
    .find((f): f is NonNullable<typeof f> => Boolean(f));

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="mb-12">
        <SearchInput size="lg" initial={query} />
      </div>

      {!query && (
        <p className="text-muted">Enter a fund manager name to begin.</p>
      )}

      {/*
        PRIMARY RESULT — when the query looks like a ticker/CUSIP, push the
        stock page promo above everything else (fund results, tracked hint).
        Most "GOOG" / "AAPL" queries want the stock page, not a fund.
      */}
      {stockHint && (
        // URL-safe ticker: Next.js dynamic segments can't contain "/", so
        // normalize share-class slashes to dots. tickerVariants in
        // stock-view.ts treats . / - as equivalent, so the destination page
        // resolves the same CUSIP regardless of which separator the URL uses.
        <Link
          href={`/stock/${stockHint.ticker.replace(/\//g, ".")}`}
          className="mb-8 block rounded border border-accent/40 bg-accent/5 px-5 py-4 transition-colors hover:border-accent hover:bg-accent/10"
        >
          <div className="text-[10px] uppercase tracking-widest text-accent">
            {stockHint.kind === "ticker"
              ? "Looks like a ticker — primary result"
              : `Looks like a CUSIP (${stockHint.cusip}) — primary result`}
          </div>
          <div className="mt-1 font-serif text-lg text-foreground">
            Open stock page for{" "}
            <span className="font-mono text-accent">{stockHint.ticker}</span>
            <span className="text-muted"> →</span>
          </div>
          <div className="mt-1 text-xs text-muted">
            Cross-fund holders, recent activity, ownership timeline.
            {results.length > 0 && " Fund matches below."}
          </div>
        </Link>
      )}

      {/*
        TRACKED HINT — when one of the SEC fund results is in our marquee
        list, surface a direct link to the richer perf page so the user
        skips the bare holdings list. Always renders below the stockHint
        (when both are present) since the stockHint is the strictly more
        specific match.
      */}
      {trackedMatch && (
        <Link
          href={`/fund/${trackedMatch.cik}/performance`}
          className="mb-8 block rounded border border-accent/30 bg-subtle/30 px-5 py-4 transition-colors hover:border-accent/60 hover:bg-subtle/50"
        >
          <div className="text-[10px] uppercase tracking-widest text-accent">
            ★ Tracked — one of our {MARQUEE_FUNDS.length} marquee funds
          </div>
          <div className="mt-1 font-serif text-lg text-foreground">
            {trackedMatch.displayName}
            <span className="text-muted"> · performance view →</span>
          </div>
          <div className="mt-1 text-xs text-muted">
            Backtest, leaderboard rank, dashboard card — richer than the
            generic holdings page.
          </div>
        </Link>
      )}

      {query && hadError && (
        <p className="text-negative">
          We couldn&apos;t reach SEC EDGAR right now. Try again in a moment.
        </p>
      )}

      {query && !hadError && results.length === 0 && (
        <p className="text-muted">
          No 13F filers matched <em className="font-serif">{query}</em>.
        </p>
      )}

      {query && results.length > 0 && (
        <>
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl text-foreground">
              {results.length} {results.length === 1 ? "match" : "matches"}
              {stockHint && (
                <span className="ml-2 text-sm font-normal text-muted">
                  (secondary — fund manager results)
                </span>
              )}
            </h2>
            <span className="text-xs uppercase tracking-widest text-muted">
              for &ldquo;{query}&rdquo;
            </span>
          </div>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {results.map((r) => {
              const tracked = TRACKED_CIKS.has(r.cik.replace(/^0+/, ""));
              // Tracked funds bypass the holdings-list page and jump straight
              // to the richer performance view (backtest, charts, stats).
              const href = tracked
                ? `/fund/${r.cik}/performance`
                : `/fund/${r.cik}`;
              return (
                <li key={r.cik}>
                  <Link
                    href={href}
                    className="group flex items-center justify-between py-5 transition-colors hover:bg-subtle/40"
                  >
                    <div>
                      <div className="flex items-baseline gap-2">
                        <div className="font-serif text-xl text-foreground transition-colors group-hover:text-accent">
                          {r.name || "Unknown"}
                        </div>
                        {tracked && (
                          <span className="font-mono text-[10px] uppercase tracking-widest text-accent">
                            ★ Tracked
                          </span>
                        )}
                      </div>
                      <div className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">
                        CIK {r.cik}
                        {tracked && (
                          <span className="ml-2 normal-case tracking-normal text-muted/70">
                            — backtest, leaderboard, dashboard card available
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted">
                      <div className="uppercase tracking-widest text-xs">
                        Last 13F
                      </div>
                      <div className="tabular mt-1 text-foreground/70">
                        {r.latestFilingDate
                          ? formatDate(r.latestFilingDate)
                          : "—"}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
