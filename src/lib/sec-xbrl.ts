import { cache } from "react";

/**
 * SEC EDGAR XBRL data layer.
 *
 * Powers the fundamentals panel on /stock/[ticker]: revenue/income/EPS
 * trends and a recent-filings list for a public issuer.
 *
 * Inputs are *issuer* CIKs (e.g. Apple = 320193), not fund CIKs.
 *
 * Why this exists separately from src/lib/edgar.ts:
 * - edgar.ts is fund-side: 13F submissions, holdings XML, ownership filings.
 * - This file is issuer-side: companyfacts / companyconcept XBRL and the
 *   filings list from submissions. Different parse shapes, different
 *   downstream consumers.
 *
 * edgar.ts's internal fetch helper is not exported, so we inline an
 * equivalent here: User-Agent header, 10 req/sec token-bucket, 429/5xx
 * retry, and a soft 404 → null contract (the three fetchers never throw).
 */

const USER_AGENT =
  process.env.EDGAR_USER_AGENT ?? "13F Research mrdxdavidxie@gmail.com";

// SEC's documented limit is 10 req/sec per UA. Target ~9.5/sec by spacing
// acquisitions by 105ms. Single in-module token bucket — calls are also
// React-cached per request so the rate ceiling is rarely the bottleneck.
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

type SecJsonOpts = {
  revalidate?: number;
  retries?: number;
};

/**
 * Fetch+parse a SEC JSON endpoint.
 * - Returns null on 404 (SEC's "no such CIK / concept" signal).
 * - Returns null on any other failure (including non-JSON bodies and
 *   network errors) after logging — the three public fetchers should
 *   never throw at their callsite.
 * - Retries 429 with exponential backoff and 5xx with linear backoff.
 */
async function fetchSecJson<T>(
  url: string,
  opts: SecJsonOpts = {},
): Promise<T | null> {
  const { revalidate = 3600, retries = 3 } = opts;
  let attempt = 0;
  while (true) {
    await secAcquire();
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        next: { revalidate },
      });
      if (res.status === 404) return null;
      if (res.ok) {
        try {
          return (await res.json()) as T;
        } catch (err) {
          console.error(`sec-xbrl: non-JSON body from ${url}`, err);
          return null;
        }
      }
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
      console.error(
        `sec-xbrl: ${res.status} ${res.statusText} for ${url}`,
      );
      return null;
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        attempt++;
        continue;
      }
      console.error(`sec-xbrl: fetch failed for ${url}`, err);
      return null;
    }
  }
}

function padCik(cik: string): string {
  return cik.replace(/^0+/, "").padStart(10, "0");
}

function stripCik(cik: string): string {
  return cik.replace(/^0+/, "");
}

// -----------------------------------------------------------------
// Public types
// -----------------------------------------------------------------

/** A single XBRL fact data point — one reported value for one period. */
export type ConceptDataPoint = {
  end: string;
  val: number;
  accn: string;
  fy: number;
  fp: "FY" | "Q1" | "Q2" | "Q3" | "Q4";
  form: string;
  filed: string;
  start?: string;
  frame?: string;
};

/** Shape returned by /api/xbrl/companyfacts. */
export type XbrlFacts = {
  cik: string;
  entityName: string;
  facts: Record<
    string,
    Record<
      string,
      {
        label: string;
        description: string;
        units: Record<string, ConceptDataPoint[]>;
      }
    >
  >;
};

/** Shape returned by /api/xbrl/companyconcept. */
export type XbrlConcept = {
  cik: string;
  taxonomy: string;
  tag: string;
  label: string;
  description: string;
  entityName: string;
  units: Record<string, ConceptDataPoint[]>;
};

/** One filing in the issuer's recent-submissions list. */
export type IssuerFiling = {
  accession: string;
  form: string;
  filingDate: string;
  reportDate: string;
  primaryDocument: string;
  primaryDocDescription: string;
  url: string;
};

/** Shape returned by fetchIssuerSubmissions. */
export type IssuerRecentFilings = {
  cik: string;
  name: string;
  filings: IssuerFiling[];
};

// -----------------------------------------------------------------
// Raw response shapes (internal — not exported)
// -----------------------------------------------------------------

type RawConceptDataPoint = {
  end?: unknown;
  val?: unknown;
  accn?: unknown;
  fy?: unknown;
  fp?: unknown;
  form?: unknown;
  filed?: unknown;
  start?: unknown;
  frame?: unknown;
};

type RawConceptUnits = Record<string, RawConceptDataPoint[] | undefined>;

type RawCompanyFacts = {
  cik?: unknown;
  entityName?: unknown;
  facts?: Record<
    string,
    Record<
      string,
      {
        label?: unknown;
        description?: unknown;
        units?: RawConceptUnits;
      }
    >
  >;
};

type RawCompanyConcept = {
  cik?: unknown;
  taxonomy?: unknown;
  tag?: unknown;
  label?: unknown;
  description?: unknown;
  entityName?: unknown;
  units?: RawConceptUnits;
};

type RawSubmissionsRecent = {
  accessionNumber?: unknown;
  filingDate?: unknown;
  reportDate?: unknown;
  form?: unknown;
  primaryDocument?: unknown;
  primaryDocDescription?: unknown;
};

type RawSubmissions = {
  cik?: unknown;
  name?: unknown;
  filings?: {
    recent?: RawSubmissionsRecent;
  };
};

// -----------------------------------------------------------------
// Normalization helpers
// -----------------------------------------------------------------

