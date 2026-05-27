"use client";

import { useSyncExternalStore } from "react";
import { Star } from "lucide-react";
import { watchlist } from "@/lib/watchlist";
import { cn } from "@/lib/utils";

// External-store subscribe: re-render on any watchlist change. Cross-tab
// changes also trigger the synthetic event so multiple stars on the same
// page stay in sync.
function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("watchlist:change", callback);
  return () => window.removeEventListener("watchlist:change", callback);
}

/**
 * A small star button that toggles whether the current fund or stock is in
 * the user's localStorage-backed watchlist. Uses useSyncExternalStore so the
 * subscription is React 19-correct (no setState-in-effect) and SSR-safe
 * (server returns `false`, client hydrates the real value).
 */
export function WatchlistStar({
  kind,
  id,
  size = 18,
}: {
  kind: "fund" | "stock";
  /** CIK for funds, ticker for stocks. */
  id: string;
  size?: number;
}) {
  const active = useSyncExternalStore(
    subscribe,
    () =>
      kind === "fund" ? watchlist.funds.has(id) : watchlist.stocks.has(id),
    // Server snapshot — localStorage isn't available, so always render
    // unselected. Hydration upgrades to the real value.
    () => false,
  );

  function onClick() {
    if (kind === "fund") watchlist.funds.toggle(id);
    else watchlist.stocks.toggle(id);
    // No setState — the toggle dispatches watchlist:change, which our
    // subscribe() forwards to React.
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? "Remove from watchlist" : "Add to watchlist"}
      title={active ? "Remove from watchlist" : "Add to watchlist"}
      className={cn(
        "inline-flex items-center justify-center rounded-sm border border-transparent p-1 transition-colors hover:border-hairline",
        active ? "text-accent" : "text-muted hover:text-foreground",
      )}
    >
      <Star
        size={size}
        strokeWidth={1.5}
        fill={active ? "currentColor" : "none"}
        aria-hidden="true"
      />
    </button>
  );
}
