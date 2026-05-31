import type { MetadataRoute } from "next";
import { MARQUEE_FUNDS } from "@/lib/funds";
import { computeConsensusView } from "@/lib/consensus";

// Public canonical origin — kept in sync with robots.ts.
const SITE_URL = "https://13f.mapperlab.co";

// How many of the most-owned tickers to include in the sitemap. Goal: cover
// the names that actually rank in search — every stock the marquee universe
// touches. 200 is generous; the snapshot universe rarely has more than that
// with a tracked ticker anyway.
const TOP_STOCK_LIMIT = 200;

type Entry = MetadataRoute.Sitemap[number];

// Static, hand-maintained list of top-level routes. Keep this in sync
// with the nav in src/app/layout.tsx + any net-new pages.
const STATIC_ROUTES: Array<{
  path: string;
  priority: number;
  changeFrequency: NonNullable<Entry["changeFrequency"]>;
}> = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/dashboard", priority: 0.9, changeFrequency: "daily" },
  { path: "/consensus", priority: 0.9, changeFrequency: "weekly" },
  { path: "/entries", priority: 0.9, changeFrequency: "weekly" },
  { path: "/universe", priority: 0.7, changeFrequency: "weekly" },
  { path: "/leaderboard", priority: 0.7, changeFrequency: "weekly" },
  { path: "/backtest/follower", priority: 0.7, changeFrequency: "weekly" },
  { path: "/backtest/conviction", priority: 0.7, changeFrequency: "weekly" },
  { path: "/compare", priority: 0.6, changeFrequency: "weekly" },
  { path: "/watchlist", priority: 0.4, changeFrequency: "monthly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: Entry[] = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // Per-fund landing + performance pages for every snapshotted marquee fund.
  // Performance pages rank higher because they're the richer view (backtest,
  // charts, stats) that we redirect tracked-fund search results to.
  const fundEntries: Entry[] = MARQUEE_FUNDS.flatMap((f) => [
    {
      url: `${SITE_URL}/fund/${f.cik}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/fund/${f.cik}/performance`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
  ]);

  // Top-N tracked stock pages. mostOwned is sorted by holder count then
  // capital — exactly the ranking we want for SEO priority. Filter out
  // entries without a resolved ticker (the stock page is keyed on ticker).
  let stockEntries: Entry[] = [];
  try {
    const consensus = computeConsensusView();
    const seen = new Set<string>();
    for (const n of consensus.mostOwned) {
      if (!n.ticker) continue;
      if (seen.has(n.ticker)) continue;
      seen.add(n.ticker);
      stockEntries.push({
        // Mirror the search-page convention: dynamic segments can't contain
        // "/", so a share-class slash gets normalized to a dot.
        url: `${SITE_URL}/stock/${n.ticker.replace(/\//g, ".")}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      });
      if (stockEntries.length >= TOP_STOCK_LIMIT) break;
    }
  } catch (e) {
    // computeConsensusView reads snapshot JSON on disk; if those are
    // missing at build time we still want a valid sitemap with the
    // static + fund routes rather than a 500.
    console.error("[sitemap] consensus view failed, omitting stocks:", e);
    stockEntries = [];
  }

  return [...staticEntries, ...fundEntries, ...stockEntries];
}
