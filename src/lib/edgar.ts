import { parseInfoTable, type Holding } from "./parse-13f";
import { readJson, writeJson } from "./disk-cache";

const USER_AGENT =
  process.env.EDGAR_USER_AGENT ?? "13F Research Tool research@example.com";

// Single process-wide queue for SEC EDGAR. SEC's published rate limit is
// 10 req/sec per IP; we target ~9.5/sec by spacing acquisitions by 105ms.
const SEC_MIN_DELAY_MS = 105;
let secChain: Promise<void> = Promise.resolve();

async function secAcquire(): Promise<void> {
  const prev = secChain;
  let release: () => void = () => {};
  secChain = new Promise<void>((r) => {
    release = r;
  });
  try {
    await prev;
  } catch {
    // ignore
  }
  setTimeout(release, SEC_MIN_DELAY_MS);
}

type SecFetchOpts = { revalidate?: number; noCache?: boolean; retries?: number };

async function edgarFetch(
  url: string,
  opts: SecFetchOpts = {},
): Promise<Response> {
  const { revalidate = 3600, noCache = false, retries = 3 } = opts;
  let attempt = 0;
  while (true) {
    await secAcquire();
    const init: RequestInit & { next?: { revalidate?: number } } = {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Encoding": "gzip, deflate",
      },
    };
    if (noCache) init.cache = "no-store";
    else init.next = { revalidate };
    const res = await fetch(url, init);
    if (res.ok) return res;
    if (res.status === 429 && attempt < retries) {
      const backoff = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, backoff));
      attempt++;
      continue;
    }
    if (res.status >= 500 && attempt < retries) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      attempt++;
      continue;
    }
    throw new Error(`SEC EDGAR ${res.status} ${res.statusText}: ${url}`);
  }
}

export type ManagerHit = {
  cik: string;
  name: string;
  latestFilingDate: string;
};

type EftsHit = {
  _source?: {
    ciks?: string[];
    display_names?: string[];
    file_date?: string;
  };
};

export async function searchManagers(query: string): Promise<ManagerHit[]> {
  const q = query.trim();
  if (!q) return [];
  // Use entityName so we search by filer name, not filing content.
  const url = `https://efts.sec.gov/LATEST/search-index?forms=13F-HR&entityName=${encodeURIComponent(
    q,
  )}`;
  const res = await edgarFetch(url, { revalidate: 600 });
  const data = (await res.json()) as { hits?: { hits?: EftsHit[] } };
  const map = new Map<string, ManagerHit>();
  for (const hit of data.hits?.hits ?? []) {
    const src = hit._source ?? {};
    const rawCik = src.ciks?.[0] ?? "";
    const cik = rawCik.replace(/^0+/, "");
    if (!cik) continue;
    const name = src.display_names?.[0] ?? "";
    const cleanName = name.replace(/\s*\(CIK \d+\)\s*$/, "").trim();
    const existing = map.get(cik);
    if (!existing) {
      map.set(cik, {
        cik,
        name: cleanName,
        latestFilingDate: src.file_date ?? "",
      });
    } else if ((src.file_date ?? "") > existing.latestFilingDate) {
      existing.latestFilingDate = src.file_date ?? existing.latestFilingDate;
    }
  }
  // Sort by most recent filing first.
  return Array.from(map.values())
    .sort((a, b) => b.latestFilingDate.localeCompare(a.latestFilingDate))
    .slice(0, 50);
}

export type Filing = {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  form: string;
  primaryDocument: string;
};

export type FundInfo = {
  cik: string;
  name: string;
  sicDescription?: string;
  addresses?: unknown;
  filings: Filing[];
};

type FilingsRecent = {
  form?: string[];
  accessionNumber?: string[];
  filingDate?: string[];
  reportDate?: string[];
  primaryDocument?: string[];
};

type SubmissionsResponse = {
  name?: string;
  sicDescription?: string;
  addresses?: unknown;
  filings?: {
    recent?: FilingsRecent;
    files?: Array<{ name: string }>;
  };
};

function extract13F(recent: FilingsRecent): Filing[] {
  const out: Filing[] = [];
  const forms = recent.form ?? [];
  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    if (form === "13F-HR" || form === "13F-HR/A") {
      out.push({
        accessionNumber: recent.accessionNumber?.[i] ?? "",
        filingDate: recent.filingDate?.[i] ?? "",
        reportDate: recent.reportDate?.[i] ?? "",
        form,
        primaryDocument: recent.primaryDocument?.[i] ?? "",
      });
    }
  }
  return out;
}

/**
 * Fetch filer info + 13F filings.
 *
 * - `mode: "recent"` (default): just the SEC's "recent" submissions array,
 *   which is enough for the dashboard's QoQ diffs.
 * - `mode: "all"`: also pages through historical archives. Slower (one extra
 *   request per ~1000-filing archive page) but returns every 13F SEC has.
 */