const VALID_FP = new Set(["FY", "Q1", "Q2", "Q3", "Q4"]);

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asNumber(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function normalizePoint(p: RawConceptDataPoint): ConceptDataPoint | null {
  const end = asString(p.end);
  const accn = asString(p.accn);
  const fp = asString(p.fp);
  const form = asString(p.form);
  const filed = asString(p.filed);
  // Reject points missing critical identity fields.
  if (!end || !accn || !filed) return null;
  if (!VALID_FP.has(fp)) return null;
  const dp: ConceptDataPoint = {
    end,
    val: asNumber(p.val),
    accn,
    fy: asNumber(p.fy),
    fp: fp as ConceptDataPoint["fp"],
    form,
    filed,
  };
  if (typeof p.start === "string") dp.start = p.start;
  if (typeof p.frame === "string") dp.frame = p.frame;
  return dp;
}

function normalizeUnits(
  units: RawConceptUnits | undefined,
): Record<string, ConceptDataPoint[]> {
  const out: Record<string, ConceptDataPoint[]> = {};
  if (!units || typeof units !== "object") return out;
  for (const [unit, arr] of Object.entries(units)) {
    if (!Array.isArray(arr)) continue;
    const pts: ConceptDataPoint[] = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const pt = normalizePoint(raw);
      if (pt) pts.push(pt);
    }
    out[unit] = pts;
  }
  return out;
}

// -----------------------------------------------------------------
// Public fetchers (React-cached per request)
// -----------------------------------------------------------------

async function _fetchCompanyFacts(cik: string): Promise<XbrlFacts | null> {
  const padded = padCik(cik);
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`;
  const raw = await fetchSecJson<RawCompanyFacts>(url);
  if (!raw || typeof raw !== "object") return null;

  const facts: XbrlFacts["facts"] = {};
  const rawFacts = raw.facts;
  if (rawFacts && typeof rawFacts === "object") {
    for (const [taxonomy, concepts] of Object.entries(rawFacts)) {
      if (!concepts || typeof concepts !== "object") continue;
      const taxOut: XbrlFacts["facts"][string] = {};
      for (const [tag, body] of Object.entries(concepts)) {
        if (!body || typeof body !== "object") continue;
        taxOut[tag] = {
          label: asString(body.label),
          description: asString(body.description),
          units: normalizeUnits(body.units),
        };
      }
      facts[taxonomy] = taxOut;
    }
  }

  return {
    cik: stripCik(asString(raw.cik) || cik),
    entityName: asString(raw.entityName),
    facts,
  };
}

async function _fetchCompanyConcept(
  cik: string,
  concept: string,
  taxonomy = "us-gaap",
): Promise<XbrlConcept | null> {
  const padded = padCik(cik);
  const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${padded}/${taxonomy}/${concept}.json`;
  const raw = await fetchSecJson<RawCompanyConcept>(url);
  if (!raw || typeof raw !== "object") return null;
  return {
    cik: stripCik(asString(raw.cik) || cik),
    taxonomy: asString(raw.taxonomy) || taxonomy,
    tag: asString(raw.tag) || concept,
    label: asString(raw.label),
    description: asString(raw.description),
    entityName: asString(raw.entityName),
    units: normalizeUnits(raw.units),
  };
}

async function _fetchIssuerSubmissions(
  cik: string,
  limit = 50,
): Promise<IssuerRecentFilings | null> {
  const cleanCik = stripCik(cik);
  const padded = padCik(cik);
  const url = `https://data.sec.gov/submissions/CIK${padded}.json`;
  const raw = await fetchSecJson<RawSubmissions>(url);
  if (!raw || typeof raw !== "object") return null;

  const recent = raw.filings?.recent ?? {};
  const accs = Array.isArray(recent.accessionNumber)
    ? (recent.accessionNumber as unknown[])
    : [];
  const filingDates = Array.isArray(recent.filingDate)
    ? (recent.filingDate as unknown[])
    : [];
  const reportDates = Array.isArray(recent.reportDate)
    ? (recent.reportDate as unknown[])
    : [];
  const forms = Array.isArray(recent.form) ? (recent.form as unknown[]) : [];
  const primaryDocs = Array.isArray(recent.primaryDocument)
    ? (recent.primaryDocument as unknown[])
    : [];
  const primaryDescs = Array.isArray(recent.primaryDocDescription)
    ? (recent.primaryDocDescription as unknown[])
    : [];

  const filings: IssuerFiling[] = [];
  for (let i = 0; i < accs.length; i++) {
    const accession = asString(accs[i]);
    if (!accession) continue;
    const primaryDocument = asString(primaryDocs[i]);
    const accNoDashes = accession.replace(/-/g, "");
    const url = primaryDocument
      ? `https://www.sec.gov/Archives/edgar/data/${cleanCik}/${accNoDashes}/${primaryDocument}`
      : `https://www.sec.gov/Archives/edgar/data/${cleanCik}/${accNoDashes}/`;
    filings.push({
      accession,
      form: asString(forms[i]),
      filingDate: asString(filingDates[i]),
      reportDate: asString(reportDates[i]),
      primaryDocument,
      primaryDocDescription: asString(primaryDescs[i]),
      url,
    });
  }

  filings.sort((a, b) => b.filingDate.localeCompare(a.filingDate));

  return {
    cik: cleanCik,
    name: asString(raw.name),
    filings: filings.slice(0, Math.max(0, limit)),
  };
}

/** Fetch the full XBRL companyfacts blob for an issuer. 404 → null. */
export const fetchCompanyFacts = cache(_fetchCompanyFacts);

/** Fetch a single XBRL concept time-series for an issuer. 404 → null. */
export const fetchCompanyConcept = cache(_fetchCompanyConcept);

/** Fetch and pivot an issuer's recent filings list. 404 → null. */
export const fetchIssuerSubmissions = cache(_fetchIssuerSubmissions);
