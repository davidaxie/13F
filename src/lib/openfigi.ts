import { readJson, writeJson } from "./disk-cache";

export type CusipMapping = {
  ticker: string | null;
  name: string;
  exchCode: string | null;
};

const CACHE_FILE = "cusip-to-ticker.json";
const memCache = new Map<string, CusipMapping>();
let loaded = false;
let saveScheduled = false;

async function load() {
  if (loaded) return;
  const data = await readJson<Record<string, CusipMapping>>(CACHE_FILE);
  if (data) {
    for (const [k, v] of Object.entries(data)) memCache.set(k, v);
  }
  loaded = true;
}

async function persist() {
  if (saveScheduled) return;
  saveScheduled = true;
  // Debounce writes; persist after a short delay so batched writes coalesce.
  setTimeout(async () => {
    saveScheduled = false;
    try {
      const obj: Record<string, CusipMapping> = {};
      for (const [k, v] of memCache) obj[k] = v;
      await writeJson(CACHE_FILE, obj);
    } catch (err) {
      console.error("openfigi: failed to persist cache", err);
    }
  }, 500);
}

const HEADERS: HeadersInit = { "Content-Type": "application/json" };
const KEY = process.env.OPENFIGI_API_KEY;
if (KEY) (HEADERS as Record<string, string>)["X-OPENFIGI-APIKEY"] = KEY;

const BATCH_SIZE = KEY ? 100 : 10;
const RATE_DELAY_MS = KEY ? 700 : 2600; // stay just under 100/min (with key) or 25/min (without)

type OpenFigiResult = {
  data?: Array<{
    ticker?: string;
    name?: string;
    exchCode?: string;
    securityType?: string;
  }>;
  error?: string;
};

function pickPrimary(results: OpenFigiResult["data"]): CusipMapping {
  if (!results || results.length === 0) {
    return { ticker: null, name: "", exchCode: null };
  }
  // Prefer US Composite (US), then UN (NYSE), UQ (NASDAQ GS), UA (NYSE American),
  // UR (NASDAQ GM), UW (NASDAQ CM). Equity common stock preferred.
  const preferOrder = ["US", "UN", "UQ", "UA", "UR", "UW"];
  for (const code of preferOrder) {
    const hit = results.find(
      (r) => r.exchCode === code && (!r.securityType || /common|stock|adr/i.test(r.securityType)),
    );
    if (hit) {
      return {
        ticker: hit.ticker ?? null,
        name: hit.name ?? "",
        exchCode: hit.exchCode ?? null,
      };
    }
  }
  // Fall back to first result.
  const r = results[0];
  return { ticker: r.ticker ?? null, name: r.name ?? "", exchCode: r.exchCode ?? null };
}

type BatchResult =
  | { kind: "ok"; mappings: CusipMapping[] }
  | { kind: "transient"; reason: string }
  | { kind: "permanent"; reason: string };

async function fetchBatch(cusips: string[]): Promise<BatchResult> {
  const body = cusips.map((c) => ({
    idType: "ID_CUSIP",
    idValue: c,
    marketSecDes: "Equity",
  }));
  let res: Response;
  try {
    res = await fetch("https://api.openfigi.com/v3/mapping", {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    return { kind: "transient", reason: `network: ${err instanceof Error ? err.message : err}` };
  }
  if (res.status === 429) {
    return { kind: "transient", reason: "429 rate limited" };
  }
  if (res.status >= 500) {
    return { kind: "transient", reason: `${res.status} server error` };
  }
  if (!res.ok) {
    return { kind: "permanent", reason: `${res.status} ${res.statusText}` };
  }
  try {
    const data = (await res.json()) as OpenFigiResult[];
    return { kind: "ok", mappings: data.map((r) => pickPrimary(r.data)) };
  } catch (err) {
    return { kind: "transient", reason: `parse: ${err instanceof Error ? err.message : err}` };
  }
}

// Single process-wide queue so concurrent backtests don't dogpile OpenFIGI.
// Without a key the limit is ~25 reqs/min; with a key ~100/min.
let queueTail: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const prev = queueTail;
  const next = (async () => {
    try {
      await prev;
    } catch {
      // ignore previous task's failure — each task handles its own
    }
    return work();
  })();
  queueTail = next.catch(() => {});
  return next;
}

/**
 * Map a set of CUSIPs to tickers. Results cached on disk; CUSIPs are
 * permanent identifiers. All callers across the process share one rate-limit
 * queue so concurrent fund backtests don't simultaneously hammer OpenFIGI.
 *
 * Without OPENFIGI_API_KEY this is ~25 req/min in batches of 10, so a cold
 * cache for ~500 unique CUSIPs takes ~2 minutes. With a key, ~30 seconds.
 */
export async function lookupCusips(
  cusips: Iterable<string>,
): Promise<Map<string, CusipMapping>> {
  await load();
  const result = new Map<string, CusipMapping>();
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const c of cusips) {
    if (!c || seen.has(c)) continue;
    seen.add(c);
    const cached = memCache.get(c);
    if (cached) {
      result.set(c, cached);
    } else {
      missing.push(c);
    }
  }
  if (missing.length === 0) return result;

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    let outcome = await enqueue(async () => {
      const r = await fetchBatch(batch);
      // Pace the next caller regardless of outcome.
      await new Promise((res) => setTimeout(res, RATE_DELAY_MS));
      return r;
    });

    // One retry for transient errors (with a longer cooldown).
    if (outcome.kind === "transient") {
      await new Promise((r) => setTimeout(r, 8000));
      outcome = await enqueue(async () => {
        const r = await fetchBatch(batch);
        await new Promise((res) => setTimeout(res, RATE_DELAY_MS));
        return r;
      });
    }

    if (outcome.kind === "ok") {
      for (let j = 0; j < batch.length; j++) {
        const m = outcome.mappings[j] ?? { ticker: null, name: "", exchCode: null };
        memCache.set(batch[j], m);
        result.set(batch[j], m);
      }
      void persist();
    } else {
      console.warn(`openfigi: batch failed (${outcome.reason}) — leaving uncached for retry`);
      // Mark this batch as "unknown" in this call's result map (ticker=null)
      // but do NOT poison the disk cache, so later requests can retry.
      for (const c of batch) {
        result.set(c, { ticker: null, name: "", exchCode: null });
      }
    }
  }
  return result;
}
