// localStorage-backed watchlist primitives. No auth, no server state — a
// per-browser "Following" list of fund CIKs and stock tickers.
//
// kvWatchlist is the server-backed counterpart used when the user is signed
// in. Both share the same key normalisation (cleanCik / toUpperCase).

const FUND_KEY = "13f.watchlist.funds.v1";
const STOCK_KEY = "13f.watchlist.stocks.v1";

function readSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(set).sort()));
    // Fire a custom event so other instances of the watchlist component on
    // the page re-read state (e.g. a star on the fund header + a star in a
    // sidebar both reflect the same toggle).
    window.dispatchEvent(new CustomEvent("watchlist:change", { detail: { key } }));
  } catch {
    // localStorage may be disabled / over quota; fail quietly.
  }
}

export const watchlist = {
  funds: {
    list: () => readSet(FUND_KEY),
    has: (cik: string) => readSet(FUND_KEY).has(cleanCik(cik)),
    toggle: (cik: string): boolean => {
      const set = readSet(FUND_KEY);
      const k = cleanCik(cik);
      const next = !set.has(k);
      if (next) set.add(k);
      else set.delete(k);
      writeSet(FUND_KEY, set);
      return next;
    },
  },
  stocks: {
    list: () => readSet(STOCK_KEY),
    has: (ticker: string) => readSet(STOCK_KEY).has(ticker.toUpperCase()),
    toggle: (ticker: string): boolean => {
      const set = readSet(STOCK_KEY);
      const k = ticker.toUpperCase();
      const next = !set.has(k);
      if (next) set.add(k);
      else set.delete(k);
      writeSet(STOCK_KEY, set);
      return next;
    },
  },
};

// ---------------------------------------------------------------------------
// Server-backed watchlist API (requires Clerk auth).
// Each method calls /api/watchlist which reads/writes Vercel KV Sets.
// ---------------------------------------------------------------------------

export const kvWatchlist = {
  funds: {
    /** Returns the signed-in user's fund watchlist from KV. */
    list: async (): Promise<string[]> => {
      const r = await fetch("/api/watchlist?kind=fund");
      if (!r.ok) return [];
      return r.json();
    },
    /**
     * Toggles a fund CIK in KV.
     * Returns `true` if the item is now in the watchlist, `false` if removed.
     */
    toggle: async (cik: string): Promise<boolean> => {
      const id = cleanCik(cik);
      // Check current state first so we know which verb to use.
      const current = await kvWatchlist.funds.list();
      const isPresent = current.includes(id);
      const method = isPresent ? "DELETE" : "POST";
      const r = await fetch("/api/watchlist", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "fund", id }),
      });
      if (!r.ok) return isPresent; // no change on error
      return !isPresent;
    },
  },
  stocks: {
    /** Returns the signed-in user's stock watchlist from KV. */
    list: async (): Promise<string[]> => {
      const r = await fetch("/api/watchlist?kind=stock");
      if (!r.ok) return [];
      return r.json();
    },
    /**
     * Toggles a ticker in KV.
     * Returns `true` if the item is now in the watchlist, `false` if removed.
     */
    toggle: async (ticker: string): Promise<boolean> => {
      const id = ticker.toUpperCase();
      const current = await kvWatchlist.stocks.list();
      const isPresent = current.includes(id);
      const method = isPresent ? "DELETE" : "POST";
      const r = await fetch("/api/watchlist", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "stock", id }),
      });
      if (!r.ok) return isPresent;
      return !isPresent;
    },
  },
};

// ---------------------------------------------------------------------------
// One-time migration: copy any localStorage items up to KV then clear them.
// Call this once on mount when the user is signed in.
// ---------------------------------------------------------------------------

export async function migrateLocalStorageToKv(): Promise<void> {
  if (typeof window === "undefined") return;

  const localFunds = Array.from(readSet(FUND_KEY));
  const localStocks = Array.from(readSet(STOCK_KEY));

  if (localFunds.length === 0 && localStocks.length === 0) return;

  // Upload all local items concurrently.
  await Promise.all([
    ...localFunds.map((cik) =>
      fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "fund", id: cleanCik(cik) }),
      }).catch(() => {}),
    ),
    ...localStocks.map((ticker) =>
      fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "stock", id: ticker.toUpperCase() }),
      }).catch(() => {}),
    ),
  ]);

  // Clear local storage after successful upload.
  try {
    window.localStorage.removeItem(FUND_KEY);
    window.localStorage.removeItem(STOCK_KEY);
    window.dispatchEvent(new CustomEvent("watchlist:change", { detail: {} }));
  } catch {
    // Ignore
  }
}

function cleanCik(cik: string): string {
  return cik.replace(/^0+/, "");
}
