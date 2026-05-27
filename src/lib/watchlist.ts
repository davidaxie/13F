// localStorage-backed watchlist primitives. No auth, no server state — a
// per-browser "Following" list of fund CIKs and stock tickers. Future
// follow-up: wire to user accounts so the watchlist syncs across devices.

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

function cleanCik(cik: string): string {
  return cik.replace(/^0+/, "");
}
