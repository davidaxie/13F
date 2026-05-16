import { parseInfoTable, type Holding } from "./parse-13f";

const USER_AGENT =
  process.env.EDGAR_USER_AGENT ?? "13F Research Tool research@example.com";

async function edgarFetch(url: string, revalidate = 3600): Promise<Response> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Encoding": "gzip, deflate",
    },
    next: { revalidate },
  });
  if (!res.ok) {
    throw new Error(`SEC EDGAR ${res.status} ${res.statusText}: ${url}`);
  }
  return res;
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
  const res = await edgarFetch(url, 600);
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

type SubmissionsResponse = {
  name?: string;
  sicDescription?: string;
  addresses?: unknown;
  filings?: {
    recent?: {
      form?: string[];
      accessionNumber?: string[];
      filingDate?: string[];
      reportDate?: string[];
      primaryDocument?: string[];
    };
  };
};

export async function getFundInfo(cik: string): Promise<FundInfo> {
  const cleanCik = cik.replace(/^0+/, "");
  const padded = cleanCik.padStart(10, "0");
  const url = `https://data.sec.gov/submissions/CIK${padded}.json`;
  const res = await edgarFetch(url);
  const data = (await res.json()) as SubmissionsResponse;
  const recent = data.filings?.recent ?? {};
  const filings: Filing[] = [];
  const forms = recent.form ?? [];
  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    if (form === "13F-HR" || form === "13F-HR/A") {
      filings.push({
        accessionNumber: recent.accessionNumber?.[i] ?? "",
        filingDate: recent.filingDate?.[i] ?? "",
        reportDate: recent.reportDate?.[i] ?? "",
        form,
        primaryDocument: recent.primaryDocument?.[i] ?? "",
      });
    }
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

type HoldingsCacheEntry = { at: number; holdings: Holding[] };
const HOLDINGS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const holdingsCache = new Map<string, HoldingsCacheEntry>();

export async function getHoldings(
  cik: string,
  accessionNumber: string,
): Promise<Holding[]> {
  const cleanCik = cik.replace(/^0+/, "");
  const key = `${cleanCik}|${accessionNumber}`;
  const cached = holdingsCache.get(key);
  if (cached && Date.now() - cached.at < HOLDINGS_TTL_MS) {
    return cached.holdings;
  }

  const xmlUrl = await findInfoTableUrl(cleanCik, accessionNumber);
  // Fetch XML directly without Next data cache — large info tables
  // (Citadel's is 10MB) exceed Next.js's 2MB fetch cache cap.
  const xmlRes = await fetch(xmlUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Encoding": "gzip, deflate",
    },
    cache: "no-store",
  });
  if (!xmlRes.ok) {
    throw new Error(`SEC EDGAR ${xmlRes.status} ${xmlRes.statusText}: ${xmlUrl}`);
  }
  const xml = await xmlRes.text();
  const holdings = parseInfoTable(xml);
  holdingsCache.set(key, { at: Date.now(), holdings });
  return holdings;
}

export function isValueInThousands(filingDateIso: string): boolean {
  // SEC 13F modernization: filings required on or before 2023-05-25 reported in $1000s,
  // filings after that report in whole dollars.
  return filingDateIso <= "2023-05-25";
}

export type { Holding };
