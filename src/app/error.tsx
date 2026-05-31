"use client";

// Route-segment error boundary. Wraps every page below the root layout
// (the root layout itself is handled by global-error.tsx). Must be a
// Client Component per Next 16's error.js contract.

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  // Next 16's error contract renamed `reset` → `unstable_retry`. Older
  // examples may still pass `reset`; accept both so the page renders even
  // if framework wiring shifts. Whichever exists, we wire to the Reset
  // button below.
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    // Log internally but don't render the message — server errors may carry
    // sensitive details that production guards against by serving only the
    // digest. (See node_modules/next/dist/docs/01-app/03-api-reference/
    // 03-file-conventions/error.md.)
    console.error("[error-boundary]", error);
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-24">
      <div className="text-xs uppercase tracking-widest text-negative/80">
        Error
      </div>
      <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground sm:text-6xl">
        Something went wrong.
      </h1>
      <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
        An unexpected error occurred on this page. We&apos;ve logged the issue.
        You can retry the request, or head back to the dashboard.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-muted/70">
          ref: {error.digest}
        </p>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        {retry && (
          <button
            type="button"
            onClick={() => retry()}
            className="inline-flex items-center gap-2 rounded-full border border-foreground bg-foreground px-4 py-2 text-sm text-background transition-colors hover:bg-background hover:text-foreground"
          >
            Reset
          </button>
        )}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm text-muted transition-colors hover:border-foreground hover:text-foreground"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