export async function getFundInfo(
  cik: string,
  mode: "recent" | "all" = "recent",
): Promise<FundInfo> {
  const cleanCik = cik.replace(/^0+/, "");
  const padded = cleanCik.padStart(10, "0");
  const url = `https://data.sec.gov/submissions/CIK${padded}.json`;
  const res = await edgarFetch(url);
  const data = (await res.json()) as SubmissionsResponse;
  const recent = data.filings?.recent ?? {};
  const filings: Filing[] = extract13F(recent);

  if (mode === "all") {
    const archives = data.filings?.files ?? [];
    const more = await Promise.all(
      archives.map(async (a) => {
        try {
          const ares = await edgarFetch(
            `https://data.sec.gov/submissions/${a.name}`,
          );
          const adata = (await ares.json()) as FilingsRecent;
          return extract13F(adata);
        } catch (err) {
          console.warn(`edgar: archive ${a.name} failed`, err);
          return [];
        }
      }),
    );
    for (const arr of more) filings.push(...arr);
    // Dedupe by accession number.
    const seen = new Set<string>();
    const unique: Filing[] = [];
    for (const f of filings) {
      if (!seen.has(f.accessionNumber)) {
        seen.add(f.accessionNumber);
        unique.push(f);
      }
    }
    filings.length = 0;
    filings.push(...unique);
  }

  filings.sort((a, b) => b.reportDate.localeCompare(a.reportDate));
  return {
    cik: cleanCik,
    name: data.name ?? "",
    sicDescription: data.sicDescription,
    addresses: data.addresses,
    filings,
  };
}

type FilingDirectoryItem = { name: string; type?: string; size?: string };
type FilingIndexResponse = {
  directory?: {
    item?: FilingDirectoryItem[];
  };
};

async function findInfoTableUrl(cik: string, accessionNumber: string): Promise<string> {
  const accDashless = accessionNumber.replace(/-/g, "");
  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accDashless}/index.json`;
  const indexRes = await edgarFetch(indexUrl);
  const indexData = (await indexRes.json()) as FilingIndexResponse;
  const items = indexData.directory?.item ?? [];

  const xmlFiles = items.filter((f) => f.name.toLowerCase().endsWith(".xml"));

  const named =
    xmlFiles.find((f) => /infotable|informationtable/i.test(f.name)) ??
    xmlFiles.find(
      (f) =>
        /13f/i.test(f.name) &&
        !/primary/i.test(f.name) &&
        !/cover/i.test(f.name),
    );

  let chosen: FilingDirectoryItem | undefined = named;
  if (!chosen) {
    const candidates = xmlFiles.filter((f) => !/primary|cover/i.test(f.name));
    candidates.sort(
      (a, b) => Number(b.size ?? "0") - Number(a.size ?? "0"),
    );
    chosen = candidates[0];
  }
  if (!chosen) {
    throw new Error("No information table XML found in filing");
  }
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accDashless}/${chosen.name}`;
}

// In-memory + on-disk cache for parsed holdings. 13F filings are immutable
// once submitted, so the cache effectively never expires; we just lazy-load
// from disk on first access.
const holdingsMem = new Map<string, Holding[]>();
const holdingsInflight = new Map<string, Promise<Holding[]>>();

function holdingsCacheKey(cik: string, accession: string): string {
  const safe = accession.replace(/[^a-zA-Z0-9-]/g, "_");
  return `holdings/${cik}/${safe}.json`;
}

/**
 * Fetch a filing's information-table holdings.
 *
 * Values are returned in **whole US dollars**, regardless of vintage. SEC
 * 13F modernization (effective for filings due on or after 2023-05-25)
 * switched the units from $1000s to $1s; that conversion is now applied
 * here at the data boundary so every caller can treat `Holding.value` as
 * dollars and not worry about the date.
 *
 * The on-disk cache stores raw (un-converted) values from the XML parser
 * so the cached file is forward-compatible — the conversion is applied
 * AFTER the cache read.
 *
 * `filingDate` is the date the 13F was filed (not the report-period
 * end). Required so we can pick the right unit convention.
 */
export async function getHoldings(
  cik: string,
  accessionNumber: string,
  filingDate: string,
): Promise<Holding[]> {
  const cleanCik = cik.replace(/^0+/, "");
  const memKey = `${cleanCik}|${accessionNumber}`;
  const mem = holdingsMem.get(memKey);
  if (mem) return applyUnits(mem, filingDate);

  const existing = holdingsInflight.get(memKey);
  if (existing) return applyUnits(await existing, filingDate);

  const promise = (async () => {
    const diskKey = holdingsCacheKey(cleanCik, accessionNumber);
    const fromDisk = await readJson<Holding[]>(diskKey);
    if (fromDisk) {
      holdingsMem.set(memKey, fromDisk);
      return fromDisk;
    }

    const xmlUrl = await findInfoTableUrl(cleanCik, accessionNumber);
    // Fetch XML without Next data cache — large info tables (Citadel's is
    // 10MB) exceed Next.js's 2MB fetch cache cap. Disk-cached above instead.
    const xmlRes = await edgarFetch(xmlUrl, { noCache: true });
    const xml = await xmlRes.text();
    const holdings = parseInfoTable(xml);
    holdingsMem.set(memKey, holdings);
    await writeJson(diskKey, holdings).catch((err) => {
      console.warn("edgar: failed to persist holdings cache", err);
    });
    return holdings;
  })();
  holdingsInflight.set(memKey, promise);
  try {
    const raw = await promise;
    return applyUnits(raw, filingDate);
  } finally {
    holdingsInflight.delete(memKey);
  }
}

/**
 * SEC 13F modernization: filings due on or before 2023-05-25 reported
 * `value` in $1000s; filings after that report in whole dollars. Used
 * internally by getHoldings — call sites should consume the converted
 * Holding[] directly and never need to know the vintage.
 */
function isValueInThousands(filingDateIso: string): boolean {
  return filingDateIso <= "2023-05-25";
}

function applyUnits(holdings: Holding[], filingDate: string): Holding[] {
  if (!isValueInThousands(filingDate)) return holdings;
  // Convert $1000s → whole dollars. Return a NEW array so we don't mutate
  // the in-memory / disk cache (which stores raw values for forward
  // compatibility).
  return holdings.map((h) => ({ ...h, value: h.value * 1000 }));
}

export type { Holding };
