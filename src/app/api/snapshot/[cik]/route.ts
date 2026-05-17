import { NextRequest, NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtest";
import { MARQUEE_FUNDS } from "@/lib/dashboard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Local-only helper for generating bundled backtest snapshots. Curl this from
// a warm dev server (which has the full disk cache) to dump JSON; the result
// is committed to src/data/backtest/ so production reads it as a static file
// instead of re-running the full backtest on Vercel.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ cik: string }> },
) {
  const { cik } = await ctx.params;
  const fund = MARQUEE_FUNDS.find((f) => f.cik === cik.replace(/^0+/, ""));
  if (!fund) {
    return NextResponse.json(
      { error: `CIK ${cik} not in MARQUEE_FUNDS` },
      { status: 404 },
    );
  }
  const u = new URL(req.url);
  const mode = (u.searchParams.get("mode") as "recent" | "all" | null) ?? "all";
  const cap = Number(u.searchParams.get("cap")) || 0;
  const result = await runBacktest(fund.cik, fund.displayName, 10000, mode, cap);
  return NextResponse.json(result);
}
