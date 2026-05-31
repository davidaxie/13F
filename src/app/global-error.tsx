"use client";

// Replaces the root layout when an error throws *in* the root layout (or
// in a layout above the segment error boundary). Per Next 16 docs, it
// must render its own <html><body> — the root layout is bypassed.
// Keep this minimal: no fonts, no provider, no nav — those could be the
// thing that crashed.

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error("[global-error-boundary]", error);
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <html lang="en">
      <body
        style={{
          background: "#0a0a0a",
          color: "#e5e5e5",
          minHeight: "100vh",
          margin: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 640,
            margin: "0 auto",
            padding: "96px 24px",
          }}
        >
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "#a0a0a0",
            }}
          >
            Error
          </div>
          <h1
            style={{
              marginTop: 8,
              fontSize: 48,
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              fontFamily: "Georgia, 'Times New Roman', serif",
            }}
          >
            Something went wrong.
          </h1>
          <p
            style={{
              marginTop: 24,
              color: "#a0a0a0",
              maxWidth: 480,
              lineHeight: 1.6,
            }}
          >
            An unexpected error occurred. We&apos;ve logged it. Try refreshing
            the page, or return to the dashboard.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: 12,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 12,
                color: "#707070",
              }}
            >
              ref: {error.digest}
            </p>
          )}
          <div style={{ marginTop: 40, display: "flex", gap: 12 }}>
            {retry && (
              <button
                type="button"
                onClick={() => retry()}
                style={{
                  padding: "8px 16px",
                  borderRadius: 9999,
                  border: "1px solid #e5e5e5",
                  background: "#e5e5e5",
                  color: "#0a0a0a",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Reset
              </button>
            )}
            <a
              href="/dashboard"
              style={{
                padding: "8px 16px",
                borderRadius: 9999,
                border: "1px solid #404040",
                color: "#a0a0a0",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
