"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { watchlist, kvWatchlist } from "@/lib/watchlist";
import { MARQUEE_FUNDS, FUND_STYLE_LABELS } from "@/lib/funds";

// ---------------------------------------------------------------------------
// localStorage external-store wiring (signed-out path only).
// ---------------------------------------------------------------------------
function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("watchlist:change", callback);
  return () => window.removeEventListener("watchlist:change", callback);
}

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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  /** True when the server confirmed the user is signed in. */
  isSignedIn: boolean;
  /** KV-loaded fund CIKs (empty array when signed out). */
  serverFunds: string[];
  /** KV-loaded stock tickers (empty array when signed out). */
  serverStocks: string[];
  /** ISO string of the newest backtest file mtime, or null. */
  dataRefreshedAt: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function WatchlistContent({
  isSignedIn,
  serverFunds,
  serverStocks,
  dataRefreshedAt,
}: Props) {
  // ── KV path (signed-in) ──────────────────────────────────────────────────
  const [kvFunds, setKvFunds] = useState<string[]>(serverFunds);
  const [kvStocks, setKvStocks] = useState<string[]>(serverStocks);

  // Re-sync from KV if the server data is stale after a client-side navigation.
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    Promise.all([kvWatchlist.funds.list(), kvWatchlist.stocks.list()]).then(
      ([f, s]) => {
        if (cancelled) return;
        setKvFunds(f.sort());
        setKvStocks(s.sort());
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  const removeFundKv = useCallback(async (cik: string) => {
    // Optimistic remove.
    setKvFunds((prev) => prev.filter((c) => c !== cik));
    try {
      await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "fund", id: cik }),
      });
    } catch {
      // Revert on error by re-fetching.
      kvWatchlist.funds.list().then((f) => setKvFunds(f.sort()));
    }
  }, []);

  const removeStockKv = useCallback(async (ticker: string) => {
    setKvStocks((prev) => prev.filter((t) => t !== ticker));
    try {
      await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "stock", id: ticker }),
      });
    } catch {
      kvWatchlist.stocks.list().then((s) => setKvStocks(s.sort()));
    }
  }, []);

  // ── localStorage path (signed-out) ──────────────────────────────────────
  const lsFunds = useSyncExternalStore(subscribe, snapshotFunds, () => EMPTY);
  const lsStocks = useSyncExternalStore(subscribe, snapshotStocks, () => EMPTY);

  function removeFundLs(cik: string) {
    watchlist.funds.toggle(cik);
  }
  function removeStockLs(ticker: string) {
    watchlist.stocks.toggle(ticker);
  }

  // ── Derived lists ────────────────────────────────────────────────────────
  const funds = isSignedIn ? kvFunds : lsFunds;
  const stocks = isSignedIn ? kvStocks : lsStocks;
  const removeFund = isSignedIn ? removeFundKv : removeFundLs;
  const removeStock = isSignedIn ? removeStockKv : removeStockLs;

  const fundRows = funds.map((cik) => ({
    cik,
    meta: MARQUEE_FUNDS.find((f) => f.cik === cik),
  }));

  // ── Freshness label (QW-05) ──────────────────────────────────────────────
  const refreshLabel = dataRefreshedAt
    ? new Date(dataRefreshedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  // ── Render ───────────────────────────────────────────────────────────────
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
          {isSignedIn
            ? "Funds and stocks you’ve starred. Synced across devices via your account."
            : "Funds and stocks you’ve starred. Stored locally in this browser — sign in to sync across devices."}
        </p>

        {/* Sign-in nudge for signed-out users */}
        {!isSignedIn && (
          <p className="mt-3 inline-flex items-center gap-2 rounded border border-hairline px-3 py-2 text-xs text-muted">
            <Star size={12} aria-hidden="true" />
            Sign in to sync your watchlist across all your devices.
          </p>
        )}

        {/* QW-05 freshness indicator */}
        {refreshLabel && (
          <p className="mt-3 text-xs text-muted">
            Data refreshed:{" "}
            <span className="tabular-nums">{refreshLabel}</span>
          </p>
        )}
      </div>

      {/* Funds section */}
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
                <Link href={`/fund/${cik}`} className="group min-w-0 flex-1">
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

      {/* Stocks section */}
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
