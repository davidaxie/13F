"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Star } from "lucide-react";
import { watchlist } from "@/lib/watchlist";
import { MARQUEE_FUNDS, FUND_STYLE_LABELS } from "@/lib/funds";

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("watchlist:change", callback);
  return () => window.removeEventListener("watchlist:change", callback);
}

// Stable empty array references so useSyncExternalStore doesn't infinite-loop
// when localStorage is empty. We snapshot to a Set, then memoize a sorted
// array per unique set contents.
const EMPTY: string[] = [];
let lastFundKey = "";
let lastFundArr: string[] = EMPTY;
let lastStockKey = "";
let lastStockArr: string[] = EMPTY;

function snapshotFunds(): string[] {
  const set = watchlist.funds.list();
  const key = Array.from(set).sort().join(",");
  if (key === lastFundKey) return lastFundArr;
  lastFundKey = key;
  lastFundArr = key === "" ? EMPTY : key.split(",");
  return lastFundArr;
}
function snapshotStocks(): string[] {
  const set = watchlist.stocks.list();
  const key = Array.from(set).sort().join(",");
  if (key === lastStockKey) return lastStockArr;
  lastStockKey = key;
  lastStockArr = key === "" ? EMPTY : key.split(",");
  return lastStockArr;
}

export default function WatchlistPage() {
  const funds = useSyncExternalStore(subscribe, snapshotFunds, () => EMPTY);
  const stocks = useSyncExternalStore(subscribe, snapshotStocks, () => EMPTY);

  // Map fund CIKs to their MARQUEE_FUNDS metadata (best-effort — unknown
  // CIKs still get a generic row pointing to the fund page).
  const fundRows = funds.map((cik) => {
    const meta = MARQUEE_FUNDS.find((f) => f.cik === cik);
    return { cik, meta };
  });

  function removeFund(cik: string) {
    watchlist.funds.toggle(cik);
  }
  function removeStock(ticker: string) {
    watchlist.stocks.toggle(ticker);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link
        href="/dashboard"
        className="text-xs uppercase tracking-widest text-muted transition-colors hover:text-foreground"
      >
        ← Dashboard
      </Link>

      <div className="mt-4 border-b border-hairline pb-10">
        <div className="text-xs uppercase tracking-widest text-muted">
          Following
        </div>
        <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground">
          Watchlist
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          Funds and stocks you&apos;ve starred. Stored locally in this
          browser — no account needed. Cross-device sync ships with the
          auth layer (Phase 6 of the plan).
        </p>
      </div>

          <section className="mt-12">
            <div className="flex items-baseline justify-between border-b border-hairline pb-3">
              <h2 className="font-serif text-2xl text-foreground">
                Funds{" "}
                <span className="text-sm text-muted">· {funds.length}</span>
              </h2>
            </div>
            {fundRows.length === 0 ? (
              <p className="mt-6 text-sm text-muted">
                Nothing starred yet. Visit any{" "}
                <Link href="/universe" className="text-accent">
                  tracked fund
                </Link>{" "}
                and tap the star.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-hairline/60">
                {fundRows.map(({ cik, meta }) => (
                  <li
                    key={cik}
                    className="flex items-baseline justify-between py-3"
                  >
                    <Link
                      href={`/fund/${cik}`}
                      className="group flex-1 min-w-0"
                    >
                      <div className="font-serif text-base text-foreground transition-colors group-hover:text-accent">
                        {meta?.displayName ?? `CIK ${cik}`}
                      </div>
                      {meta && (
                        <div className="mt-0.5 text-xs text-muted">
                          {FUND_STYLE_LABELS[meta.style]}
                          {meta.manager ? ` · ${meta.manager}` : ""}
                        </div>
                      )}
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeFund(cik)}
                      className="ml-3 inline-flex items-center gap-1 rounded-sm border border-hairline px-2 py-1 text-xs uppercase tracking-widest text-muted transition-colors hover:border-foreground hover:text-foreground"
                      aria-label={`Remove ${meta?.displayName ?? cik} from watchlist`}
                    >
                      <Star size={12} fill="currentColor" aria-hidden="true" />
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-16">
            <div className="flex items-baseline justify-between border-b border-hairline pb-3">
              <h2 className="font-serif text-2xl text-foreground">
                Stocks{" "}
                <span className="text-sm text-muted">· {stocks.length}</span>
              </h2>
            </div>
            {stocks.length === 0 ? (
              <p className="mt-6 text-sm text-muted">
                Nothing starred yet. Visit any{" "}
                <Link href="/stock/AAPL" className="text-accent">
                  stock page
                </Link>{" "}
                and tap the star.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-hairline/60">
                {stocks.map((tk) => (
                  <li
                    key={tk}
                    className="flex items-baseline justify-between py-3"
                  >
                    <Link href={`/stock/${tk}`} className="group flex-1">
                      <span className="font-mono text-base text-foreground transition-colors group-hover:text-accent">
                        {tk}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeStock(tk)}
                      className="ml-3 inline-flex items-center gap-1 rounded-sm border border-hairline px-2 py-1 text-xs uppercase tracking-widest text-muted transition-colors hover:border-foreground hover:text-foreground"
                      aria-label={`Remove ${tk} from watchlist`}
                    >
                      <Star size={12} fill="currentColor" aria-hidden="true" />
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
    </div>
  );
}
