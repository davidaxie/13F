"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, X, Loader2 } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

type SubscriptionState = "loading" | "subscribed" | "unsubscribed";

/**
 * Bell icon button that lets a signed-in user subscribe to email alerts for a
 * specific fund CIK. Renders a small inline popover (native <dialog>) asking
 * for their email on first subscribe. Clicking again unsubscribes.
 *
 * Signed-out users see the bell in a muted disabled state with a tooltip.
 */
export function AlertBell({ cik, size = 18 }: { cik: string; size?: number }) {
  const { isLoaded, isSignedIn } = useAuth();

  // `fetchedState` only ever changes from inside async callbacks (fetch
  // .then / .catch), never synchronously in an effect body — React 19's
  // set-state-in-effect rule. The signed-out case is *derived* below rather
  // than set, so there's no synchronous setState in the effect.
  const [fetchedState, setFetchedState] =
    useState<SubscriptionState>("loading");
  const [email, setEmail] = useState("");
  const [inputEmail, setInputEmail] = useState("");
  const [showPopover, setShowPopover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load current subscription state once the user is known to be signed in.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    fetch("/api/alerts/subscribe")
      .then((r) => r.json())
      .then((data: { ciks: string[]; email: string | null }) => {
        if (cancelled) return;
        setFetchedState(
          data.ciks.includes(cik) ? "subscribed" : "unsubscribed",
        );
        if (data.email) setEmail(data.email);
      })
      .catch(() => {
        if (!cancelled) setFetchedState("unsubscribed");
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, cik]);

  // Signed-out / not-yet-loaded users are always "unsubscribed" — derived,
  // not stored, so we never sync-set state in an effect.
  const state: SubscriptionState =
    !isLoaded || !isSignedIn ? "unsubscribed" : fetchedState;

  // Focus the input when the popover opens (DOM side-effect only — no
  // setState here; the prefill happens in the click handler that opens it).
  useEffect(() => {
    if (!showPopover) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [showPopover]);

  function openPopover() {
    setInputEmail(email);
    setErrorMsg(null);
    setShowPopover(true);
  }

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowPopover(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function handleClick() {
    if (!isLoaded || !isSignedIn) return;

    if (state === "subscribed") {
      // Unsubscribe immediately.
      setSaving(true);
      try {
        await fetch("/api/alerts/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cik }),
        });
        setFetchedState("unsubscribed");
      } catch {
        // silent
      } finally {
        setSaving(false);
      }
    } else {
      // If we already have an email on file, subscribe immediately.
      if (email) {
        await subscribe(email);
      } else {
        openPopover();
      }
    }
  }

  async function subscribe(emailAddr: string) {
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cik, email: emailAddr }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to subscribe");
      }
      setEmail(emailAddr);
      setFetchedState("subscribed");
      setShowPopover(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputEmail.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    await subscribe(inputEmail);
  }

  const isActive = state === "subscribed";
  const isDisabled = !isLoaded || !isSignedIn || saving;

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled && isLoaded}
        aria-pressed={isActive}
        aria-label={
          !isSignedIn
            ? "Sign in to receive email alerts"
            : isActive
              ? "Unsubscribe from email alerts"
              : "Subscribe to email alerts"
        }
        title={
          !isLoaded || !isSignedIn
            ? "Sign in to receive email alerts"
            : isActive
              ? `Subscribed · click to unsubscribe (${email})`
              : "Subscribe to email alerts"
        }
        className={cn(
          "inline-flex items-center justify-center rounded-sm border border-transparent p-1 transition-colors hover:border-hairline",
          isActive
            ? "text-accent"
            : !isSignedIn
              ? "cursor-default text-muted/40"
              : "text-muted hover:text-foreground",
        )}
      >
        {saving ? (
          <Loader2 size={size} strokeWidth={1.5} className="animate-spin" aria-hidden />
        ) : isActive ? (
          <Bell size={size} strokeWidth={1.5} fill="currentColor" aria-hidden />
        ) : (
          <BellOff size={size} strokeWidth={1.5} aria-hidden />
        )}
      </button>

      {/* Inline subscribe popover */}
      {showPopover && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Subscribe to email alerts"
          className="absolute left-0 top-9 z-50 w-72 rounded-md border border-hairline bg-background p-4 shadow-lg"
          ref={dialogRef as unknown as React.RefObject<HTMLDivElement>}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              Email alerts
            </span>
            <button
              type="button"
              onClick={() => setShowPopover(false)}
              aria-label="Close"
              className="text-muted hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-muted">
            We&apos;ll send you a digest when this fund files a new 13F with
            material moves (new positions, full exits, or adds ≥$50M).
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="email"
              value={inputEmail}
              onChange={(e) => setInputEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-sm border border-hairline bg-subtle px-3 py-1.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {errorMsg && (
              <p className="text-xs text-negative">{errorMsg}</p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="rounded-sm bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity disabled:opacity-50 hover:opacity-80"
            >
              {saving ? "Subscribing…" : "Subscribe"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
