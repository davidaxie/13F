// Next.js instrumentation entry point. Next calls `register()` once per server
// instance, before any requests are handled. We branch on `NEXT_RUNTIME` so
// the Node-only Sentry SDK isn't imported into edge bundles (and vice versa).
//
// `onRequestError` is the hook Next 15+ uses to report server-side render /
// route / action errors to observability backends. Re-exporting Sentry's
// helper wires that up automatically.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
