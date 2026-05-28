import { NextResponse } from "next/server";
import { getEntryWeights } from "@/lib/entries-by-style";

export const dynamic = "force-dynamic";
// The live fund-diff fetch across the universe can take ~20-30s cold.
export const maxDuration = 60;

// GET /api/entry-weights
// Returns { weights: { "<cik>:<cusip>": <weight % of fund book> } } for every
// new common-stock position this quarter. The /entries page renders instantly
// from snapshots and fetches this afterward to fill in the conviction bars, so
// a slow or failed response degrades gracefully (bars just stay idle).
export async function GET(): Promise<NextResponse> {
  try {
    const weights = await getEntryWeights();
    return NextResponse.json(
      { weights },
      {
        // 13F data moves quarterly — let the CDN serve it warm for an hour and
        // revalidate in the background so repeat visits fill in immediately.
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    return NextResponse.json({ weights: {} });
  }
}
