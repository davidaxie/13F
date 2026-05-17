import YahooFinance from "yahoo-finance2";
import { readJson, writeJson } from "./disk-cache";

const yahooFinance = new YahooFinance();

export type Bar = { t: number; c: number }; // unix seconds, close price

type Cached = {
  fetchedAt: number;
  bars: Bar[];
  earliestRequested: number;
};

const memCache = new Map<string, Cached>();
const inflight = new Map<string, Promise<Bar[]>>();

function cacheKey(ticker: string): string {
  return `prices/${ticker.toUpperCase().replace(/[^A-Z0-9-]/g, "_")}.json`;
}

async function loadFromDisk(ticker: string): Promise<Cached | null> {
  const hit = memCache.get(ticker);
  if (hit) return hit;
  const fromDisk = await readJson<Cached>(cacheKey(ticker));
  if (fromDisk) memCache.set(ticker, fromDisk);
  return fromDisk;
}

async function saveToDisk(ticker: string, data: Cached): Promise<void> {
  memCache.set(ticker, data);
  await writeJson(cacheKey(ticker), data);
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // refresh daily

type ChartQuote = { date?: Date | string; close?: number | null };
type ChartResult = { quotes?: ChartQuote[] };

async function fetchYahoo(ticker: string, from: Date): Promise<Bar[]> {
  const period2 = new Date();
  const result = (await yahooFinance.chart(ticker, {
    period1: from,
    period2,
    interval: "1d",
  })) as ChartResult;
  const quotes = result.quotes ?? [];
  const bars: Bar[] = [];
  for (const q of quotes) {
    if (q.close == null || !isFinite(q.close) || !q.date) continue;
    const t = Math.floor(new Date(q.date).getTime() / 1000);
    bars.push({ t, c: q.close });
  }
  return bars;
}

/**
 * Fetch daily close prices for a ticker, from `fromIso` to today.
 * Caches to disk; subsequent calls are instant.
 *
 * If `fromIso` is earlier than the cached `earliestRequested`, we re-fetch
 * to extend the history backwards.
 */
export async function getPriceHistory(
  ticker: string,
  fromIso: string,
): Promise<Bar[]> {
  const tk = ticker.toUpperCase();
  const fromDate = new Date(fromIso + "T00:00:00Z");
  const fromUnix = Math.floor(fromDate.getTime() / 1000);

  const existing = inflight.get(tk);
  if (existing) {
    const bars = await existing;
    return bars.filter((b) => b.t >= fromUnix);
  }

  const cached = await loadFromDisk(tk);
  const isFresh =
    cached &&
    Date.now() - cached.fetchedAt < CACHE_TTL_MS &&
    fromUnix >= cached.earliestRequested;

  if (isFresh) {
    return cached!.bars.filter((b) => b.t >= fromUnix);
  }

  const promise = (async () => {
    try {
      // If we have stale cache, request from the earliest of (cached earliest, asked).
      const start = cached
        ? new Date(Math.min(cached.earliestRequested, fromUnix) * 1000)
        : fromDate;
      const bars = await fetchYahoo(tk, start);
      const earliestRequested = Math.floor(start.getTime() / 1000);
      await saveToDisk(tk, { fetchedAt: Date.now(), bars, earliestRequested });
      return bars;
    } catch (err) {
      console.warn(`prices: ${tk} fetch failed (${err instanceof Error ? err.message : err})`);
      if (cached) return cached.bars;
      // Cache an empty placeholder so we don't retry every render.
      const placeholder: Cached = {
        fetchedAt: Date.now(),
        bars: [],
        earliestRequested: fromUnix,
      };
      await saveToDisk(tk, placeholder);
      return [];
    }
  })();
  inflight.set(tk, promise);
  try {
    const bars = await promise;
    return bars.filter((b) => b.t >= fromUnix);
  } finally {
    inflight.delete(tk);
  }
}

/**
 * Find the close price for the UTC day containing `unixSecs`, or the latest
 * earlier day if no bar exists on that day. Yahoo daily bars carry the
 * market-open timestamp (~14:30 UTC), so we treat each bar as covering its
 * full UTC day rather than firing only at its exact timestamp.
 */
export function priceAt(bars: Bar[], unixSecs: number): number | null {
  if (bars.length === 0) return null;
  const ONE_DAY = 86400;
  const target = unixSecs + ONE_DAY - 1; // end of the UTC day containing unixSecs
  let lo = 0;
  let hi = bars.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (bars[m].t <= target) {
      ans = m;
      lo = m + 1;
    } else {
      hi = m - 1;
    }
  }
  return ans >= 0 ? bars[ans].c : null;
}

export function isoToUnix(iso: string): number {
  return Math.floor(new Date(iso + "T00:00:00Z").getTime() / 1000);
}
