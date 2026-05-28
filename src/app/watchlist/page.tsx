// Server component — force-dynamic so auth() has a request context.
// When the user is signed in we read KV server-side and pass the data as
// props to the client component below; signed-out users fall back to the
// original localStorage path in the same client component.

import { auth } from "@clerk/nextjs/server";
import { kv } from "@vercel/kv";
import { WatchlistContent } from "./watchlist-content";
import { newestBacktestDate } from "@/lib/backtest-meta";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const { userId } = await auth();

  let serverFunds: string[] = [];
  let serverStocks: string[] = [];

  if (userId) {
    [serverFunds, serverStocks] = await Promise.all([
      kv.smembers(`watchlist:${userId}:funds`).then((r) => (r ?? []).sort()),
      kv.smembers(`watchlist:${userId}:stocks`).then((r) => (r ?? []).sort()),
    ]);
  }

  // QW-05: newest backtest file mtime as a data-freshness indicator.
  const dataRefreshedAt = newestBacktestDate();

  return (
    <WatchlistContent
      isSignedIn={!!userId}
      serverFunds={serverFunds}
      serverStocks={serverStocks}
      dataRefreshedAt={dataRefreshedAt}
    />
  );
}
