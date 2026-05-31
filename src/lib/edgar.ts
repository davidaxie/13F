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

// Pulls schedule-13D / 13G ownership filings (and their amendments) out of a
// submissions list. These are filed when an investor crosses the 5% ownership
// threshold of a public company's voting equity:
//   SC 13D   = active investor (intent to influence management).
//   SC 13G   = passive (5%+ but no influence intent — index funds, big LPs).
//   SC 13D/A = amendment to active.
//   SC 13G/A = amendment to passive.
function extractOwnershipFilings(recent: FilingsRecent): Filing[] {
  const out: Filing[] = [];
  const forms = recent.form ?? [];
  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    if (
      form === "SC 13D" ||
      form === "SC 13G" ||
      form === "SC 13D/A" ||
      form === "SC 13G/A"
    ) {
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

// Extract Form 4 insider-transaction filings from a submissions buffer.
// Form 4 is filed by company INSIDERS (officers, directors, 10%+ owners),
// not by 13F filers. To use this on a stock page, look up the issuer's
// CIK via refdata.cikForTicker and call getInsiderFilings(issuerCik).
function extractForm4(recent: FilingsRecent): Filing[] {
  const out: Filing[] = [];
  const forms = recent.form ?? [];
  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === "4" || forms[i] === "4/A") {
      out.push({
        accessionNumber: recent.accessionNumber?.[i] ?? "",
        filingDate: recent.filingDate?.[i] ?? "",
        reportDate: recent.reportDate?.[i] ?? "",
        form: forms[i],
        primaryDocument: recent.primaryDocument?.[i] ?? "",
      });
    }
  }
  return out;
}

/**
 * Fetch recent Form 4 filings filed against a public issuer (by its
 * insiders — officers, directors, 10%+ owners). The submissions API
 * returns up to 1,000 most-recent filings of all types; we filter to
 * Form 4 and 4/A and sort newest-first. Each filing's accession is a
 * link to EDGAR for the full transaction detail.
 *
 * No deep XML parsing in v1 — surfacing the filing count and a list with
 * EDGAR links is the headline signal. The transaction codes (P/S/A/F/etc.)
 * and per-transaction $ amounts are inside each XML — a follow-up will
 * parse these for net insider buying/selling figures.
 */
export async function getInsiderFilings(
  issuerCik: string,
): Promise<Filing[]> {
  const cleanCik = issuerCik.replace(/^0+/, "");
  const padded = cleanCik.padStart(10, "0");
  const url = `https://data.sec.gov/submissions/CIK${padded}.json`;
  try {
    const res = await edgarFetch(url);
    const data = (await res.json()) as SubmissionsResponse;
    const recent = data.filings?.recent ?? {};
    const filings = extractForm4(recent);
    filings.sort((a, b) => b.filingDate.localeCompare(a.filingDate));
    return filings;
  } catch (err) {
    console.warn(`edgar: getInsiderFilings(${cleanCik}) failed`, err);
    return [];
  }
}

/**
 * Fetch a filer's recent Schedule 13D / 13G filings (and amendments) from
 * the EDGAR submissions API. Returns at most the "recent" buffer (last
 * 1,000 filings of all types, so up to a few years of 13D/G depending on
 * activity).
 *
 * This is the "5%+ ownership disclosure" signal — when an investor crosses
 * 5% in a public company's voting equity they file an SC 13D (if they
 * intend to influence management) or SC 13G (passive). Activist funds
 * file 13Ds first, then often amend with each subsequent action; index
 * funds and big LPs file 13Gs.
 *
 * Each filing's deep cover-page contents (% owned, purpose-of-transaction
 * narrative, target company CIK) aren't parsed yet — the form alone is
 * informative as an activism signal. EDGAR links let users drill in.
 */
