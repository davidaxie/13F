// Server component. When the user is signed in we read KV server-side and
// pass the data as props to the client component below; signed-out users
// fall back to the original localStorage path in the same client component.
//
// Performance note (Phase 11.9): we used to declare `force-dynamic` at the
// module level, which forced auth() + KV fetches on every request — even
// for anonymous visitors who never had any server-side watchlist data.
// We now gate the auth+KV path on the presence of Clerk's `__session`
// cookie. Cookie absence is the strongest "definitely-not-signed-in"
// signal we can read at the edge — `cookies()` itself still marks the
// route dynamic at request time, so we don't need the explicit
// `force-dynamic` declaration.

import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { kv } from "@vercel/kv";
import { WatchlistContent } from "./watchlist-content";
import { newestBacktestDate } from "@/lib/backtest-meta";

// Clerk's session-JWT cookie name. Verified against
// node_modules/@clerk/backend/dist/constants.d.ts (Session: "__session").
const CLERK_SESSION_COOKIE = "__session";

export default async function WatchlistPage() {
  // Cheap signed-out check: if Clerk hasn't issued a session cookie, the
  // user is anonymous — skip the (expensive) auth() + KV roundtrip and
  // render the localStorage-only path. cookies() is async per Next 16.
  const cookieStore = await cookies();
  const hasSession = cookieStore.has(CLERK_SESSION_COOKIE);

  let serverFunds: string[] = [];
  let serverStocks: string[] = [];
  let isSignedIn = false;

  if (hasSession) {
    const { userId } = await auth();
    if (userId) {
      isSignedIn = true;
      [serverFunds, serverStocks] = await Promise.all([
        kv.smembers(`watchlist:${userId}:funds`).then((r) => (r ?? []).sort()),
        kv.smembers(`watchlist:${userId}:stocks`).then((r) => (r ?? []).sort()),
      ]);
    }
  }

  // QW-05: newest backtest file mtime as a data-freshness indicator.
  const dataRefreshedAt = newestBacktestDate();

  return (
    <WatchlistContent
      isSignedIn={isSignedIn}
      serverFunds={serverFunds}
      serverStocks={serverStocks}
      dataRefreshedAt={dataRefreshedAt}
    />
  );
}
