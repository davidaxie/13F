"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Star } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { watchlist, kvWatchlist, migrateLocalStorageToKv } from "@/lib/watchlist";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// localStorage external-store wiring (used for signed-out users only).
// ---------------------------------------------------------------------------

// External-store subscribe: re-render on any watchlist change. Cross-tab
// changes also trigger the synthetic event so multiple stars on the same
// page stay in sync.
function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("watchlist:change", callback);
  return () => window.removeEventListener("watchlist:change", callback);
}

// ---------------------------------------------------------------------------
// One-time migration guard: track which users have been migrated this session
// so we don't repeatedly POST on every render.
// ---------------------------------------------------------------------------
const migratedUsers = new Set<string>();

/**
 * A small star button that toggles whether the current fund or stock is in
 * the user's watchlist.
 *
 * - Signed in  → KV-backed (Vercel KV via /api/watchlist) with optimistic UI.
 *               On first mount, any existing localStorage items are migrated
 *               up to KV then cleared locally.
 * - Signed out → localStorage-backed (original behaviour, unchanged).
 *               Uses useSyncExternalStore so the subscription is React 19-correct
 *               (no setState-in-effect) and SSR-safe (server returns `false`,
 *               client hydrates the real value).
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
  const { isLoaded, isSignedIn, userId } = useAuth();

  // ── KV path state (signed-in users) ───────────────────────────────────────
  const [kvActive, setKvActive] = useState(false);
  const [kvLoaded, setKvLoaded] = useState(false);

  // Load KV state on mount / when auth resolves.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;

    // One-time migration of any localStorage items to KV.
    if (userId && !migratedUsers.has(userId)) {
      migratedUsers.add(userId);
      migrateLocalStorageToKv().catch(() => {});
    }

    // Load this item's current state from KV.
    const listFn =
      kind === "fund" ? kvWatchlist.funds.list : kvWatchlist.stocks.list;
    listFn().then((items) => {
      if (cancelled) return;
      setKvActive(items.includes(id));
      setKvLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, kind, id]);

  // ── localStorage path state (signed-out users) ────────────────────────────
  const lsActive = useSyncExternalStore(
    subscribe,
    () =>
      kind === "fund" ? watchlist.funds.has(id) : watchlist.stocks.has(id),
    // Server snapshot — localStorage isn't available, so always render
    // unselected. Hydration upgrades to the real value.
    () => false,
  );

  // ── Derived active state ───────────────────────────────────────────────────
  const active = isLoaded && isSignedIn ? kvActive : lsActive;

  // ── Click handler ──────────────────────────────────────────────────────────
  // Use a ref to prevent double-clicks from firing concurrent API calls.
  const pendingRef = useRef(false);

  async function onClick() {
    if (isLoaded && isSignedIn) {
      if (pendingRef.current || !kvLoaded) return;
      pendingRef.current = true;

      // Optimistic update — reflect the change immediately in the UI.
      const optimistic = !kvActive;
      setKvActive(optimistic);

      try {
        const toggleFn =
          kind === "fund" ? kvWatchlist.funds.toggle : kvWatchlist.stocks.toggle;
        const result = await toggleFn(id);
        setKvActive(result);
      } catch {
        // Revert on error.
        setKvActive(!optimistic);
      } finally {
        pendingRef.current = false;
      }
    } else {
      // localStorage path — toggle dispatches watchlist:change,
      // which our subscribe() forwards to React via useSyncExternalStore.
      if (kind === "fund") watchlist.funds.toggle(id);
      else watchlist.stocks.toggle(id);
    }
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