export async function getOwnershipFilings(cik: string): Promise<Filing[]> {
  const cleanCik = cik.replace(/^0+/, "");
  const padded = cleanCik.padStart(10, "0");
  const url = `https://data.sec.gov/submissions/CIK${padded}.json`;
  try {
    const res = await edgarFetch(url);
    const data = (await res.json()) as SubmissionsResponse;
    const recent = data.filings?.recent ?? {};
    const filings = extractOwnershipFilings(recent);
    filings.sort((a, b) => b.filingDate.localeCompare(a.filingDate));
    return filings;
  } catch (err) {
    console.warn(`edgar: getOwnershipFilings(${cleanCik}) failed`, err);
    return [];
  }
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
 * Normalize a single holding's reported `value` to whole dollars.
 *
 * BACKGROUND — the "1000× inflation bug":
 *   The SEC's 13F-HR XML schema historically reported holding `value` in
 *   THOUSANDS of dollars. As part of the 13F modernization, filings due on
 *   or AFTER 2023-05-25 must report `value` in WHOLE dollars. The boundary
 *   here is strict `<`: a filing dated exactly 2023-05-25 is post-cutover
 *   and already in whole dollars. (The previous implementation used `<=`,
 *   which incorrectly inflated boundary-date filings by 1000×.)
 *
 *   Worse: some filers reported in whole-dollars BEFORE the deadline
 *   (either anticipating the rule or as a long-standing house style).
 *   Blindly multiplying every pre-cutoff row by 1000 inflates those
 *   filers' holdings by 1000× — Berkshire's 2023-05-15 COF entry, for
 *   instance, came back as $954B instead of $954M.
 *
 * SANITY CHECK:
 *   For pre-cutoff filings with shares > 0, compute the per-share price
 *   that the multiplication would imply. If that per-share value exceeds
 *   PER_SHARE_PLAUSIBILITY_CEILING_USD, assume the filer already reports
 *   in whole dollars and skip the multiplication.
 *
 *   The ceiling is set at $50,000/share. Rationale:
 *     - Legitimate institutional 13F holdings rarely show a per-share
 *       above this (Berkshire-A around $500-700k is the lone US-equity
 *       exception, and institutional 13F filers almost universally hold
 *       Berkshire-B at ~$300, not the A shares).
 *     - The bug inflates per-share by exactly 1000×. Real Capital One
 *       at ~$100/share becomes ~$96,000/share when wrongly multiplied —
 *       well above this ceiling, which catches it.
 *   The trade-off: a legitimate pre-cutoff Berkshire-A holding would
 *   false-trigger and be under-reported by 1000×. We accept this for the
 *   ~597 known buggy snapshot trades; correct Berkshire-A holdings in
 *   13F filings are vanishingly rare.
 *
 * SHARES = 0:
 *   Options/puts/calls/contracts sometimes have no notional share count
 *   (the SEC schema permits sshPrnamt=0 for principal-amount instruments).
 *   We cannot compute a per-share check, so fall back to the date-based
 *   rule alone: multiply pre-cutoff, leave post-cutoff untouched.
 */
const SEC_WHOLE_DOLLAR_CUTOVER_ISO = "2023-05-25";
const PER_SHARE_PLAUSIBILITY_CEILING_USD = 50_000;

export function normalizeHoldingValue(
  rawValue: number,
  shares: number,
  filingDateIso: string,
): number {
  // Filings on or after the cutover are already in whole dollars.
  if (filingDateIso >= SEC_WHOLE_DOLLAR_CUTOVER_ISO) return rawValue;

  // Pre-cutoff. Default behavior is to multiply by 1000 (thousands → whole).
  const candidate = rawValue * 1000;

  // If we have a positive share count, check whether the multiplied value
  // would imply an absurd per-share price. If so, the filer is already
  // reporting in whole dollars — return the raw value unchanged.
  if (shares > 0) {
    const impliedPerShare = candidate / shares;
    if (impliedPerShare > PER_SHARE_PLAUSIBILITY_CEILING_USD) {
      return rawValue;
    }
  }

  return candidate;
}

function applyUnits(holdings: Holding[], filingDate: string): Holding[] {
  // Return a NEW array so we don't mutate the in-memory / disk cache
  // (which stores raw values for forward compatibility).
  return holdings.map((h) => ({
    ...h,
    value: normalizeHoldingValue(h.value, h.shares, filingDate),
  }));
}

export type { Holding };
